import { SupabaseService } from 'src/supabase/supabase.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PermissionService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async addPermission() {}
}
