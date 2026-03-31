import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { Tables } from '../../libs/constants';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getRevenueTrend(period: string = '180d') {
    const client = this.supabaseService.getClient();
    const days = parseInt(period) || 180;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Using raw SQL for aggregation via Supabase RPC or direct select with filters
    // For now, let's fetch orders and aggregate in memory to ensure correctly formatted response for ApexCharts
    const { data, error } = await client
      .from(Tables.OrdersTable)
      .select('total_amount, part_type, created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Error fetching revenue data: ${error.message}`);
      return { categories: [], cncData: [], sheetMetalData: [] };
    }

    // Group by month
    const months: Record<string, { cnc: number; sheetMetal: number }> = {};
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

    data.forEach((order) => {
      const date = new Date(order.created_at);
      const monthKey = monthFormatter.format(date);

      if (!months[monthKey]) {
        months[monthKey] = { cnc: 0, sheetMetal: 0 };
      }

      const amount = Number(order.total_amount) || 0;
      if (order.part_type?.toLowerCase().includes('cnc')) {
        months[monthKey].cnc += amount;
      } else if (order.part_type?.toLowerCase().includes('sheet')) {
        months[monthKey].sheetMetal += amount;
      } else {
        // Default to CNC for now if unknown as it's the primary business
        months[monthKey].cnc += amount;
      }
    });

    const categories = Object.keys(months);
    const cncData = categories.map((month) => months[month].cnc);
    const sheetMetalData = categories.map((month) => months[month].sheetMetal);

    return { categories, cncData, sheetMetalData };
  }

  async getOrderStatusDistribution() {
    const client = this.supabaseService.getClient();
    
    const { data, error } = await client
      .from(Tables.OrdersTable)
      .select('status');

    if (error) {
      this.logger.error(`Error fetching order status distribution: ${error.message}`);
      return { series: [], labels: [] };
    }

    const counts: Record<string, number> = {};
    data.forEach((order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const series = labels.map((label) => counts[label]);

    return { segments: labels.map((label, index) => ({ label, count: series[index] })) };
  }

  async getPlatformGrowth() {
    const client = this.supabaseService.getClient();
    const weeksToFetch = 12;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeksToFetch * 7));

    const [usersRes, orgsRes] = await Promise.all([
      client
        .from(Tables.UserTable)
        .select('created_at')
        .gte('created_at', startDate.toISOString()),
      client
        .from(Tables.OrganizationTable)
        .select('created_at, organization_type')
        .gte('created_at', startDate.toISOString())
    ]);

    if (usersRes.error || orgsRes.error) {
      this.logger.error('Error fetching platform growth data');
      return { categories: [], customerData: [], supplierData: [] };
    }

    const weeklyStats: Record<string, { customers: number; suppliers: number }> = {};
    const oneDay = 24 * 60 * 60 * 1000;

    // Initialize weeks
    for (let i = 0; i < weeksToFetch; i++) {
      const weekLabel = `Wk ${i + 1}`;
      weeklyStats[weekLabel] = { customers: 0, suppliers: 0 };
    }

    const getWeekLabel = (dateStr: string) => {
      const date = new Date(dateStr);
      const diffDays = Math.floor((date.getTime() - startDate.getTime()) / oneDay);
      const weekIndex = Math.floor(diffDays / 7);
      return `Wk ${Math.min(weeksToFetch, Math.max(1, weekIndex + 1))}`;
    };

    // Count Users as Customers (assuming mostly customers register directly)
    // Or filter by role if needed, but here we'll use Org table for more accurate "business" growth
    orgsRes.data.forEach(org => {
      const week = getWeekLabel(org.created_at);
      if (weeklyStats[week]) {
        if (org.organization_type === 'supplier') {
          weeklyStats[week].suppliers++;
        } else {
          weeklyStats[week].customers++;
        }
      }
    });

    const categories = Object.keys(weeklyStats);
    const customerData = categories.map(w => weeklyStats[w].customers);
    const supplierData = categories.map(w => weeklyStats[w].suppliers);

    return { categories, customerData, supplierData };
  }

  async getTopLevelStats() {
    const client = this.supabaseService.getClient();

    const [users, orgs, quotes, orders] = await Promise.all([
      client.from(Tables.UserTable).select('id', { count: 'exact', head: true }),
      client.from(Tables.OrganizationTable).select('id', { count: 'exact', head: true }),
      client.from(Tables.RFQTable).select('id', { count: 'exact', head: true }),
      client.from(Tables.OrdersTable).select('id', { count: 'exact', head: true }),
    ]);

    return {
      totalUsers: users.count || 0,
      totalOrgs: orgs.count || 0,
      totalQuotes: quotes.count || 0,
      totalOrders: orders.count || 0,
    };
  }

  async getRecentActivity() {
    const client = this.supabaseService.getClient();
    
    // Fetch latest events from order status history or RFQ events
    const { data: activity, error } = await client
      .from(Tables.OrderPartStatusHistoryTable)
      .select(`
        id,
        to_status,
        created_at,
        users(name),
        order_parts(order_id, rfq_parts(file_name))
      `)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      this.logger.error(`Error fetching activity: ${error.message}`);
      return [];
    }

    return activity.map(a => {
      const castedA = a as any;
      const fileName = castedA.order_parts?.rfq_parts?.file_name || 'unknown';
      const userName = castedA.users?.name || 'System';
      
      return {
        id: a.id,
        message: `Part ${fileName} moved to ${a.to_status}`,
        time: new Date(a.created_at).toLocaleTimeString(),
        type: 'order',
        user: userName
      };
    });
  }

  async getLeaderboards() {
    const client = this.supabaseService.getClient();

    // Fetch top suppliers by total order value
    const { data: suppliers } = await client
      .from(Tables.OrdersTable)
      .select('assigned_supplier, total_amount, organizations!orders_assigned_supplier_fkey(name)')
      .not('assigned_supplier', 'is', null)
      .order('total_amount', { ascending: false })
      .limit(5);

    // Fetch top customers by total order value
    const { data: customers } = await client
      .from(Tables.OrdersTable)
      .select('organization_id, total_amount, organizations!orders_organization_id_fkey(name)')
      .order('total_amount', { ascending: false })
      .limit(5);

    return {
      topSuppliers: (suppliers || []).map(s => {
        const castedS = s as any;
        return {
          name: castedS.organizations?.name || 'Unknown Supplier',
          revenue: s.total_amount,
          orders: 1
        };
      }),
      topCustomers: (customers || []).map(c => {
        const castedC = c as any;
        return {
          name: castedC.organizations?.name || 'Unknown Customer',
          revenue: c.total_amount,
          orders: 1
        };
      })
    };
  }
}
