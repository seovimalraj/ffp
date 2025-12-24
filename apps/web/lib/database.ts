import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://app.frigate.ai/db";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.ARCQ9fz5iWIEe7rtWe7LUFGk6KFiHHCiKmEczlr0jU0";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Quote {
  id: string;
  email: string;
  files: Array<{
    name: string;
    path: string;
    size: number;
    mimeType: string;
  }>;
  status: string;
  created_at: string;
}

export interface QuoteConfig {
  id: string;
  quote_id: string;
  parts: any[];
  total_price: number;
  max_lead_time: number;
  created_at: string;
}

export interface Order {
  id: string;
  quote_id?: string;
  customer_email: string;
  customer_name?: string;
  customer_phone?: string;
  customer_company?: string;
  shipping_address?: any;
  parts: any[];
  total_price: number;
  status: string;
  payment_status?: string;
  created_at: string;
}

export interface RFQ {
  id: string;
  order_id: string;
  display_value: number;
  materials: string[];
  lead_time: number;
  parts: any[];
  status: string;
  closes_at: string;
  created_at: string;
}

export interface Bid {
  id: string;
  rfq_id: string;
  supplier_name: string;
  price: number;
  lead_time: number;
  notes?: string;
  quality_score: number;
  on_time_rate: number;
  status: string;
  created_at: string;
}

