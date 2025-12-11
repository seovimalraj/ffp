import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import {
  PermissionsNames,
  RoleNames,
  SQLFunctions,
  Tables,
} from 'libs/constants';
import { CurrentUserDto } from 'src/auth/auth.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { CurrentUser } from 'src/auth/user.decorator';
import { RequirePermissions } from 'src/permissions/permissions.decorator';
import { SupabaseService } from 'src/supabase/supabase.service';
import {
  AddStockDto,
  CreateSupplierMaterialDto,
  CreateWarehouseDto,
  RemoveStockDto,
  UpdateStockDto,
} from './supplier.dto';
import { WarehouseService } from './warehouse.service';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { generateUUID } from 'libs/helpers';

@Controller('supplier')
@UseGuards(AuthGuard, PermissionGuard)
export class SupplierController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly warehouseService: WarehouseService,
  ) {}

  @Get('members')
  @Roles(RoleNames.Supplier, RoleNames.Admin)
  @RequirePermissions(PermissionsNames.organizationFullAccess)
  async getMembers(@CurrentUser() currentUser: CurrentUserDto) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.UserTable)
      .select(
        `
        *,
        permissions: user_permission_codes_mv (
          codes: permission_code
        )
      `,
      )
      .eq('organization_id', currentUser.organizationId)
      .eq('is_owner', false);

    if (error) {
      console.error(error);
      return { members: [] };
    }

    // Transform the permissions data
    const transformedData = data.map((member) => ({
      ...member,
      permissions: member.permissions?.map((p) => p.codes) || [],
    }));
    return { members: transformedData };
  }

  @Post('/permission')
  @Roles(RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.organizationFullAccess)
  async addPermission(
    @CurrentUser() currentUser: CurrentUserDto,
    @Body()
    body: {
      userId: string;
      permissions: string | string[];
      roleId: string;
      reason?: string;
      expiredAt: Date;
      targetUserId: string;
    },
  ) {
    const client = this.supabaseService.getClient();

    const { permissions, roleId, reason, expiredAt, targetUserId } = body;

    // Validate the target user belongs to the same organization
    const { data: targetUser, error: targetError } = await client
      .from(Tables.UserTable)
      .select('id')
      .eq('id', targetUserId)
      .eq('organization_id', currentUser.organizationId)
      .single();

    if (targetError || !targetUser) {
      throw new ForbiddenException(
        'User does not belong to your organization.',
      );
    }

    // Handle both single permission and array of permissions
    const permissionIds = Array.isArray(permissions)
      ? permissions
      : [permissions];

    const insertData = permissionIds.map((id) => ({
      id: generateUUID(),
      role_id: roleId,
      permission_id: id,
      user_id: targetUserId,
      is_granted: true,
      granted_by: currentUser.id,
      reason: reason || '',
      expires_at: expiredAt || null,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await client
      .from(Tables.RolePermissionsTable)
      .insert(insertData);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    Tables;

    await this.supabaseService.refreshMaterializedView(
      SQLFunctions.userPermissionCodesMVRefresh,
    );

    return data;
  }

  @Delete('/permission')
  @Roles(RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.organizationFullAccess)
  async deletePermission(
    @Body() body: { permissionId: string; userId: string },
  ) {
    const client = this.supabaseService.getClient();

    const { permissionId, userId } = body;

    if (!permissionId || !userId) {
      throw new BadRequestException('permissionId and userId are required');
    }

    const { error } = await client
      .from(Tables.RolePermissionsTable) // <-- FIX: should be user_permissions, not role_permissions
      .delete()
      .eq('user_id', userId)
      .eq('permission_id', permissionId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    await this.supabaseService.refreshMaterializedView(
      SQLFunctions.userPermissionCodesMVRefresh,
    );

    return {
      success: true,
      deleted: { permissionId, userId },
    };
  }

  @Get('/permission/form')
  @Roles(RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.organizationFullAccess)
  async getPermissionFormData() {
    const client = this.supabaseService.getClient();

    try {
      // Fetch supplier role and permissions in parallel
      const [supplierResult, permissionsResult] = await Promise.all([
        // Get supplier role ID directly
        client
          .from(Tables.RolesTable)
          .select('id, name')
          .eq('name', RoleNames.Supplier)
          .single(),

        // Get permissions using Supabase query builder instead of raw SQL
        client
          .from(Tables.PermissionsTable)
          .select('category, meta, code')
          .eq('is_public', false),
      ]);

      // Handle supplier role error
      if (supplierResult.error) {
        throw new InternalServerErrorException(
          `Failed to fetch supplier role: ${supplierResult.error.message}`,
        );
      }

      // Handle permissions error
      if (permissionsResult.error) {
        throw new InternalServerErrorException(
          `Failed to fetch permissions: ${permissionsResult.error.message}`,
        );
      }

      // Transform permissions data
      const permissions = permissionsResult.data.reduce(
        (acc, permission) => {
          const { category, meta, code } = permission;

          if (!acc[category]) {
            acc[category] = {};
          }

          if (!acc[category][meta]) {
            acc[category][meta] = [];
          }

          acc[category][meta].push(code);

          return acc;
        },
        {} as Record<string, Record<string, string[]>>,
      );

      return {
        supplier_role_id: supplierResult.data.id,
        permissions,
      };
    } catch (error) {
      console.error('Error fetching permission form data:', error);

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'An unexpected error occurred while fetching permission form data',
      );
    }
  }

  @Get('/material')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.warehouseReadAccess)
  async getMaterials(@CurrentUser() currentUser: CurrentUserDto) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.SupplierMaterials)
      .select('*, warehouses (id, name), material (name)')
      .eq('supplier_id', currentUser.organizationId);

    if (error) {
      console.error(error);
      return { materials: [] };
    }

    return { materials: data };
  }

  @Post('/material')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.warehouseWriteAccess)
  async createMaterial(
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: CreateSupplierMaterialDto,
  ) {
    this.warehouseService.createStockForWarehouse(
      currentUser.organizationId,
      body.material,
      body.warehouse,
      body.current_stock,
      body.stock_unit,
      body.supplier_price,
      body.currency,
      body.max_stock,
    );

    return { success: true };
  }

  @Get('warehouses')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.warehouseReadAccess)
  async getWarehouses(@CurrentUser() currentUser: CurrentUserDto) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.Warehouses)
      .select('*')
      .eq('organization_id', currentUser.organizationId);

    if (error) {
      console.log(currentUser);
      console.error(error);
      return { warehouses: [] };
    }

    return { warehouses: data };
  }

  @Post('warehouses')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.warehouseWriteAccess)
  async createWarehouse(
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: CreateWarehouseDto,
  ) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.Warehouses)
      .insert({
        name: body.name,
        organization_id: currentUser.organizationId,
        total_capacity: body.total_capacity,
        used_capacity: body.used_capacity,
        geolocation: body.geolocation ?? '',
        address: body.address ?? '',
        unit: body.unit,
      })
      .select()
      .single();

    if (error) {
      console.error('Create warehouse error:', error);
      if (error.code === '23505') {
        throw new BadRequestException(
          'A warehouse with this name already exists',
        );
      }
      throw new InternalServerErrorException(
        error.message || 'Failed to create warehouse',
      );
    }

    return { warehouse: data };
  }

  @Get('warehouses/:warehouseId')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.warehouseReadAccess)
  async getWarehouse(
    @CurrentUser() currentUser: CurrentUserDto,
    @Param() params: { warehouseId: string },
  ) {
    console.log(params.warehouseId, '<--warehouse');
    const warehouse = await this.warehouseService.getWarehouseById(
      params.warehouseId,
      currentUser.organizationId,
    );

    if (!warehouse) {
      throw new BadRequestException('Warehouse not found');
    }

    return { warehouse };
  }

  @Post('warehouses/:warehouseId/add-stocks')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.warehouseWriteAccess)
  async addStock(
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: UpdateStockDto,
    @Param() params: { warehouseId: string },
  ) {
    return this.warehouseService.addStockToWarehouse(
      currentUser.organizationId,
      body.supplierMaterialId,
      params.warehouseId,
      body.quantity,
    );
  }

  @Post('warehouses/:warehouseId/remove-stocks')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  @RequirePermissions(PermissionsNames.warehouseWriteAccess)
  async removeStock(
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: RemoveStockDto,
    @Param() params: { warehouseId: string },
  ) {
    return this.warehouseService.removeStockFromWarehouse(
      currentUser.organizationId,
      body.materialId,
      params.warehouseId,
      body.quantity,
    );
  }
}
