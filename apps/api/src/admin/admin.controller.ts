import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleNames, Tables } from '../../libs/constants';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { SupabaseService } from 'src/supabase/supabase.service';
import { Roles } from 'src/auth/roles.decorator';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  @Roles(RoleNames.Admin)
  async getOrganizations(
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const parsedOffset = parseInt(offset, 10) || 0;

    const client = this.supabaseService.getClient();

    try {
      const { data, error, count } = await client
        .from(Tables.OrganizationTable)
        .select(
          `*, 
          users (
          id,
          email,
          name,
          phone,
          role,
          verified,
          created_at
    )`,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(parsedOffset, parsedOffset + parsedLimit - 1);

      if (error) {
        this.logger.error({ error }, 'Failed to fetch organizations');
        throw new InternalServerErrorException('Failed to fetch organizations');
      }

      const nextOffset =
        parsedOffset + parsedLimit < (count ?? 0)
          ? parsedOffset + parsedLimit
          : null;

      return {
        success: true,
        data: data ?? [],
        pagination: {
          offset: parsedOffset,
          limit: parsedLimit,
          nextOffset,
          total: count ?? 0,
          hasMore: nextOffset !== null,
        },
      };
    } catch (err: any) {
      this.logger.error({ err }, 'Unhandled org fetch error');
      throw new InternalServerErrorException(
        'Unexpected error while fetching organizations',
      );
    }
  }

  @Get('/parts')
  @Roles(RoleNames.Admin)
  async getParts(@Query('limit') limit = '20', @Query('offset') offset = '0') {
    const parsedLimitRaw = parseInt(limit, 10);
    const parsedOffsetRaw = parseInt(offset, 10);

    const parsedLimit = Math.min(
      Number.isNaN(parsedLimitRaw) ? 20 : parsedLimitRaw,
      100,
    );

    const parsedOffset = Number.isNaN(parsedOffsetRaw) ? 0 : parsedOffsetRaw;

    const client = this.supabaseService.getClient();

    try {
      const { data, error, count } = await client
        .from(Tables.RFQPartsTable)
        .select(
          `rfq_id, 
          rfq(rfq_code, users(name, id), organizations(name)), 
          snapshot_2d_url,
          cad_file_url,
          status,
          file_name,
          created_at`,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(parsedOffset, parsedOffset + parsedLimit - 1);

      if (error) {
        this.logger.error({ error }, 'Failed to fetch parts');
        throw new InternalServerErrorException('Failed to fetch parts');
      }

      const nextOffset =
        parsedOffset + parsedLimit < (count ?? 0)
          ? parsedOffset + parsedLimit
          : null;

      return {
        success: true,
        data: data ?? [],
        pagination: {
          offset: parsedOffset,
          limit: parsedLimit,
          nextOffset,
          total: count ?? 0,
          hasMore: nextOffset !== null,
        },
      };
    } catch (error) {
      this.logger.error({ error }, `Error while getting parts`);
      throw new InternalServerErrorException('Error while getting parts');
    }
  }
  @Get('/abandoned-rfq-parts')
  @Roles(RoleNames.Admin)
  async getAbandonedParts(
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    const parsedLimitRaw = parseInt(limit, 10);
    const parsedOffsetRaw = parseInt(offset, 10);

    const parsedLimit = Math.min(
      Number.isNaN(parsedLimitRaw) ? 20 : parsedLimitRaw,
      100,
    );

    const parsedOffset = Number.isNaN(parsedOffsetRaw) ? 0 : parsedOffsetRaw;

    const client = this.supabaseService.getClient();

    try {
      const { data, error, count } = await client
        .from(Tables.AbandonedRFQPartsTable)
        .select(
          `rfq_id,
         rfq(rfq_code, users(name, id), organizations(name)),
         snapshot_2d_url,
         cad_file_url,
         file_name,
         abandoned_reason,
         abandoned_at,
         created_at`,
          { count: 'exact' },
        )
        .order('abandoned_at', { ascending: false })
        .range(parsedOffset, parsedOffset + parsedLimit - 1);

      if (error) {
        this.logger.error({ error }, 'Failed to fetch abandoned parts');
        throw new InternalServerErrorException(
          'Failed to fetch abandoned parts',
        );
      }

      const total = count ?? 0;

      const nextOffset =
        parsedOffset + parsedLimit < total ? parsedOffset + parsedLimit : null;

      return {
        success: true,
        data: data ?? [],
        pagination: {
          offset: parsedOffset,
          limit: parsedLimit,
          nextOffset,
          total,
          hasMore: nextOffset !== null,
        },
      };
    } catch (error) {
      this.logger.error({ error }, 'Error while getting abandoned parts');
      throw new InternalServerErrorException(
        'Error while getting abandoned parts',
      );
    }
  }
}
