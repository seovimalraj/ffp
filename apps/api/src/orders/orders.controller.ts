import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
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
} from './order.dto';
import { ShippingAddressService } from './shipping-address.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { RoleNames, SQLFunctions } from '../../libs/constants';
import { OrderService } from './order.service';
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

  @Get(':id')
  async getOrder(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserDto,
  ) {
    return this.ordersService.getOrderById(id, currentUser.organizationId);
  }

  @Get(':id/documents')
  async getDocuments(@Param('id') id: string) {
    return this.ordersService.getOrderDocuments(id);
  }

  @Post(':id/documents')
  @Roles(RoleNames.Admin)
  async createDocument(
    @Param('id') id: string,
    @Body() body: CreateOrderDocumentDto,
  ) {
    return this.ordersService.createOrderDocument(id, body);
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

      console.log(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET,
      );

      const tokenRes = await fetch(
        'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${auth}`,
          },
          body: 'grant_type=client_credentials',
        },
      );

      console.log(tokenRes);

      const { access_token } = await tokenRes.json();
      console.log(access_token);
      // 2. Capture Order
      const captureRes = await fetch(
        `https://api-m.sandbox.paypal.com/v2/checkout/orders/${body.orderID}/capture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const captureData = await captureRes.json();
      console.log(captureData);

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
    );

    return { success: true };
  }
}
