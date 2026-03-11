import { SupabaseService } from 'src/supabase/supabase.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SQLFunctions } from '../../libs/constants';

interface GetSupplierOrdersParams {
  supplierId: string;
  status?: string;
  paymentStatus?: string;
  rfqId?: string;
  limit: number;
  offset: number;
}

interface GetSupplierOrdersInfiniteParams {
  supplierId: string;
  status?: string;
  paymentStatus?: string;
  rfqId?: string;
  limit: number;
  cursorCreatedAt?: string;
  cursorId?: string;
  search?: string;
}

@Injectable()
export class SupplierOrderService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getSupplierOrders(params: GetSupplierOrdersParams) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client.rpc(SQLFunctions.getOrders, {
      p_supplier_id: params.supplierId,
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

  async getSupplierOrdersInfinite(params: GetSupplierOrdersInfiniteParams) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client.rpc(SQLFunctions.getOrdersInfinite, {
      p_supplier_id: params.supplierId,
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
}
