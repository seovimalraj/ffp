import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { SupabaseService } from 'src/supabase/supabase.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, SupabaseService],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
