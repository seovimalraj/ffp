import { Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { PermissionCheckService } from './permisson-check.service';
import { PermissionGuard } from './permission.guard';
import { AuthGuard } from 'src/auth/auth.guard';

@Module({
  imports: [SupabaseModule],
  controllers: [PermissionsController],
  providers: [PermissionCheckService, PermissionGuard, AuthGuard],
  exports: [PermissionCheckService, PermissionGuard],
})
export class PermissionsModule {}
