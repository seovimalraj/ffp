import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { RoleNames, SQLFunctions, Tables } from '../../libs/constants';
import { SupabaseService } from 'src/supabase/supabase.service';
import { CurrentUserDto } from 'src/auth/auth.dto';
import { CreateOrderDocumentDto, UpdateOrderDocumentDto } from './order.dto';
import { TemporalService } from 'src/temporal/temporal.service';

interface GetOrdersParams {
  organizationId: string | null;
  status?: string;
  paymentStatus?: string;
  rfqId?: string;
  limit: number;
  offset: number;
}

interface GetOrdersInfiniteParams {
  role: string;
  organizationId: string | null;
  status?: string;
  paymentStatus?: string;
  rfqId?: string;
  limit: number;
  cursorCreatedAt?: string;
  cursorId?: string;
  search?: string;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly temporalService: TemporalService,
  ) {}
  async getOrders(params: GetOrdersParams) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc(SQLFunctions.getOrders, {
      p_organization_id: params.organizationId,
      p_status: params.status ?? null,
      p_payment_status: params.paymentStatus ?? null,
      p_rfq_id: params.rfqId ?? null,
      p_limit: params.limit,
      p_offset: params.offset,
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async getOrdersInfinite(params: GetOrdersInfiniteParams) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc(SQLFunctions.getOrdersInfinite, {
      p_organization_id: params.organizationId,
      p_status: params.status ?? null,
      p_payment_status: params.paymentStatus ?? null,
      p_rfq_id: params.rfqId ?? null,
      p_limit: params.limit,
      p_cursor_created_at: params.cursorCreatedAt ?? null,
      p_cursor_id: params.cursorId ?? null,
      p_search: params.search ?? null,
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (params.role === 'customer' && data?.data) {
      data.data.forEach((order: any) => {
        delete order.assigned_supplier;
        delete order.supplier_name;
      });
    }

    return data;
  }

  async getOrderById(id: string, organizationId: string, role?: string) {
    const client = this.supabaseService.getClient();

    // 1. Parallelize the fetching (don't 'await' them one after another)
    const orderPromise = client.rpc(SQLFunctions.getOrderDetails, {
      p_order_id: id,
      p_organization_id: organizationId,
    });

    let requestsPromise: any = Promise.resolve({
      data: [] as any[],
      error: null as any,
    });

    if (role !== 'customer') {
      requestsPromise = client
        .from(Tables.OrderStatusChangeRequests)
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: false }); // <--- OPTIMIZATION 1: DB Sorting

      if (role !== 'admin') {
        // @ts-ignore - appending to the query
        requestsPromise = requestsPromise.eq('supplier_id', organizationId);
      }
    }

    // OPTIMIZATION 2: Run all queries in parallel
    const [
      { data: orderData, error: orderErr },
      { data: reqData, error: reqErr },
      { data: quoteRequestData, error: quoteErr },
    ] = await Promise.all([
      orderPromise,
      requestsPromise,
      client
        .from(Tables.QuoteRequest)
        .select(
          '*, contact_user:users(name, email), supplier:organizations(name)',
        )
        .eq('order_id', id)
        .eq('status', 'requested')
        .maybeSingle(),
    ]);

    if (orderErr || reqErr || quoteErr)
      throw new InternalServerErrorException('Data fetch failed');

    // OPTIMIZATION 3: O(n) Grouping (Linear time)
    const partRequestsMap: Record<string, any[]> = {};
    if (reqData) {
      for (const req of reqData) {
        if (!partRequestsMap[req.part_id]) {
          partRequestsMap[req.part_id] = [];
        }
        partRequestsMap[req.part_id].push(req);
      }
    }

    const result: any = { ...orderData, requests: partRequestsMap };

    // Attach quote request if no supplier is assigned yet
    if (!orderData.supplier && quoteRequestData) {
      result.quote_request = quoteRequestData;
    }

    return result;
  }

  async updateOrderPartStatus(
    id: string,
    status: string,
    currentUser: CurrentUserDto,
    notes?: string,
    documents?: string[],
  ) {
    const client = this.supabaseService.getClient();

    // 1. Fetch current status and order ID before updating
    const { data: partData, error: fetchError } = await client
      .from(Tables.OrderPartsTable)
      .select('status, order_id')
      .eq('id', id)
      .single();

    if (fetchError || !partData) {
      throw new InternalServerErrorException(
        fetchError?.message || 'Part not found',
      );
    }

    const prevStatus = partData.status;
    const orderId = partData.order_id;

    // 2. Perform the update
    const { data, error } = await client.rpc(
      SQLFunctions.updateOrderPartStatus,
      {
        p_order_part_id: id,
        p_new_status: status,
        p_changed_by: currentUser.id,
        p_reason: notes ?? null,
        p_metadata: null,
      },
    );

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    // 3. Trigger Temporal workflow asynchronously
    this.temporalService
      .startOrderPartStatusChangeWorkflow({
        orderId,
        orderPartId: id,
        prevStatus,
        currentStatus: status,
        notes,
        documents,
      })
      .catch((err) => {
        this.logger.error('Failed to trigger status change workflow', err);
      });

    return data;
  }

  async getOrderDocuments(id: string, role: RoleNames) {
    const client = this.supabaseService.getClient();

    // Define base select
    let selectQuery = '*';
    if (role === 'admin') {
      selectQuery = `*, users( name, email, organizations( name ) )`;
    }

    let query = client
      .from(Tables.OrderDocumentsTable)
      .select(selectQuery)
      .eq('order_id', id)
      .order('created_at', { ascending: false });

    // Apply visibility filter only for non-admins
    if (role !== 'admin') {
      const visibility = ['global', role];
      query = query.in('visibility', visibility);
    }

    const { data, error } = await query;

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data ?? [];
  }

  async getOrderStatuses(userId: string | null) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client.rpc(
      SQLFunctions.getOrderStatusSummary,
      {
        p_user_id: userId,
      },
    );

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async createOrderDocument(
    order_id: string,
    document: CreateOrderDocumentDto,
    _currentUser: CurrentUserDto,
  ) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(Tables.OrderDocumentsTable)
      .insert({
        ...document,
        order_id,
      });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    try {
      const { data: orderWithUser, error: orderError } = await client
        .from(Tables.OrdersTable)
        .select('users!created_by(name, email)')
        .eq('id', order_id)
        .single();

      if (orderError) {
        throw orderError;
      }

      const orderUser = Array.isArray(orderWithUser.users)
        ? orderWithUser.users[0]
        : orderWithUser.users;

      if (orderUser) {
        await this.temporalService.sendEmail({
          to: orderUser.email,
          subject: 'New Document was uploaded',
          type: 'document',
          metadata: {
            username: orderUser.name,
            orderId: order_id,
            filename: document.file_name,
            path: document.document_url,
          },
          attachments: [
            { filename: document.file_name, path: document.document_url },
          ],
        });
      }
    } catch (error) {
      this.logger.error({ error }, 'Error while sending document email');
    }

    return data;
  }

  async updateOrderDocument(id: string, update: UpdateOrderDocumentDto) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.OrderDocumentsTable)
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }
}
