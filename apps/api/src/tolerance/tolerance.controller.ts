import { Controller, Get, Put, UseGuards } from '@nestjs/common';
import { PermissionsNames, RoleNames, Tables } from '../../libs/constants';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { RequirePermissions } from 'src/permissions/permissions.decorator';
import { SupabaseService } from 'src/supabase/supabase.service';
import { GeneralToleranceDto } from './tolerance.dto';

@Controller('tolerance')
@UseGuards(AuthGuard, PermissionGuard)
export class ToleranceController {
  constructor(private readonly supbaseService: SupabaseService) {}

  @Get('')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.adminFullAccess)
  async getTolerances() {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.GeneralTolerancesTable)
      .select('*');

    if (error) {
      throw new Error(`Error fetching tolerances: ${error.message}`);
    }

    return data;
  }

  @Put('')
  @Roles(RoleNames.Admin)
  @RequirePermissions(PermissionsNames.adminFullAccess)
  async updateTolerances(body: GeneralToleranceDto) {
    const client = this.supbaseService.getClient();
    const { data, error } = await client
      .from(Tables.GeneralTolerancesTable)
      .update(body)
      .select('*');

    if (error) {
      throw new Error(`Error updating tolerances: ${error.message}`);
    }
    return data;
  }
}
