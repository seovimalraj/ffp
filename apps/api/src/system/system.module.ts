import { Module, Logger } from '@nestjs/common';
import { SystemController } from './system.controller';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { PermissionCheckService } from 'src/permissions/permisson-check.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [SystemController],
  providers: [PermissionGuard, PermissionCheckService, AuthGuard, Logger],
})
export class SystemModule {}
