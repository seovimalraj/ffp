import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Tables } from '../../libs/constants';
import { RoleNames } from '../../libs/constants';
import { AuthGuard } from 'src/auth/auth.guard';
import { Public } from 'src/auth/public.decorator';
import { Roles } from 'src/auth/roles.decorator';
import { SupabaseService } from 'src/supabase/supabase.service';

@Controller('system')
@UseGuards(AuthGuard)
export class SystemController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: Logger,
  ) {}

  @Public()
  @Get('')
  async getSystemVariable(@Query('keys') keys?: string | string[]) {
    const client = this.supabaseService.getClient();

    let query = client.from(Tables.SystemConfig).select('*');
    if (keys) {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      if (keysArray.length > 0) {
        query = query.in('key', keysArray);
      }
    }

    const { data: configData, error } = await query;

    if (error) {
      this.logger.error({ error }, 'Error while fetching system variables');
      throw new InternalServerErrorException(
        'Error while fetching system variables',
        error.message,
      );
    }

    return {
      success: true,
      configData,
    };
  }

  @Post('')
  @Roles(RoleNames.Admin)
  async createNewSystemVariable(
    @Body()
    body: {
      key: string;
      value: string;
      description: string;
      type: string;
    }[],
  ) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.SystemConfig)
      .insert(body)
      .select();

    if (error) {
      this.logger.error({ error }, 'Error while creating system variables');
      throw new InternalServerErrorException(
        'Error creating system variable',
        error.message,
      );
    }

    return {
      success: true,
      data,
    };
  }

  @Patch('/:key')
  @Roles(RoleNames.Admin)
  async updateSystemVariable(
    @Param('key') key: string,
    @Body()
    body: {
      key?: string;
      value?: string;
      type?: string;
      description?: string;
    },
  ) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.SystemConfig)
      .update(body)
      .eq('key', key)
      .select();

    if (error) {
      this.logger.error({ error }, 'Error while updating system variable');
      throw new InternalServerErrorException(
        'Error updating system variable',
        error.message,
      );
    }

    return {
      success: true,
      data,
    };
  }

  @Delete('/:key')
  @Roles(RoleNames.Admin)
  async deleteSystemVariable(@Param('key') key: string) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.SystemConfig)
      .delete()
      .eq('key', key)
      .select();

    if (error) {
      this.logger.error({ error }, 'Error while deleting system variable');
      throw new InternalServerErrorException(
        'Error deleting system variable',
        error.message,
      );
    }

    return {
      success: true,
      data,
    };
  }
}
