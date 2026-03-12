import { Module } from '@nestjs/common';
import { SupplierController } from './supplier.controller';
import { AuthModule } from 'src/auth/auth.module';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { PermissionCheckService } from 'src/permissions/permisson-check.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { WarehouseService } from './warehouse.service';
import { SupplierOrderService } from './supplier-order.service';
import { TemporalModule } from 'src/temporal/temporal.module';

@Module({
  imports: [SupabaseModule, TemporalModule],
  providers: [
    AuthModule,
    PermissionCheckService,
    AuthGuard,
    WarehouseService,
    SupplierOrderService,
  ],
  controllers: [SupplierController],
  exports: [WarehouseService, SupplierOrderService],
})
export class SupplierModule {}
