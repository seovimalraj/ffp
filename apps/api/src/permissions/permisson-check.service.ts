import { Injectable } from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import {
  MaterializedViewNames,
  PERMISSION_ALIASES,
  PermissionsNames,
} from '../../libs/constants';

@Injectable()
export class PermissionCheckService {
  constructor(private readonly supabase: SupabaseService) {}

  private expandWithAliases(permissionCodes: string[]): string[] {
    const expanded = new Set<string>();

    for (const code of permissionCodes) {
      expanded.add(code);

      const aliases = PERMISSION_ALIASES[code];
      if (aliases && aliases.length > 0) {
        aliases.forEach((alias) => expanded.add(alias));
      }
    }

    expanded.add(PermissionsNames.adminFullAccess);
    expanded.add(PermissionsNames.organizationFullAccess);

    return Array.from(expanded);
  }

  async hasAnyPermission(params: {
    userId: string;
    organizationId: string;
    permissionCodes: string[];
    role: string;
  }): Promise<boolean> {
    const { userId, permissionCodes } = params;
    const client = this.supabase.getClient();

    const query = client
      .from(MaterializedViewNames.userPermissionCodesMV)
      .select('permission_code')
      .eq('user_id', userId);

    query.in('permission_code', this.expandWithAliases(permissionCodes));

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data.length > 0;
  }
}
