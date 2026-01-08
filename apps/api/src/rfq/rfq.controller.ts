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

@Controller('rfq')
@UseGuards(AuthGuard)
export class RfqController {
  constructor(private readonly supbaseService: SupabaseService) {}

  @Get('')
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async getUserRfqs(@CurrentUser() user: CurrentUserDto) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client.rpc(
      SQLFunctions.getUserRFQsWithPartsCount,
      {
        p_user_id: user.id,
      },
    );

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    return {
      success: true,
      rfqs: data,
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
      p_user_id: body.user_id,
      p_organization_id: user.organizationId,
      p_parts: body.parts,
    });

    if (error) {
      throw error;
    }

    return {
      ...data,
      rfq_id: data[0].out_rfq_id,
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

  @Post(':rfqId/add-parts')
  @Roles(RoleNames.Customer)
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

    // 2. Insert into abandoned table
    const { error: insertError } = await client
      .from(Tables.AbandonedPartDrawing2DTable)
      .insert(drawing);

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

    return {
      success: true,
      removedCount: data,
    };
  }

  @Patch(':rfqId/parts/:partId')
  @Roles(RoleNames.Customer)
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

    return {
      success: true,
      part: data,
    };
  }

  @Patch(':rfq_id')
  @Roles(RoleNames.Customer)
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

    return {
      success: true,
      rfq: data,
    };
  }

  @Get(':rfqId')
  @Roles(RoleNames.Customer)
  async getRfqById(@Param('rfqId') rfqId: string) {
    const client = this.supbaseService.getClient();

    let query = client.from(Tables.RFQTable).select('*');

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
      .eq('rfq_id', rfq.id);

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

    const complete = parts.map((part) => ({
      ...part,
      files2d: lookup.get(part.id) || [],
    }));

    return {
      rfq,
      parts: complete,
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
  @Roles(RoleNames.Customer)
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
    // Using Promise.all for parallel updates
    const updatePromises = body.parts.map((p) =>
      client
        .from(Tables.RFQPartsTable)
        .update({
          final_price: p.final_price,
          lead_time: p.lead_time,
        })
        .eq('id', p.id),
    );

    await Promise.all(updatePromises);

    return {
      success: true,
    };
  }
}
