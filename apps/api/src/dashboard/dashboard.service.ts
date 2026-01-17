import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Tables } from '../../libs/constants';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  constructor(private readonly supabaseService: SupabaseService) {}

  async getStats(organizationId: string, userId: string) {
    const client = this.supabaseService.getClient();

    // 1. Active Quotes
    const { count: activeQuotes, error: quoteError } = await client
      .from(Tables.RFQTable)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .neq('status', 'paid');

    if (quoteError)
      this.logger.error(`Error fetching active quotes: ${quoteError.message}`);

    // Open Orders (anything not completed)
    const { count: openOrders, error: orderError } = await client
      .from(Tables.OrdersTable)
      .select('id', { count: 'exact', head: true })
      .neq('status', 'completed')
      .eq('organization_id', organizationId);

    if (orderError)
      this.logger.error(`Error fetching open orders: ${orderError.message}`);

    // 3. Total Spent
    const { data: spentData, error: spentError } = await client
      .from(Tables.OrdersTable)
      .select('total_amount')
      .eq('organization_id', organizationId)
      .eq('payment_status', 'paid');

    if (spentError)
      this.logger.error(`Error fetching total spent: ${spentError.message}`);

    const totalSpent =
      spentData?.reduce((sum, order) => sum + Number(order.total_amount), 0) ||
      0;

    // 4. Calculate actual average lead time from completed orders
    const { data: completedOrders } = await client
      .from(Tables.OrdersTable)
      .select('created_at, updated_at, lead_time_days')
      .eq('organization_id', organizationId)
      .in('status', ['completed', 'delivered'])
      .order('updated_at', { ascending: false })
      .limit(20);

    let avgLeadTime = 5.2; // Default fallback
    if (completedOrders && completedOrders.length > 0) {
      // Calculate from lead_time_days if available, otherwise calculate from dates
      const leadTimes = completedOrders.map(order => {
        if (order.lead_time_days) {
          return order.lead_time_days;
        }
        // Calculate from date difference
        const created = new Date(order.created_at);
        const completed = new Date(order.updated_at);
        return Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }).filter(days => days > 0 && days < 60); // Filter outliers

      if (leadTimes.length > 0) {
        avgLeadTime = leadTimes.reduce((sum, days) => sum + days, 0) / leadTimes.length;
        avgLeadTime = Math.round(avgLeadTime * 10) / 10; // Round to 1 decimal
      }
    }

    return {
      activeQuotes: activeQuotes || 0,
      openOrders: openOrders || 0,
      totalSpent: `$${totalSpent.toLocaleString()}`,
      avgLeadTime: `${avgLeadTime} days`,
    };
  }

  async getRecentQuotes(_organizationId: string, userId: string) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.RFQTable)
      .select(
        `
        id,
        rfq_code,
        status,
        final_price,
        created_at
      `,
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      this.logger.error(`Error fetching recent quotes: ${error.message}`);
      return [];
    }

    return data.map((rfq) => ({
      id: rfq.id,
      rfq_code: rfq.rfq_code,
      description: 'Project Component',
      status: rfq.status || 'pending_review',
      amount: rfq.final_price
        ? `$${Number(rfq.final_price).toLocaleString()}`
        : '---',
      date: new Date(rfq.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      parts: 1,
    }));
  }

  async getRecentOrders(organizationId: string) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(Tables.OrdersTable)
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      this.logger.error(`Error fetching recent orders: ${error.message}`);
      return [];
    }

    return data.map((order) => ({
      id: order.id,
      order_code: order.order_code,
      description: 'Order Items',
      status: order.status,
      amount: `$${Number(order.total_amount).toLocaleString()}`,
      dueDate: order.estimated_delivery_date
        ? new Date(order.estimated_delivery_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '---',
      progress:
        order.status === 'completed'
          ? 100
          : order.status === 'shipped'
            ? 100
            : 70,
    }));
  }
}
