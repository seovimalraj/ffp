import { Module } from '@nestjs/common';
import { MaterialsController } from './materials.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { PermissionCheckService } from 'src/permissions/permisson-check.service';
import { AuthGuard } from 'src/auth/auth.guard';

@Module({
    imports: [SupabaseModule],
    controllers: [MaterialsController],
    providers: [PermissionGuard, PermissionCheckService, AuthGuard]
})
export class MaterialsModule {}
