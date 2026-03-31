import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { PermissionCheckService } from 'src/permissions/permisson-check.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({
  imports: [SupabaseModule],
  controllers: [AdminController],
  providers: [
    PermissionGuard,
    PermissionCheckService,
    AuthGuard,
    RolesGuard,
    AdminDashboardService,
  ],
})
export class AdminModule {}
