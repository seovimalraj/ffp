import { Module } from '@nestjs/common';
import { ToleranceController } from './tolerance.controller';
import { PermissionCheckService } from 'src/permissions/permisson-check.service';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { AuthGuard } from 'src/auth/auth.guard';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  providers: [PermissionCheckService, PermissionGuard, AuthGuard],
  imports: [SupabaseModule],
  controllers: [ToleranceController],
})
export class ToleranceModule {}
