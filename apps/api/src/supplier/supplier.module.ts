import { Module } from '@nestjs/common';
import { SupplierController } from './supplier.controller';
import { AuthModule } from 'src/auth/auth.module';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { PermissionCheckService } from 'src/permissions/permisson-check.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { WarehouseService } from './warehouse.service';

@Module({
    imports: [SupabaseModule],
    providers: [AuthModule, PermissionGuard, PermissionCheckService, AuthGuard, WarehouseService],
    controllers: [SupplierController],
    exports: [WarehouseService]
})
export class SupplierModule { }
