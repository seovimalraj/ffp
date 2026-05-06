import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Tables } from '../../libs/constants';
import { SupabaseService } from 'src/supabase/supabase.service';
import { NotificationsGateway } from './notifications.gateway';

interface GetNotificationParams {
  user_id: string;
  organization_id: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async createNotification(data: {
    user_id: string;
    organization_id: string;
    title: string;
    message: string;
    type?: string;
    metadata?: any;
  }) {
    const client = this.supabaseService.getClient();

    const { data: notification, error } = await client
      .from(Tables.Notification)
      .insert([
        {
          user_id: data.user_id,
          organization_id: data.organization_id,
          title: data.title,
          message: data.message,
          type: data.type || 'info',
          meta_data: data.metadata || {},
          is_read: false,
        },
      ])
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create notification: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    // Push real-time notification
    this.gateway.sendToUser(data.user_id, 'receiveMessage', {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      metadata: notification.meta_data,
      created_at: notification.created_at,
    });

    return notification;
  }

  async getNotificationCounts(params: { user_id: string; organization_id: string }) {
    const client = this.supabaseService.getClient();

    const { count, error } = await client
      .from(Tables.Notification)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', params.user_id)
      .eq('organization_id', params.organization_id)
      .eq('is_read', false);

    if (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException(error.message);
    }

    return count ?? 0;
  }

  async getNotifications({ user_id, organization_id, limit = 20, offset = 0 }: GetNotificationParams) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.Notification)
      .select('*')
      .eq('user_id', user_id)
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async markNotificationRead(notification_id: string, user_id: string) {
    const client = this.supabaseService.getClient();

    const { error } = await client
      .from(Tables.Notification)
      .update({ is_read: true })
      .eq('id', notification_id)
      .eq('user_id', user_id);

    if (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException(error.message);
    }

    return { success: true };
  }

  async markAllRead(user_id: string, organization_id: string) {
    const client = this.supabaseService.getClient();

    const { error } = await client
      .from(Tables.Notification)
      .update({ is_read: true })
      .eq('user_id', user_id)
      .eq('organization_id', organization_id)
      .eq('is_read', false);

    if (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException(error.message);
    }

    return { success: true };
  }
}
