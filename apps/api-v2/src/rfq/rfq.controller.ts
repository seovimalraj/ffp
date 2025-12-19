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
import { RoleNames, SQLFunctions, Tables } from 'libs/constants';
import { Roles } from 'src/auth/roles.decorator';
import { SupabaseService } from 'src/supabase/supabase.service';
import {
  Add2DDrawingsDto,
  Drawing2DLookupDto,
  InitialPartDto,
  InitialRFQDto,
  RemovePartsDto,
  SyncPricingDto,
  UpdatePartDto,
} from './rfq.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { CurrentUser } from 'src/auth/user.decorator';
import { CurrentUserDto } from 'src/auth/auth.dto';

@Controller('rfq')
@UseGuards(AuthGuard)
export class RfqController {
  constructor(private readonly supbaseService: SupabaseService) {}

  @Post('')
  @Roles(RoleNames.Customer)
  async createRfq(@Body() body: InitialRFQDto) {
    const client = this.supbaseService.getClient();

    // check the code in the create-inital-rfq.sql file
    // for SQL function code
    const { data, error } = await client.rpc(SQLFunctions.createInitialRFQ, {
      p_user_id: body.user_id,
      p_parts: body.parts,
    });

    console.log(data[0]);

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

  @Post(':rfqId/add-parts')
  @Roles(RoleNames.Customer)
  async addParts(
    @Param('rfqId') rfqId: string,
    @Body() body: { parts: InitialPartDto[] },
  ) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.RFQPartsTable)
      .insert(
        body.parts.map((part) => ({
          rfq_id: rfqId,
          ...part,
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

    console.log(body);

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

    console.log(body, '<----');

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
