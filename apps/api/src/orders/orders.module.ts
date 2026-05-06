import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrderWorkflowController } from './order-workflow.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { PermissionCheckService } from 'src/permissions/permisson-check.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { ShippingAddressService } from './shipping-address.service';
import { OrderService } from './order.service';
import { RolesGuard } from 'src/auth/roles.guard';
import { OrderWorkflowService } from './order-workflow.service';

import { TemporalModule } from 'src/temporal/temporal.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [SupabaseModule, TemporalModule, NotificationsModule],
  controllers: [OrdersController, OrderWorkflowController],
  providers: [
    PermissionGuard,
    PermissionCheckService,
    AuthGuard,
    ShippingAddressService,
    OrderService,
    RolesGuard,
    OrderWorkflowService,
  ],
})
export class OrdersModule {}
