import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SQLFunctions, Tables } from '../../libs/constants';
import { SupabaseService } from 'src/supabase/supabase.service';
import { CurrentUserDto } from 'src/auth/auth.dto';
import { CreateOrderDocumentDto } from './order.dto';
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

    return data;
  }

  async getOrderById(id: string, organizationId: string) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc(SQLFunctions.getOrderDetails, {
      p_order_id: id,
      p_organization_id: organizationId,
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async updateOrderPartStatus(
    id: string,
    status: string,
    currentUser: CurrentUserDto,
    notes?: string,
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
      })
      .catch((err) => {
        this.logger.error('Failed to trigger status change workflow', err);
      });

    return data;
  }

  async getOrderDocuments(id: string) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(Tables.OrderDocumentsTable)
      .select('*')
      .eq('order_id', id);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
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

    return data;
  }
}