// Helper functions
export async function createQuote(email: string, files: any[]) {
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      email,
      files,
      status: "draft",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getQuote(id: string) {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function saveQuoteConfig(
  quoteId: string,
  parts: any[],
  totalPrice: number,
  maxLeadTime: number,
) {
  const { data, error } = await supabase
    .from("quote_configs")
    .upsert({
      quote_id: quoteId,
      parts,
      total_price: totalPrice,
      max_lead_time: maxLeadTime,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getQuoteConfig(quoteId: string) {
  const { data, error } = await supabase
    .from("quote_configs")
    .select("*")
    .eq("quote_id", quoteId)
    .single();

  if (error) throw error;
  return data;
}

export async function createOrder(orderData: Partial<Order>) {
  const { data, error } = await supabase
    .from("orders")
    .insert(orderData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getRFQs() {
  const { data, error } = await supabase
    .from("rfqs")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getRFQ(id: string) {
  const { data, error } = await supabase
    .from("rfqs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createRFQ(rfqData: Partial<RFQ>) {
  const { data, error } = await supabase
    .from("rfqs")
    .insert(rfqData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBidsForRFQ(rfqId: string) {
  const { data, error } = await supabase
    .from("bids")
    .select("*")
    .eq("rfq_id", rfqId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createBid(bidData: Partial<Bid>) {
  const { data, error } = await supabase
    .from("bids")
    .insert(bidData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrdersWithBids() {
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .in("status", ["rfq", "production"])
    .order("created_at", { ascending: false });

  if (ordersError) throw ordersError;

  const ordersWithBids = await Promise.all(
    (orders || []).map(async (order) => {
      const { data: rfqs } = await supabase
        .from("rfqs")
        .select("*")
        .eq("order_id", order.id);

      if (rfqs && rfqs.length > 0) {
        const { data: bids } = await supabase
          .from("bids")
          .select("*")
          .eq("rfq_id", rfqs[0].id);

        return { ...order, rfq: rfqs[0], bids: bids || [] };
      }

      return { ...order, rfq: null, bids: [] };
    }),
  );

  return ordersWithBids;
}

export async function updateBidStatus(bidId: string, status: string) {
  const { data, error } = await supabase
    .from("bids")
    .update({ status })
    .eq("id", bidId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrderStatus(orderId: string, status: string) {
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Kanban state functions
export async function getKanbanState(orderId: string) {
  const { data, error } = await supabase
    .from("kanban_state")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateKanbanStatus(
  partId: string,
  orderId: string,
  status: string,
  notes?: string,
) {
  const updateData: any = { status };

  if (status === "cutting" && notes === undefined) {
    updateData.started_at = new Date().toISOString();
  }
  if (status === "done" && notes === undefined) {
    updateData.completed_at = new Date().toISOString();
  }
  if (notes !== undefined) {
    updateData.notes = notes;
  }

  const { data, error } = await supabase
    .from("kanban_state")
    .update(updateData)
    .eq("order_id", orderId)
    .eq("part_id", partId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createKanbanState(
  orderId: string,
  partId: string,
  partName: string,
) {
  const { data, error } = await supabase
    .from("kanban_state")
    .insert({
      order_id: orderId,
      part_id: partId,
      part_name: partName,
      status: "setup",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Order timeline functions
export async function getOrderTimeline(orderId: string) {
  const { data, error } = await supabase
    .from("order_timeline")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createTimelineEvent(
  orderId: string,
  eventType: string,
  title: string,
  description?: string,
) {
  const { data, error } = await supabase
    .from("order_timeline")
    .insert({
      order_id: orderId,
      event_type: eventType,
      title,
      description,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Storage functions
export async function uploadFile(
  file: File,
): Promise<{ name: string; path: string; size: number; mimeType: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const response = await fetch(`${apiUrl}/storage/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload file");
  }

  const result = await response.json();
  return result.file;
}

export async function getFileDownloadUrl(objectName: string): Promise<string> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const response = await fetch(
    `${apiUrl}/storage/download/${encodeURIComponent(objectName)}`,
  );

  if (!response.ok) {
    throw new Error("Failed to get download URL");
  }

  const result = await response.json();
  return result.downloadUrl;
}

// Dashboard Stats Functions
export async function getSupplierDashboardStats() {
  // Get orders in production or active status
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .in("status", ["pending", "rfq", "production", "shipped"]);

  if (ordersError) {
    console.error("Error fetching orders:", ordersError);
    return {
      activeOrders: 0,
      monthlyRevenue: 0,
      machineUtilization: 0,
      avgLeadTime: 0,
    };
  }

  // Calculate stats
  const activeOrderCount = orders?.length || 0;
  const monthlyRevenue =
    orders?.reduce((sum, order) => sum + Number(order.total_price), 0) || 0;

  // Get kanban state for utilization (parts in production)
  const { data: kanban } = await supabase
    .from("kanban_state")
    .select("*")
    .in("status", ["cutting", "finishing", "inspection"]);

  const totalParts = kanban?.length || 0;
  const machineUtilization = Math.min(100, Math.round((totalParts / 20) * 100)); // Assume 20 part capacity

  return {
    activeOrders: activeOrderCount,
    monthlyRevenue: monthlyRevenue,
    machineUtilization: machineUtilization,
    avgLeadTime: 6.2, // Could be calculated from actual data
  };
}

export async function getSupplierActiveOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      customer_name,
      customer_company,
      parts,
      status,
      total_price,
      created_at,
      updated_at
    `,
    )
    .in("status", ["pending", "rfq", "production", "shipped"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching active orders:", error);
    return [];
  }

  return data || [];
}

export async function getAdminDashboardStats() {
  // Get all orders
  const { data: orders } = await supabase.from("orders").select("*");

  // Get all quotes
  const { data: quotes } = await supabase.from("quotes").select("*");

  const totalOrders = orders?.length || 0;
  const totalQuotes = quotes?.length || 0;
  const monthlyRevenue =
    orders?.reduce((sum, order) => sum + Number(order.total_price), 0) || 0;
  const avgQuoteValue = totalOrders > 0 ? monthlyRevenue / totalOrders : 0;

  return {
    totalUsers: 0, // Would come from auth.users
    totalOrganizations: 0, // Would come from organizations table
    activeQuotes: totalQuotes,
    totalOrders: totalOrders,
    monthlyRevenue: monthlyRevenue,
    avgQuoteValue: avgQuoteValue,
  };
}

export async function getRecentActivity() {
  const { data, error } = await supabase
    .from("order_timeline")
    .select(
      `
      *,
      orders (
        id,
        customer_name,
        customer_company
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching recent activity:", error);
    return [];
  }

  return data || [];
}
