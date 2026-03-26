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
  Query,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SupplierOrderService } from './supplier-order.service';
import {
  PermissionsNames,
  RoleNames,
  SQLFunctions,
  Tables,
} from '../../libs/constants';
import { CurrentUserDto } from 'src/auth/auth.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { CurrentUser } from 'src/auth/user.decorator';
import { RequirePermissions } from 'src/permissions/permissions.decorator';
import { SupabaseService } from 'src/supabase/supabase.service';
import {
  CreateSupplierMaterialDto,
  CreateWarehouseDto,
  RemoveStockDto,
  StatusChangeRequestDto,
  UpdateStockDto,
} from './supplier.dto';
import { WarehouseService } from './warehouse.service';
import { generateUUID } from '../../libs/helpers';
import { TemporalService } from '../temporal/temporal.service';

@Controller('supplier')
@UseGuards(AuthGuard)
export class SupplierController {
  private readonly logger = new Logger(SupplierController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly warehouseService: WarehouseService,
    private readonly supplierOrderService: SupplierOrderService,
    private readonly temporalService: TemporalService,
  ) {}

  @Get('orders')
  @Roles(RoleNames.Supplier)
  async getSupplierOrders(
    @CurrentUser() currentUser: CurrentUserDto,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('rfqId') rfqId?: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    return this.supplierOrderService.getSupplierOrders({
      supplierId: currentUser.organizationId,
      status,
      paymentStatus,
      rfqId,
      limit: Number(limit),
      offset: Number(offset),
    });
  }

  @Get('orders/infinite')
  @Roles(RoleNames.Supplier)
  async getSupplierOrdersInfinite(
    @CurrentUser() currentUser: CurrentUserDto,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('rfqId') rfqId?: string,
    @Query('limit') limit = '20',
    @Query('cursorCreatedAt') cursorCreatedAt?: string,
    @Query('cursorId') cursorId?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.supplierOrderService.getSupplierOrdersInfinite({
      supplierId: currentUser.organizationId,
      status,
      paymentStatus,
      rfqId,
      limit: Number(limit),
      cursorCreatedAt,
      cursorId,
      search,
    });

    return {
      success: true,
      ...data,
    };
  }

  @Get('orders-summary')
  @Roles(RoleNames.Supplier)
  async getOrdersSummary(@CurrentUser() user: CurrentUserDto) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client.rpc(
      SQLFunctions.getSupplierOrderMetrics,
      {
        p_user_id: user.id,
      },
    );

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { statuses: data, success: true };
  }

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

  @Post(':orderId/request-status-change/:partId')
  @Roles(RoleNames.Supplier)
  async requestOrderPartStatusChange(
    @Param('partId', ParseUUIDPipe) partId: string, // Validates UUID format automatically
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: StatusChangeRequestDto,
  ) {
    const client = this.supabaseService.getClient();

    // Destructure from DTO
    const { status_from, status_to, comments, attachments } = body;

    this.logger.debug({
      order_id: orderId,
      part_id: partId,
      supplier_id: currentUser.id,
      status_from,
      status_to,
      comments,
      attachments,
      status: 'active',
    });

    const { data: oscr, error } = await client
      .from(Tables.OrderStatusChangeRequests)
      .insert({
        order_id: orderId,
        part_id: partId,
        supplier_id: currentUser.organizationId,
        status_from,
        status_to,
        comments,
        attachments: attachments || [],
        status: 'active',
      })
      .select() // REQUIRED to return the data
      .single();

    if (error) {
      this.logger.error(`Status change error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Error while creating Order status change request',
      );
    }

    // 2. Start Temporal Workflow
    try {
      const workflowHandle =
        await this.temporalService.startOrderStatusChangeRequestWorkflow({
          requestId: oscr.id,
          supplierEmail: currentUser.email,
        });

      // 3. Update the request with workflow_id
      await client
        .from(Tables.OrderStatusChangeRequests)
        .update({ workflow_id: workflowHandle.workflowId })
        .eq('id', oscr.id);

      return {
        success: true,
        oscr: { ...oscr, workflow_id: workflowHandle.workflowId },
      };
    } catch (workflowError) {
      this.logger.error(
        `Failed to start status change workflow: ${workflowError.message}`,
      );
      // We return the oscr even if workflow fails to start, but maybe we should throw?
      // For now, let's just return it as it's already in the DB.
      return {
        success: true,
        oscr,
      };
    }
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
