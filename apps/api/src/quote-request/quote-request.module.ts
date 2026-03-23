import { Module } from '@nestjs/common';
import { QuoteRequestController } from './quote-request.controller';
import { QuoteRequestService } from './quote-request.service';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { TemporalModule } from 'src/temporal/temporal.module';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';

@Module({
  imports: [SupabaseModule, TemporalModule],
  controllers: [QuoteRequestController],
  providers: [QuoteRequestService, AuthGuard, RolesGuard],
})
export class QuoteRequestModule {}
