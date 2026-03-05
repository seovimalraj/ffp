import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Body,
  HttpException,
  HttpStatus,
  Patch,
  Delete,
  InternalServerErrorException,
  Query,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { RoleNames, SQLFunctions, Tables } from '../../libs/constants';
import { Roles } from '../auth/roles.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import {
  Add2DDrawingsDto,
  DerivedRFQDto,
  InitialPartDto,
  InitialRFQDto,
  RemovePartsDto,
  SyncPricingDto,
  UpdatePartDto,
  UpdateRfqDto,
  UploadSnapshotDto,
} from './rfq.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { CurrentUserDto } from '../auth/auth.dto';
import { RFQStatuses } from './rfq.helpers';
import { TemporalService } from '../temporal/temporal.service';
import { RolesGuard } from 'src/auth/roles.guard';

@Controller('rfq')
@UseGuards(AuthGuard, RolesGuard)
export class RfqController {
  constructor(
    private readonly supbaseService: SupabaseService,
    private readonly logger: Logger,
    private readonly temporalService: TemporalService,
  ) {}

  @Get('')
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async getUserRfqs(
    @CurrentUser() user: CurrentUserDto,
    @Query('status') status?: string,
    @Query('rfqType') rfqType?: string,
    @Query('limit') limit?: number,
    @Query('cursorCreatedAt') cursorCreatedAt?: string,
    @Query('cursorId') cursorId?: string,
  ) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client.rpc(
      SQLFunctions.getUserRFQsWithPartsCountInfinite,
      {
        p_user_id: user.id,
        p_status: status || null,
        p_rfq_type: rfqType || null,
        p_limit: limit || 20,
        p_cursor_created_at: cursorCreatedAt || null,
        p_cursor_id: cursorId || null,
      },
    );

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    return {
      success: true,
      ...data,
    };
  }

  @Get('status-summary')
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async getRfqStatusSummary(
    @CurrentUser() user: CurrentUserDto,
    @Query('rfqType') rfqType?: string,
  ) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client.rpc(SQLFunctions.getRfqStatusSummary, {
      p_user_id: user.id, // Customers should see their own counts
      p_organization_id: user.organizationId,
      p_rfq_type: rfqType || null,
    });

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    return {
      success: true,
      statusCounts: data,
    };
  }

  @Get(':rfqId/tech-support/exist')
  @Roles(RoleNames.Customer)
  async checkTechSupportExist(@Param('rfqId') rfqId: string) {
    const client = this.supbaseService.getClient();

    const { count, error } = await client
      .from(Tables.TechnicalSupportRequest)
      .select('*', { count: 'exact', head: true })
      .eq('quote_id', rfqId)
      .not('status', 'in', '(pending,inprogress)');

    if (error) {
      this.logger.error({ error, rfqId }, 'Tech support check failed');
      throw new InternalServerErrorException(
        'Failed to check technical support status',
      );
    }

    return {
      exists: (count ?? 0) > 0,
    };
  }

  @Get(':rfqId/tech-support')
  @Roles(RoleNames.Customer, RoleNames.Admin)
  async getTechicalSupportRequests(
    @Query('status') status: string,
    @Query('limit') limit?: number,
    @Query('cursorCreatedAt') cursorCreatedAt?: string,
    @Query('cursorId') cursorId?: string,
    @CurrentUser() user?: CurrentUserDto,
  ) {
    const client = this.supbaseService.getClient();
    const pageLimit = Number(limit) || 20;

    let query = client
      .from(Tables.TechnicalSupportRequest)
      .select('*, organizations(name),rfq(rfq_code, status,order_id)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (user.role !== 'admin') {
      query = query.eq('organization_id', user.organizationId);
    }

    // Cursor: fetch records older than the last seen row
    if (cursorCreatedAt && cursorId) {
      query = query.or(
        `created_at.lt."${cursorCreatedAt}",and(created_at.eq."${cursorCreatedAt}",id.lt."${cursorId}")`,
      );
    }

    // Fetch one extra row to detect whether there is a next page
    const { data, error } = await query.limit(pageLimit + 1);

    if (error) {
      this.logger.error(
        { error },
        'Error while querying technical support requests',
      );
      throw new InternalServerErrorException(
        'Failed to fetch technical support requests',
      );
    }

    const hasMore = data.length > pageLimit;
    const result = hasMore ? data.slice(0, pageLimit) : data;

    const lastItem = result[result.length - 1];
    const nextCursor = hasMore
      ? { createdAt: lastItem?.created_at, id: lastItem?.id }
      : null;

    return {
      ts_requests: result,
      hasMore,
      nextCursor,
    };
  }

  @Get('admin/all')
  @Roles(RoleNames.Admin)
  async getAdminRfqs(
    @Query('status') status?: string,
    @Query('rfqType') rfqType?: string,
    @Query('limit') limit?: number,
    @Query('cursorCreatedAt') cursorCreatedAt?: string,
    @Query('cursorId') cursorId?: string,
  ) {
    const client = this.supbaseService.getClient();

    let query = client
      .from(Tables.RFQTable)
      .select(
        `
        *,
        organization:${Tables.OrganizationTable}(name),
        user:${Tables.UserTable}(email, name),
        parts:${Tables.RFQPartsTable}(id, file_name, cad_file_url, snapshot_2d_url)
      `,
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (status && status.toLowerCase() !== 'any') {
      query = query.eq('status', status.toLowerCase());
    }

    if (rfqType && rfqType.toLowerCase() !== 'any') {
      query = query.eq('rfq_type', rfqType.toLowerCase());
    }

    if (cursorCreatedAt && cursorId) {
      query = query.or(
        `created_at.lt."${cursorCreatedAt}",and(created_at.eq."${cursorCreatedAt}",id.lt."${cursorId}")`,
      );
    }

    const { data, error } = await query.limit((limit || 20) + 1);

    if (error) {
      this.logger.error('Failed to fetch admin RFQs:', error);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    const hasMore = data.length > (limit || 20);
    const resultData = hasMore ? data.slice(0, limit || 20) : data;

    const processedData = resultData.map((rfq) => ({
      ...rfq,
      parts_count: rfq.parts?.length || 0,
      organization_name: rfq.organization?.name || 'Unknown',
      user_email: rfq.user?.email,
      user_name: rfq.user?.name,
      parts: rfq.parts,
      organization: undefined,
      user: undefined,
    }));

    const { data: rfqCounts, error: statusError } = await client.rpc(
      SQLFunctions.getRfqStatusCounts,
    );

    if (statusError) {
      this.logger.error('Failed to fetch statuses: ', statusError);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    return {
      success: true,
      data: processedData,
      counts: rfqCounts,
      hasMore,
    };
  }

  @Post('')
  @Roles(RoleNames.Customer)
  async createRfq(
    @Body() body: InitialRFQDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    const client = this.supbaseService.getClient();

    // check the code in the create-inital-rfq.sql file
    // for SQL function code
    const { data, error } = await client.rpc(SQLFunctions.createInitialRFQ, {
      p_user_id: user.id,
      p_parts: body.parts,
    });

    if (error) {
      throw error;
    }

    const rfqId = data[0].out_rfq_id;
    const partIds = data[0].out_part_ids;

    // Trigger Temporal workflows for CAD processing only for non-processed parts
    // Parts already processed by the client (e.g. non-backend compatible) are skipped
    await Promise.all(
      partIds.map((partId: string, index: number) => {
        const part = body.parts[index];
        if (part.status === 'processed') return Promise.resolve();

        return this.temporalService.startProcessPartGeometryWorkflow({
          partId,
          filename: part.file_name,
          fileUrl: part.cad_file_url,
        });
      }),
    ).catch((err) => {
      this.logger.error(
        { err, rfqId },
        'Failed to start CAD processing workflows for initial RFQ parts',
      );
    });

    await this.recalculateRfqTotal(rfqId);

    return {
      ...data,
      rfq_id: rfqId,
      rfq_code: data[0].out_rfq_code,
      success: true,
    };
  }

  @Post('derived')
  @Roles(RoleNames.Customer)
  async dervieRfq(
    @Body() body: { groups: DerivedRFQDto[] },
    @CurrentUser() user: CurrentUserDto,
  ) {
    const client = this.supbaseService.getClient();

    // Process all groups in parallel for maximum performance
    const results = await Promise.all(
      body.groups.map(async (group) => {
        // Batch fetch all parts for this group in a single query (O(1) instead of O(n))
        const { data: expandedParts, error: fetchError } = await client
          .from(Tables.RFQPartsTable)
          .select('*')
          .in('id', group.parts);

        if (fetchError) {
          throw new HttpException(
            `Failed to fetch parts: ${fetchError.message}`,
            HttpStatus.BAD_REQUEST,
          );
        }

        // Validate all parts were found
        if (!expandedParts || expandedParts.length !== group.parts.length) {
          throw new HttpException(
            `Some parts not found. Expected ${group.parts.length}, found ${expandedParts?.length || 0}`,
            HttpStatus.NOT_FOUND,
          );
        }

        // Create new RFQ with the fetched parts
        const { data, error } = await client.rpc(
          SQLFunctions.createInitialRFQ,
          {
            p_user_id: user.id,
            p_parts: expandedParts,
          },
        );

        if (error) {
          throw new HttpException(
            `Failed to create RFQ: ${error.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        return data[0];
      }),
    );

    return {
      success: true,
      rfqs: results,
    };
  }

  private async notifyVerifier(rfqId: string, userEmail: string) {
    await this.temporalService.sendEmail({
      to: process.env.VERIFIER_EMAIL,
      subject: 'New Manual Quote Request',
      text: `
      A new manual quote request has been submitted and requires review.

      ----------------------------------------
      RFQ DETAILS
      ----------------------------------------
      RFQ ID      : ${rfqId}
      Customer   : ${userEmail}

      ----------------------------------------
      ACTION REQUIRED
      ----------------------------------------
      Review and process the quote using the link below:
      ${process.env.FRONTEND_URL}/admin/quotes/${rfqId}

      ----------------------------------------
      NOTIFICATION DETAILS
      ----------------------------------------
      Submitted by : ${userEmail}

      This is an automated message.
    `.trim(),
      name: 'Manual Quote System',
    });
  }

  @Post('manual')
  @Roles(RoleNames.Customer)
  async makeManualQuote(
    @Body()
    body: {
      rfqId?: string;
      partIds: string[];
      metadata?: Record<string, string>;
    },
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!body.partIds?.length) {
      throw new HttpException(
        'At least one part is required for manual quote',
        HttpStatus.BAD_REQUEST,
      );
    }

    const client = this.supbaseService.getClient();
    let rfqId: string;

    // -------------------------
    // Existing RFQ → manual
    // -------------------------
    if (body.rfqId) {
      rfqId = body.rfqId;

      const { error: rfqError } = await client
        .from(Tables.RFQTable)
        .update({
          rfq_type: 'manual',
          status: RFQStatuses.UnderReview,
          manual_quote_metadata: body.metadata ?? {},
        })
        .eq('id', rfqId)
        .eq('user_id', user.id);

      if (rfqError) {
        throw new HttpException(rfqError.message, HttpStatus.BAD_REQUEST);
      }

      const { error: approvalError } = await client
        .from(Tables.ManualQuoteApproval)
        .upsert(
          body.partIds.map((partId) => ({
            rfq_id: rfqId,
            rfq_part_id: partId,
          })),
          { onConflict: 'rfq_part_id' },
        );

      if (approvalError) {
        throw new HttpException(approvalError.message, HttpStatus.BAD_REQUEST);
      }
    }

    // -------------------------
    // New RFQ (RPC)
    // -------------------------
    else {
      const { data, error } = await client.rpc(
        SQLFunctions.CreateManualQuotes,
        {
          p_user_id: user.id,
          p_parts: body.partIds,
          p_meta: body.metadata ?? {},
        },
      );

      if (error || !data?.[0]?.out_rfq_id) {
        this.logger.error(error);
        throw new HttpException(
          'Failed to create manual quote',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      rfqId = data[0].out_rfq_id;
    }

    // -------------------------
    // Side effect (non-blocking)
    // -------------------------
    try {
      await this.notifyVerifier(rfqId, user.email);
    } catch (err) {
      this.logger.error(
        { err, rfqId },
        'Failed to send manual quote notification',
      );
      // Do NOT fail the request
    }

    return {
      success: true,
      rfqId,
      message: 'Manual quote request submitted successfully',
    };
  }

  @Post('send-quote/:rfqId')
  @Roles(RoleNames.Admin)
  async sendQuote(@Param('rfqId') rfqId: string) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.RFQTable)
      .update({ status: RFQStatuses.PendingApproval })
      .eq('id', rfqId)
      .eq('status', RFQStatuses.UnderReview)
      .select('id, user_id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        this.logger.log(
          { rfqId },
          'RFQ already updated or not in review state',
        );
        return { success: false, reason: 'invalid_state_or_already_updated' };
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      await this.temporalService.reviewManualQuoteWorkflow({
        userId: data.user_id,
        quoteId: rfqId,
      });
    } catch (temporalError) {
      this.logger.error('Failed to start Temporal workflow', temporalError);
      // Optional: Rollback status if workflow fail?
      // For now, just throw error to let admin know it failed.
      throw new HttpException(
        'Failed to notify customer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      success: true,
      message: 'Quote approval process started',
    };
  }

  @Post('technical-support')
  @Roles(RoleNames.Customer)
  async sendGeneralTechnicalSupportRequest(
    @CurrentUser() currentUser: CurrentUserDto,
    @Body()
    body: {
      phone: string;
      email: string;
      text: string;
    },
  ) {
    try {
      await this.temporalService.technicalSupportWorkflow({
        userId: currentUser.id,
        organizationId: currentUser.organizationId,
        email: body.email,
        phone: body.phone,
        text: body.text,
        customerName: currentUser.name,
      });
    } catch (temporalError) {
      this.logger.error('Failed to start Temporal workflow', temporalError);
      throw new HttpException(
        'Failed to send technical support emails',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('technical-support/:rfqId')
  @Roles(RoleNames.Customer)
  async sendTechnicalSupportRequest(
    @Param('rfqId') rfqId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body()
    body: {
      quoteCode: string;
      phone: string;
      email: string;
      text: string;
    },
  ) {
    try {
      await this.temporalService.technicalSupportWorkflow({
        userId: currentUser.id,
        organizationId: currentUser.organizationId,
        quoteId: rfqId,
        email: body.email,
        phone: body.phone,
        text: body.text,

        customerName: currentUser.name,
        quoteCode: body.quoteCode,
      });
    } catch (temporalError) {
      this.logger.error('Failed to start Temporal workflow', temporalError);
      // Optional: Rollback status if workflow fail?
      // For now, just throw error to let admin know it failed.
      throw new HttpException(
        'Failed to send technical support emails',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':rfqId/add-parts')
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async addParts(
    @Param('rfqId') rfqId: string,
    @Body() body: { parts: InitialPartDto[] },
    @CurrentUser() user: CurrentUserDto,
  ) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.RFQPartsTable)
      .insert(
        body.parts.map((part) => ({
          rfq_id: rfqId,
          ...part,
          organization_id: user.organizationId,
        })),
      )
      .select(); // IMPORTANT: return inserted rows

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    await Promise.all(
      data
        .filter((part) => part.status !== 'processed')
        .map((part) =>
          this.temporalService.startProcessPartGeometryWorkflow({
            filename: part.file_name,
            fileUrl: part.cad_file_url,
            partId: part.id,
          }),
        ),
    );

    await this.recalculateRfqTotal(rfqId);

    return {
      success: true,
      parts: data,
    };
  }

  @Post(':rfqId/:partId/add-2d-drawings')
  @Roles(RoleNames.Customer)
  async add2dDrawings(
    @Param('rfqId') rfqId: string,
    @Param('partId') partId: string,
    @Body() body: { drawings: Add2DDrawingsDto[] },
  ) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.RFQPartDrawing2DTable)
      .insert(
        body.drawings.map((drawing) => ({
          rfq_id: rfqId,
          rfq_part_id: partId,
          ...drawing,
        })),
      )
      .select(); // IMPORTANT: return inserted rows

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    return {
      success: true,
      drawings: data,
    };
  }

  @Delete(':rfqId/parts/:partId/drawings/:drawingId')
  @Roles(RoleNames.Customer)
  async remove2dDrawing(
    @Param('rfqId') rfqId: string,
    @Param('partId') partId: string,
    @Param('drawingId') drawingId: string,
  ) {
    const client = this.supbaseService.getClient();

    // 1. Fetch the drawing to be archived
    const { data: drawing, error: fetchError } = await client
      .from(Tables.RFQPartDrawing2DTable)
      .select('*')
      .eq('id', drawingId)
      .eq('rfq_part_id', partId)
      .eq('rfq_id', rfqId)
      .single();

    if (fetchError || !drawing) {
      throw new HttpException('Drawing not found', HttpStatus.NOT_FOUND);
    }

    const formattedDrawings = {
      file_name: drawing.file_name,
      file_url: drawing.file_url,
      mime_type: drawing.mime_type,
    };

    // 2. Insert into abandoned table
    const { error: insertError } = await client
      .from(Tables.AbandonedPartDrawing2DTable)
      .insert(formattedDrawings);

    if (insertError) {
      console.error('Error archiving drawing:', insertError);
      throw new HttpException(
        'Failed to archive drawing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // 3. Delete from original table
    const { error: deleteError } = await client
      .from(Tables.RFQPartDrawing2DTable)
      .delete()
      .eq('id', drawingId);

    if (deleteError) {
      throw new HttpException(
        'Failed to delete drawing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      success: true,
      id: drawingId,
    };
  }

  @Delete(':rfqId/remove-parts')
  @Roles(RoleNames.Customer)
  async removeParts(
    @Param('rfqId') rfqId: string,
    @CurrentUser() user: CurrentUserDto,
    @Body() body: RemovePartsDto,
  ) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client.rpc(SQLFunctions.abandonRFQParts, {
      p_part_ids: body.partIds,
      p_user_id: user.id,
      p_reason: 'User removed part',
    });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error removing parts',
      );
    }

    await this.recalculateRfqTotal(rfqId);

    return {
      success: true,
      removedCount: data,
    };
  }

  @Patch(':rfqId/parts/:partId')
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async updatePart(
    @Param('rfqId') rfqId: string,
    @Param('partId') partId: string,
    @Body() body: UpdatePartDto,
  ) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.RFQPartsTable)
      .update(body)
      .eq('id', partId)
      .eq('rfq_id', rfqId)
      .select()
      .single();

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    if (body.final_price !== undefined || body.quantity !== undefined) {
      await this.recalculateRfqTotal(rfqId);
    }

    return {
      success: true,
      part: data,
    };
  }

  @Patch(':rfq_id')
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async updateRfq(@Body() body: UpdateRfqDto, @Param('rfq_id') rfq_id: string) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.RFQTable)
      .update(body)
      .eq('id', rfq_id)
      .select()
      .single();

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    await this.recalculateRfqTotal(rfq_id);

    return {
      success: true,
      rfq: data,
    };
  }

  @Patch('technical-support/:id')
  @Roles(RoleNames.Admin)
  async updateSupportRequestStatus(
    @Param('id') id: string,
    @Body()
    body: {
      status: 'pending' | 'inprogress' | 'resolved' | 'rejected';
      reject_reason?: string;
    },
  ) {
    const client = this.supbaseService.getClient();

    if (body.status === 'rejected' && !body.reject_reason) {
      throw new BadRequestException('reject_reason is required when rejecting');
    }

    const updatePayload: any = {
      status: body.status,
    };

    if (body.status === 'rejected') {
      updatePayload.reject_reason = body.reject_reason;
    }

    const { data, error } = await client
      .from(Tables.TechnicalSupportRequest)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error({ error }, 'Error while updating support request');
      throw new InternalServerErrorException(
        'Failed to update support request',
      );
    }

    return {
      success: true,
      result: data,
    };
  }

  @Get(':rfqId')
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async getRfqById(
    @Param('rfqId') rfqId: string,
    @CurrentUser() currentUser: CurrentUserDto,
  ) {
    const client = this.supbaseService.getClient();

    let query = client.from(Tables.RFQTable).select(`
      *,
      users(email, name, phone),
      organizations(name)
    `);

    // Check if id is a UUID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        rfqId,
      );

    if (isUUID) {
      query = query.eq('id', rfqId);
    } else {
      query = query.eq('rfq_code', rfqId);
    }

    const { data: rfq, error } = await query.single();

    if (error || !rfq) {
      throw error || new Error('RFQ not found');
    }

    // Now fetch parts using the resolved rfq.id
    const { data: parts, error: partsError } = await client
      .from(Tables.RFQPartsTable)
      .select('*')
      .eq('rfq_id', rfq.id)
      .order('created_at', { ascending: true });

    if (error || partsError) {
      throw error || partsError;
    }

    const { data: drawings, error: drawingError } = await client
      .from(Tables.RFQPartDrawing2DTable)
      .select('*')
      .eq('rfq_id', rfq.id);

    if (drawingError) {
      throw drawingError;
    }

    const lookup = new Map<string, any[]>();

    drawings.forEach((drawing) => {
      if (!lookup.has(drawing.rfq_part_id)) {
        lookup.set(drawing.rfq_part_id, []);
      }
      lookup.get(drawing.rfq_part_id)?.push({
        file_name: drawing.file_name,
        file_url: drawing.file_url,
        mime_type: drawing.mime_type,
        id: drawing.id,
      });
    });

    let abandoned = null;

    if (currentUser.role === RoleNames.Admin) {
      const { data: abandonedQuotes, error: abandonedError } = await client
        .from(Tables.AbandonedRFQPartsTable)
        .select('*')
        .eq('rfq_id', rfq.id);

      if (abandonedError) {
        throw abandonedError;
      }
      abandoned = abandonedQuotes;
    }

    const complete = parts.map((part) => ({
      ...part,
      files2d: lookup.get(part.id) || [],
    }));

    return {
      rfq,
      parts: complete,
      abandoned,
    };
  }

  @Post(':rfqId/part/:partId/upload-snapshot')
  @Roles(RoleNames.Admin, RoleNames.Supplier, RoleNames.Customer)
  async uploadSnapshot(
    @Body() body: UploadSnapshotDto,
    @Param('partId') partId: string,
  ) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.RFQPartsTable)
      .update({
        snapshot_2d_url: body.snapshot,
      })
      .eq('id', partId)
      .select()
      .single();

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    return {
      success: true,
      part: data,
    };
  }

  @Post(':rfqId/sync-pricing')
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async syncPricing(
    @Param('rfqId') rfqId: string,
    @Body() body: SyncPricingDto,
  ) {
    const client = this.supbaseService.getClient();

    // 1. Update RFQ Total Price
    const { error: rfqError } = await client
      .from(Tables.RFQTable)
      .update({
        final_price: body.rfq_final_price,
      })
      .eq('id', rfqId);

    if (rfqError) {
      throw new HttpException(rfqError.message, HttpStatus.BAD_REQUEST);
    }

    // 2. Update Parts Pricing
    const results = await Promise.all(
      body.parts.map((p) =>
        client
          .from(Tables.RFQPartsTable)
          .update({
            final_price: p.final_price,
            lead_time: p.lead_time,
          })
          .eq('id', p.id),
      ),
    );

    // Check for errors in part updates
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      this.logger.error(
        `Some parts failed to update: ${JSON.stringify(errors)}`,
      );
    }

    // 3. Recalculate to be absolutely sure
    await this.recalculateRfqTotal(rfqId);

    return {
      success: true,
    };
  }

  @Post(':rfqId/recalculate')
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async manualRecalculate(@Param('rfqId') rfqId: string) {
    const total = await this.recalculateRfqTotal(rfqId);
    return {
      success: true,
      total,
    };
  }

  private async recalculateRfqTotal(rfqId: string) {
    const client = this.supbaseService.getClient();

    // Fetch all active parts for this RFQ
    const { data: parts, error: fetchError } = await client
      .from(Tables.RFQPartsTable)
      .select('final_price, quantity')
      .eq('rfq_id', rfqId)
      .eq('is_archived', false);

    if (fetchError) {
      this.logger.error(
        `Error fetching parts for recalculation: ${fetchError.message}`,
      );
      return 0;
    }

    const total = parts.reduce((acc, part) => {
      const price = part.final_price || 0;
      return acc + price;
    }, 0);

    // Update the RFQ total
    const { error: updateError } = await client
      .from(Tables.RFQTable)
      .update({ final_price: total })
      .eq('id', rfqId);

    if (updateError) {
      this.logger.error(`Error updating RFQ total: ${updateError.message}`);
    }

    return total;
  }
}
