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
        .select('*', { count: 'exact' })
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
}
