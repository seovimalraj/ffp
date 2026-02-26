import { Logger, Module } from '@nestjs/common';
import { TechnicalSupportController } from './technical-support.controller';
import { TechnicalSupportService } from './technical-support.service';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { TemporalService } from 'src/temporal/temporal.service';

@Module({
  imports: [SupabaseModule],
  controllers: [TechnicalSupportController],
  providers: [
    TechnicalSupportService,
    AuthGuard,
    Logger,
    RolesGuard,
    TemporalService,
  ],
})
export class TechnicalSupportModule {}
