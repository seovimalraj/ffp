import { Module, Logger } from '@nestjs/common';
import { RfqController } from './rfq.controller';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { PermissionCheckService } from 'src/permissions/permisson-check.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { InngestService } from 'src/inngest/inngest.service';
@Module({
  imports: [SupabaseModule],
  controllers: [RfqController],
  providers: [
    PermissionGuard,
    PermissionCheckService,
    AuthGuard,
    Logger,
    InngestService,
  ],
})
export class RfqModule {}
