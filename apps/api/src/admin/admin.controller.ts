import {
  Controller,
  Get,
  Post,
  InternalServerErrorException,
  Logger,
  Query,
  UseGuards,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RoleNames, SQLFunctions, Tables } from '../../libs/constants';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { SupabaseService } from 'src/supabase/supabase.service';
import { Roles } from 'src/auth/roles.decorator';
import { TemporalService } from 'src/temporal/temporal.service';
import { generatePassword } from './admin.utils';
import { hash } from 'bcrypt';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly temporalService: TemporalService,
  ) {}

  @Get('/organizations')
  @Roles(RoleNames.Admin)
  async getOrganizations(
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
    @Query('organization_type') organization_type,
  ) {
    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const parsedOffset = parseInt(offset, 10) || 0;

    const client = this.supabaseService.getClient();

    try {
      const query = client.from(Tables.OrganizationTable).select(
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
      );

      if (organization_type) {
        query.eq('organization_type', organization_type);
      }
      const { data, error, count } = await query
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

  @Post('/organizations')
  @Roles(RoleNames.Admin)
  async createOrganization(
    @Body()
    body: {
      contactEmail: string;
      organizationName: string;
      organizationAddress: string;
      organizationLogoUrl: string;
      contactName: string;
      contactPhone: string;
    },
  ) {
    const client = this.supabaseService.getClient();

    const {
      organizationAddress,
      organizationLogoUrl,
      organizationName,
      contactEmail,
      contactName,
      contactPhone,
    } = body;

    const generatedPassword = generatePassword(8);
    const hashedPassword = await hash(generatedPassword, 12);

    try {
      const { data: result, error } = await client.rpc(
        SQLFunctions.CreateSupplier,
        {
          p_email: contactEmail,
          p_password: hashedPassword,
          p_organization_name: organizationName,
          p_name: contactName,
          p_phone: contactPhone,
          p_logo_url: organizationLogoUrl,
          p_address: organizationAddress,
        },
      );

      if (error) {
        // Handle unique violation or other errors from RPC
        if (error.code === '23505') {
          throw new HttpException(
            'User or organization already exists',
            HttpStatus.CONFLICT,
          );
        }
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }

      if (!result) {
        throw new HttpException(
          'Failed to create user',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const user = result.user;
      const otpCode = result.otp_code;

      try {
        await this.temporalService.otpWorkflow({
          email: contactEmail,
          username: contactName,
          code: otpCode,
        });
      } catch (error) {
        this.logger.error(
          { error },
          'Failed to start OTP workflow via Temporal',
        );
      }

      try {
        await this.temporalService.startSupplierWelcomeWorkflow({
          email: contactEmail,
          username: contactName,
          password: generatedPassword,
          organizationName,
        });
      } catch (error) {
        this.logger.error(
          { error },
          'Failed to start supplier welcome workflow via Temporal',
        );
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        organization: user.organization_id,
      };
    } catch (error) {
      this.logger.error({ error }, 'Error while creating supplier');
      throw new InternalServerErrorException(
        { error },
        'Error while creating supplier',
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

  @Get('suppliers')
  @Roles(RoleNames.Admin)
  async getSuppliers() {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.OrganizationTable)
      .select('id, name, organization_type, users(email, name, id)')
      .eq('organization_type', 'supplier');

    if (error) {
      this.logger.error({ error }, 'Failed to fetch suppliers');
      throw new InternalServerErrorException('Failed to fetch suppliers');
    }

    return { suppliers: data ?? [] };
  }
}
