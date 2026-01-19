import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { PermissionsModule } from './permissions/permissions.module';
import { validate } from './config/env.validation';
import { MaterialsModule } from './materials/materials.module';
import { SupplierModule } from './supplier/supplier.module';
import { ToleranceModule } from './tolerance/tolerance.module';
import { MulterModule } from '@nestjs/platform-express';
import { FilesModule } from './files/files.module';
import { RfqModule } from './rfq/rfq.module';
import { OrdersModule } from './orders/orders.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OrgModule } from './org/org.module';

@Module({
  imports: [
    MulterModule.register({
      // des
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: (() => {
        switch (process.env.NODE_ENV) {
          case 'production':
            return '.env';
          case 'test':
            return '.env.test';
          case 'development':
          default:
            return '.env.development';
        }
      })(),
      validate,
      cache: true,
    }),
    SupabaseModule,
    AuthModule,
    PermissionsModule,
    MaterialsModule,
    SupplierModule,
    ToleranceModule,
    FilesModule,
    RfqModule,
    OrdersModule,
    DashboardModule,
    OrgModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
