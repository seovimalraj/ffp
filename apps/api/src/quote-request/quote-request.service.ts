import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { TemporalService } from 'src/temporal/temporal.service';
import { Tables, RoleNames } from '../../libs/constants';
import { CreateQuoteRequestDTO } from './quote-request.dto';

@Injectable()
export class QuoteRequestService {
  private readonly logger = new Logger(QuoteRequestService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly temporalService: TemporalService,
  ) {}

  async createQuoteRequest(body: CreateQuoteRequestDTO, user: any) {
    const client = this.supabaseService.getClient();

    const {
      data: _,
      error,
      count,
    } = await client
      .from(Tables.QuoteRequest)
      .select('id', { count: 'exact', head: true })
      .eq('order_id', body.order_id)
      .in('status', ['requested', 'accepted'])
      .limit(1);

    if (error) {
      this.logger.error(
        { error },
        'Error while checking existing Quote requests',
      );
      throw new InternalServerErrorException(error.message);
    }

    if (count > 0) {
      throw new BadRequestException('Quote Request already exists');
    }

    const { data, error: QuoteRequestError } = await client
      .from(Tables.QuoteRequest)
      .insert({
        order_id: body.order_id,
        supplier_id: body.supplier_id,
        contact_user: body.contact_user,
        notes: body?.notes || '',
      })
      .select()
      .single();

    if (QuoteRequestError) {
      this.logger.error(
        { QuoteRequestError },
        'Error while creating Quote request',
      );
      throw new InternalServerErrorException(QuoteRequestError.message);
    }

    // Insert 'created' event
    await this.logEvent(data.id, 'created', user.id);

    // Start Temporal workflow for notifications
    await this.temporalService.startQuoteRequestWorkflow(data.id);

    return data;
  }

  async getQuoteRequests(user: any, page: number = 1, limit: number = 10) {
    const client = this.supabaseService.getClient();

    const offset = (page - 1) * limit;

    let query = client.from(Tables.QuoteRequest).select(
      `
        id,
        status,
        created_at,
        order:orders(order_code),
        supplier:organizations(name)
        `,
      { count: 'exact' },
    );

    if (user.role === RoleNames.Supplier) {
      query = query.eq('supplier_id', user.organizationId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error({ error }, 'Error fetching quote requests');
      throw new InternalServerErrorException(error.message);
    }

    return {
      data,
      count,
      page,
      limit,
    };
  }

  async getQuoteRequestsByOrderId(orderId: string) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.QuoteRequest)
      .select('*, supplier:organizations(name, display_name), events:quote_request_event(*)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        { error },
        `Error fetching quote requests for order ${orderId}`,
      );
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async getQuoteRequestById(id: string, user: any) {
    const client = this.supabaseService.getClient();

    let query = client
      .from(Tables.QuoteRequest)
      .select(
        `
        *,
        order:orders(
            id,
            order_code,
            created_at,
            status,
            address_snapshot
        )
        `,
      )
      .eq('id', id);

    if (user.role === RoleNames.Supplier) {
      query = query.eq('supplier_id', user.organizationId);
    }

    const { data: quoteRequest, error } = await query.single();

    if (error) {
      this.logger.error({ error }, `Error fetching quote request ${id}`);
      throw new InternalServerErrorException(error.message);
    }

    const { data: parts, error: partsError } = await client
      .from(Tables.OrderPartsTable)
      .select(
        `
        order_part_id:id,
        quantity,
        status,
        order_part_code:part_code,
        rfq_part:rfq_parts(
            file_name,
            material,
            finish,
            tolerance,
            inspection,
            notes,
            cad_file_url,
            snapshot_2d_url
        )
        `,
      )
      .eq('order_id', quoteRequest.order_id);

    if (partsError) {
      this.logger.error(
        { partsError },
        `Error fetching parts for order ${quoteRequest.order_id}`,
      );
      throw new InternalServerErrorException(partsError.message);
    }

    // Fetch shipping information
    const { data: shipping, error: shippingError } = await client
      .from(Tables.OrderShippingTable)
      .select('*')
      .eq('order_id', quoteRequest.order_id)
      .maybeSingle();

    if (shippingError) {
      this.logger.warn({ shippingError }, 'Error fetching shipping information');
    }

    return {
      ...quoteRequest,
      parts: parts || [],
      shipping: shipping || null,
    };
  }

  async acceptQuoteRequest(id: string, user: any) {
    return this.updateStatus(id, user, 'accepted');
  }

  async declineQuoteRequest(id: string, user: any, reason: string) {
    return this.updateStatus(id, user, 'declined', reason);
  }

  async cancelQuoteRequest(id: string, user: any, reason: string) {
    return this.updateStatus(id, user, 'cancelled', reason);
  }

  private async updateStatus(
    id: string,
    user: any,
    status: 'accepted' | 'declined' | 'cancelled',
    reason?: string,
  ) {
    const client = this.supabaseService.getClient();

    const updateData: any = {
      status,
    };

    if (status === 'accepted' || status === 'declined') {
      updateData.responded_at = new Date().toISOString();
      if (status === 'declined') {
        updateData.reject_reason = reason;
      }
    } else if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancel_reason = reason;
    }

    let query = client
      .from(Tables.QuoteRequest)
      .update(updateData)
      .eq('id', id);

    // Supplier can only accept/decline their own
    if (user.role === RoleNames.Supplier) {
      if (status === 'cancelled') {
        throw new BadRequestException('Suppliers cannot cancel quote requests');
      }
      query = query.eq('supplier_id', user.organizationId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      this.logger.error(
        { error, updateData },
        'Error updating quote request status',
      );
      throw new InternalServerErrorException(error.message);
    }

    // Log the event
    await this.logEvent(id, status, user.id, { reason });

    // Signal Temporal workflow if it's a supplier response
    if (status === 'accepted' || status === 'declined') {
      await this.temporalService.signalQuoteRequestWorkflow(
        `quote-request-${id}`,
        status,
      );
      if (status === 'accepted') {
        const { data: _, error: OrderError } = await client
          .from(Tables.OrdersTable)
          .update({
            assigned_supplier: user.organizationId,
          })
          .eq('id', data.order_id);

        if (OrderError) {
          throw new InternalServerErrorException(OrderError.message);
        }
      }
    }

    return data;
  }

  private async logEvent(
    quoteRequestId: string,
    eventType: string,
    actorId: string | null,
    metadata: any = {},
  ) {
    const client = this.supabaseService.getClient();
    const { error } = await client.from(Tables.QuoteRequestEvent).insert({
      quote_request_id: quoteRequestId,
      event_type: eventType,
      actor_id: actorId,
      metadata,
    });

    if (error) {
      this.logger.warn({ error }, 'Failed to log quote request event');
    }
  }
}
