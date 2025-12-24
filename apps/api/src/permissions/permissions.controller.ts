import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { MaterializedViewNames, RoleNames, Tables } from '../../libs/constants';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { SupabaseService } from 'src/supabase/supabase.service';

@Controller('permissions')
@UseGuards(AuthGuard)
export class PermissionsController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('me')
  @Roles(RoleNames.Admin, RoleNames.Supplier, RoleNames.Customer)
  async getPermission(@Req() req: any) {
    const userId = req.user.id;
    const client = this.supabaseService.getClient();

    const query = client
      .from(MaterializedViewNames.userPermissionCodesMV)
      .select('permission_code')
      .eq('user_id', userId);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return { permissions: [] };
    }

    return {
      permissions:
        (data ?? []).map((permisson) => permisson?.permission_code) ?? [],
    };
  }

  @Get('all')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  async getAllPermissions() {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.PermissionsTable)
      .select('id, code, name, description, category, meta')
      .eq('is_public', true)
      .order('category', { ascending: true })
      .order('code', { ascending: true });

    if (error) {
      console.error(error);
      return { permissions: [] };
    }

    return { permissions: data ?? [] };
  }
}
