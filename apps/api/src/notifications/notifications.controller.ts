import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Query,
  Post,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/user.decorator';
import { CurrentUserDto } from '../auth/auth.dto';
import { RoleNames } from '../../libs/constants';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('')
  @Roles(RoleNames.Admin, RoleNames.Customer, RoleNames.Supplier)
  async getNotifications(
    @CurrentUser() user: CurrentUserDto,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.notificationsService.getNotifications({
      user_id: user.id,
      organization_id: user.organizationId,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get('unread-count')
  @Roles(RoleNames.Admin, RoleNames.Customer, RoleNames.Supplier)
  async getUnreadCount(@CurrentUser() user: CurrentUserDto) {
    const count = await this.notificationsService.getNotificationCounts({
      user_id: user.id,
      organization_id: user.organizationId,
    });
    return { count };
  }

  @Patch(':id/read')
  @Roles(RoleNames.Admin, RoleNames.Customer, RoleNames.Supplier)
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.notificationsService.markNotificationRead(id, user.id);
  }

  @Patch('mark-all-read')
  @Roles(RoleNames.Admin, RoleNames.Customer, RoleNames.Supplier)
  async markAllRead(@CurrentUser() user: CurrentUserDto) {
    return this.notificationsService.markAllRead(user.id, user.organizationId);
  }

  @Post('system')
  @Public()
  async createSystemNotification(
    @Body() data: {
      userId: string;
      organizationId: string;
      title: string;
      message: string;
      type?: string;
      metadata?: any;
    },
    @Headers('x-internal-key') key: string,
  ) {
    const systemSecret = process.env.INTERNAL_API_KEY || 'debug-secret-123';
    if (key !== systemSecret) {
      throw new UnauthorizedException('Invalid internal key');
    }

    return this.notificationsService.createNotification({
      user_id: data.userId,
      organization_id: data.organizationId,
      title: data.title,
      message: data.message,
      type: data.type,
      metadata: data.metadata,
    });
  }
}
