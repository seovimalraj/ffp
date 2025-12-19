import { Module } from '@nestjs/common';
import { RfqController } from './rfq.controller';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { PermissionCheckService } from 'src/permissions/permisson-check.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [RfqController],
  providers: [PermissionGuard, PermissionCheckService, AuthGuard],
})
export class RfqModule {}
