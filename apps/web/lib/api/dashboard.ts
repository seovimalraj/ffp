import { apiClient } from "./index";

export interface DashboardStats {
  activeQuotes: number;
  openOrders: number;
  totalSpent: string;
  avgLeadTime: string;
}

export interface RecentQuote {
  id: string;
  rfq_code: string;
  description: string;
  status: string;
  final_price: number | string;
  created_at: string;
  amount: string;
  date: string;
  parts: number;
}

export interface RecentOrder {
  id: string;
  order_code: string;
  description: string;
  status: string;
  total_amount: number;
  amount: string;
  created_at: string;
  dueDate: string;
  progress: number;
}

export interface Blog {
  id: string;
  title: string;
  description: string;
  link: string;
  image_url: string;
  tag: string;
  showcase: boolean;
  created_at: string;
}

export const DashboardAPI = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get<DashboardStats>(
      "/portal/dashboard/stats",
    );
    return data;
  },

  getRecentQuotes: async (): Promise<RecentQuote[]> => {
    const { data } = await apiClient.get<RecentQuote[]>(
      "/portal/dashboard/recent-quotes",
    );
    return data;
  },

  getRecentOrders: async (): Promise<RecentOrder[]> => {
    const { data } = await apiClient.get<RecentOrder[]>(
      "/portal/dashboard/recent-orders",
    );
    return data;
  },

  getBlogs: async (limit = 4): Promise<Blog[]> => {
    const { data } = await apiClient.get<any>(
      `/portal/dashboard/blogs?limit=${limit}`,
    );
    return data?.data ?? [];
  },
};
