import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { CurrentUser } from 'src/auth/user.decorator';
import { CurrentUserDto } from 'src/auth/auth.dto';
import {
  CreateOrderDocumentDto,
  CreateOrderDto,
  CreateShippingAddressDto,
  PayOrderDto,
  UpdateOrderPartStatusDto,
  CapturePaypalDto,
  RejectStatusDto,
  UpdateOrderDocumentDto,
} from './order.dto';
import { ShippingAddressService } from './shipping-address.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { RoleNames, SQLFunctions, Tables } from '../../libs/constants';
import { OrderService } from './order.service';
import { TemporalService } from 'src/temporal/temporal.service';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';

@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly shippingAddressService: ShippingAddressService,
    private readonly ordersService: OrderService,
    private readonly temporalService: TemporalService,
  ) {}

  @Get()
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async getOrders(
    @Req() req: Request,
    @CurrentUser() currentUser: CurrentUserDto,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('rfqId') rfqId?: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    const organizationId =
      currentUser.role === RoleNames.Admin ? null : currentUser.organizationId;

    return this.ordersService.getOrders({
      organizationId,
      status,
      paymentStatus,
      rfqId,
      limit: Number(limit),
      offset: Number(offset),
    });
  }

  @Get('infinite')
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async getOrdersInfinite(
    @CurrentUser() currentUser: CurrentUserDto,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('rfqId') rfqId?: string,
    @Query('limit') limit = '20',
    @Query('cursorCreatedAt') cursorCreatedAt?: string,
    @Query('cursorId') cursorId?: string,
    @Query('search') search?: string,
  ) {
    const organizationId =
      currentUser.role === RoleNames.Admin ? null : currentUser.organizationId;

    const data = await this.ordersService.getOrdersInfinite({
      role: currentUser.role,
      organizationId,
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
  @Roles(RoleNames.Admin, RoleNames.Customer)
  async getOrdersSummary(@CurrentUser() user: CurrentUserDto) {
    const data = await this.ordersService.getOrderStatuses(user.id || null);

    return { statuses: data, success: true };
  }

  @Post('shipping_address')
  async createShippingAddress(
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: CreateShippingAddressDto,
  ) {
    const { data, error } =
      await this.shippingAddressService.createShippingAddress(
        currentUser,
        body,
      );

    if (error) {
      this.logger.error(`Error creating shipping address: ${error.message}`);
      throw new InternalServerErrorException(
        `Error creating shipping address: ${error.message}`,
      );
    }

    return { data };
  }

  @Get('shipping_address')
  async getShippingAddress(@CurrentUser() currentUser: CurrentUserDto) {
    const { data, error } =
      await this.shippingAddressService.getShippingAddress(currentUser);

    if (error) {
      this.logger.error(`Error getting shipping address: ${error.message}`);
      throw new InternalServerErrorException(
        `Error getting shipping address: ${error.message}`,
      );
    }

    return { data };
  }

  @Delete('shipping_address/:id')
  async deleteShippingAddress(
    @CurrentUser() currentUser: CurrentUserDto,
    @Param('id') id: string,
  ) {
    const { data, error } =
      await this.shippingAddressService.deleteShippingAddress(currentUser, id);

    if (error) {
      this.logger.error(`Error deleting shipping address: ${error.message}`);
      throw new InternalServerErrorException(
        `Error deleting shipping address: ${error.message}`,
      );
    }

    return { data };
  }

  @Post('tracking/:orderId')
  async updateTrackingNumber(
    @Body() body: { trackingNumber: string },
    @Param('orderId') orderId: string,
  ) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(Tables.OrderShippingTable)
      .update({
        tracking_number: body.trackingNumber,
      })
      .eq('order_id', orderId);

    if (error) {
      this.logger.error(`Error updating tracking number: ${error.message}`);
      throw new InternalServerErrorException(
        `Error updating tracking number: ${error.message}`,
      );
    }

    return { data };
  }

  @Get('/status-change-request/:orderId')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  async getOrderStatusChangeRequest(
    @Param('orderId') orderId: string,
    // @CurrentUser() currentUser: CurrentUserDto
  ) {
    if (!orderId) {
      throw new BadRequestException('Order Id is required');
    }

    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.OrderStatusChangeRequests)
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        { error },
        'Error while fetching order status change requests',
      );
    }

    return {
      success: true,
      data: data ?? [],
    };
  }

  @Get(':id')
  async getOrder(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserDto,
  ) {
    return this.ordersService.getOrderById(
      id,
      currentUser.organizationId,
      currentUser.role,
    );
  }

  @Get(':id/documents')
  async getOrderDocuments(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserDto,
  ) {
    return this.ordersService.getOrderDocuments(id, currentUser.role);
  }

  @Post(':id/documents')
  async createDocument(
    @Param('id') id: string,
    @Body() body: CreateOrderDocumentDto,
    @CurrentUser() currentUser: CurrentUserDto,
  ) {
    return this.ordersService.createOrderDocument(id, body, currentUser);
  }

  @Patch(':id/documents')
  @Roles(RoleNames.Admin)
  async updateOrderDocument(
    @Param('id') id: string,
    @Body() body: UpdateOrderDocumentDto,
  ) {
    return this.ordersService.updateOrderDocument(id, body);
  }

  @Post('')
  async createOrder(
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: CreateOrderDto,
  ) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc(SQLFunctions.createOrder, {
      p_organization_id: currentUser.organizationId,
      p_created_by: currentUser.id,
      p_rfq_id: body.rfqId,
      p_parts: body.parts,
      p_subtotal: body.subtotal,
      p_shipping_cost: body.shippingCost,
      p_tax_amount: body.taxAmount,
      p_customs_info: body.customsInfo,
      p_shipping_method: body.shippingMethod,
      p_internal_notes: body.internalNotes,
      p_shipping_information: body.shippingInformation,
      p_address_snapshot: body.addressSnapshot,
    });

    if (error) {
      this.logger.error(`Error creating order: ${error.message}`);
      throw new InternalServerErrorException(
        `Error creating order: ${error.message}`,
      );
    }

    return { data };
  }

  @Post(':id/failure')
  async markOrderAsFailure(
    @CurrentUser() currentUser: CurrentUserDto,
    @Param('id') id: string,
  ) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc(SQLFunctions.markOrderAsFailure, {
      p_order_id: id,
    });

    if (error) {
      this.logger.error(`Error marking order as failure: ${error.message}`);
      throw new InternalServerErrorException(
        `Error marking order as failure: ${error.message}`,
      );
    }

    return { data };
  }

  @Post(':id/pay')
  async payOrder(
    @CurrentUser() currentUser: CurrentUserDto,
    @Param('id') id: string,
    @Body() body: PayOrderDto,
  ) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc(SQLFunctions.markOrderPaid, {
      p_order_id: id,
      p_payment_gateway: body.paymentMethod,
      p_transaction_id: body.transactionId || 'MANUAL',
      p_amount_captured: body.amount,
      p_billing_snapshot: body.billingSnapshot || {
        name: currentUser.email,
        email: currentUser.email,
        address: 'N/A',
      },
    });
    if (error) {
      this.logger.error(`Error paying order: ${error.message}`);
      throw new InternalServerErrorException(
        `Error paying order: ${error.message}`,
      );
    }
    return { data };
  }

  @Post(':id/paypal-capture')
  async capturePaypal(
    @CurrentUser() currentUser: CurrentUserDto,
    @Param('id') id: string,
    @Body() body: CapturePaypalDto,
  ) {
    try {
      // 1. Get Access Token
      const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
      ).toString('base64');
      const paypalUrl =
        process.env.PAYPAL_API_URL || 'https://api-m.paypal.com';
      const tokenRes = await fetch(`${paypalUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
        body: 'grant_type=client_credentials',
      });

      const { access_token } = await tokenRes.json();
      // 2. Capture Order
      const captureRes = await fetch(
        `${paypalUrl}/v2/checkout/orders/${body.orderID}/capture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const captureData = await captureRes.json();

      if (captureData.status !== 'COMPLETED') {
        throw new Error('PayPal capture failed');
      }

      // 3. Mark as Paid using internal RPC
      const client = this.supabaseService.getClient();
      const resource = captureData.purchase_units[0].payments.captures[0];

      const { data, error } = await client.rpc(SQLFunctions.markOrderPaid, {
        p_order_id: id,
        p_payment_gateway: 'paypal',
        p_transaction_id: resource.id,
        p_amount_captured: parseFloat(resource.amount.value),
        p_billing_snapshot: {
          email: currentUser.email,
          paypal_order_id: body.orderID,
          payer: captureData.payer,
        },
      });

      if (error) throw error;

      return { success: true, order: data };
    } catch (err) {
      this.logger.error(`PayPal capture error: ${err.message}`);
      throw new InternalServerErrorException(`Payment failed: ${err.message}`);
    }
  }

  @Post('paypal-webhook')
  async paypalWebhook(@Body() body: any) {
    try {
      this.logger.log(`PayPal Webhook received: ${body.event_type}`);

      if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const orderId = body.resource.custom_id;
        const transactionId = body.resource.id;
        const amount = body.resource.amount.value;

        if (orderId) {
          const client = this.supabaseService.getClient();
          // Note: Use a service role client if RLS is enabled and this is a public webhook
          // For now assuming the service client has permission or we're using a bypass.
          const { error } = await client.rpc(SQLFunctions.markOrderPaid, {
            p_order_id: orderId,
            p_payment_gateway: 'paypal',
            p_transaction_id: transactionId,
            p_amount_captured: parseFloat(amount),
            p_billing_snapshot: body.resource.payer || {},
          });

          if (error)
            this.logger.error(`Webhook DB update failed: ${error.message}`);
        }
      }

      return { received: true };
    } catch (err) {
      this.logger.error(`Webhook error: ${err.message}`);
      return { received: true }; // Always return 200 to PayPal
    }
  }

  @Post(':orderId/assign-supplier')
  @Roles(RoleNames.Admin)
  async assignSupplierToOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: { supplierId: string; email: string },
  ) {
    const client = this.supabaseService.getClient();
    const { supplierId, email } = body;

    if (!supplierId) {
      throw new BadRequestException('supplierId is required');
    }

    if (!email) {
      throw new BadRequestException('email is required');
    }

    const { data, error } = await client.rpc('assign_supplier_to_order', {
      p_order_id: orderId,
      p_supplier_id: supplierId,
      p_assigned_by: currentUser.id,
    });

    if (error) {
      this.logger.error(
        { orderId, supplierId, error },
        'Error assigning supplier to order',
      );

      throw new InternalServerErrorException(error.message);
    }

    const assignment = data?.[0];

    // Start workflow (non-blocking)
    try {
      await this.temporalService.startSupplierAssignmentWorkflow({
        orderId,
        supplierEmail: body.email,
      });
    } catch (workflowError) {
      this.logger.error(
        { orderId, supplierId, workflowError },
        'Failed to start supplier assignment workflow',
      );
    }

    return {
      success: true,
      message: 'Supplier assigned successfully',
      data: assignment,
    };
  }

  @Patch('/part/:partId')
  async updateOrderPartStatus(
    @CurrentUser() currentUser: CurrentUserDto,
    @Param('partId') partId: string,
    @Body() body: UpdateOrderPartStatusDto,
  ) {
    await this.ordersService.updateOrderPartStatus(
      partId,
      body.status,
      currentUser,
      body.notes,
      body.documents,
    );

    return { success: true };
  }

  @Patch('status-requests/:requestId/approve')
  @Roles(RoleNames.Admin)
  async approveRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: { notes?: string; attachments: string[] },
  ) {
    const client = this.supabaseService.getClient();

    // 1. Fetch the request to get the target status and part_id
    const { data: request, error: fetchError } = await client
      .from(Tables.OrderStatusChangeRequests)
      .select(
        'part_id, status_to, workflow_id, order_id, status_from, status_to',
      )
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      throw new NotFoundException('Status change request not found');
    }

    // 2. Update the Request record AND the Order Part record
    // Using a simple Promise.all or sequential updates (Supabase RPC is better for transactions)
    const { error: updateRequestError } = await client
      .from(Tables.OrderStatusChangeRequests)
      .update({
        status: 'approved',
        approved_by: currentUser.id,
        reviwed_at: new Date().toISOString(), // Matching your SQL typo "reviwed_at"
      })
      .eq('id', requestId);

    if (updateRequestError)
      throw new InternalServerErrorException('Failed to update request');

    // 3. Signal Temporal Workflow
    if (request.workflow_id) {
      try {
        await this.temporalService.signalOrderStatusChangeRequestWorkflow(
          request.workflow_id,
          'approve',
        );
      } catch (signalError) {
        this.logger.error(
          `Failed to signal approve to workflow ${request.workflow_id}: ${signalError.message}`,
        );
      }
    }

    // 4. Update the part status and start status change workflow
    // using the existing service method to avoid duplication
    await this.ordersService.updateOrderPartStatus(
      request.part_id,
      request.status_to,
      currentUser,
      body.notes,
      body.attachments,
    );

    return { success: true, message: 'Status change approved and applied.' };
  }

  @Patch('status-requests/:requestId/reject')
  @Roles(RoleNames.Admin)
  async rejectRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() body: RejectStatusDto,
  ) {
    const client = this.supabaseService.getClient();

    // 1. Fetch the request to get workflow_id
    const { data: request, error: fetchError } = await client
      .from(Tables.OrderStatusChangeRequests)
      .select('workflow_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      throw new NotFoundException('Status change request not found');
    }

    const { error } = await client
      .from(Tables.OrderStatusChangeRequests)
      .update({
        status: 'rejected',
        rejection_reason: body.rejection_reason,
        reviwed_at: new Date().toISOString(),
        // Note: You might want to track who rejected it in approved_by or a new rejected_by column
      })
      .eq('id', requestId);

    if (error) {
      this.logger.error(`Rejection error: ${error.message}`);
      throw new InternalServerErrorException('Could not reject request');
    }

    // 2. Signal Temporal Workflow
    if (request.workflow_id) {
      try {
        await this.temporalService.signalOrderStatusChangeRequestWorkflow(
          request.workflow_id,
          'reject',
        );
      } catch (signalError) {
        this.logger.error(
          `Failed to signal reject to workflow ${request.workflow_id}: ${signalError.message}`,
        );
      }
    }

    return { success: true, message: 'Status change request rejected.' };
  }
}
