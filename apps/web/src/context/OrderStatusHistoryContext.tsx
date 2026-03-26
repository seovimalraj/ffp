"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { apiClient } from "@/lib/api";
import StatusChangeHistorySidebar from "@/app/portal/orders/[orderId]/components/StatusChangeHistorySidebar";

interface StatusRequest {
  id: string;
  order_id: string;
  part_id: string;
  status_from: string;
  status_to: string;
  comments?: string;
  attachments?: string[];
  status: "active" | "approved" | "rejected";
  created_at: string;
  rejection_reason?: string;
}

interface OrderStatusHistoryContextType {
  requests: StatusRequest[];
  refreshRequests: () => Promise<void>;
  openHistory: (partId?: string, statusFrom?: string) => void;
  closeHistory: () => void;
  isLoading: boolean;
}

const OrderStatusHistoryContext = createContext<
  OrderStatusHistoryContextType | undefined
>(undefined);

export function OrderStatusHistoryProvider({
  orderId,
  children,
  parts,
}: {
  orderId: string;
  children: React.ReactNode;
  parts: any[];
}) {
  const [requests, setRequests] = useState<StatusRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<{
    partId?: string;
    statusFrom?: string;
  }>({});

  const fetchRequests = useCallback(async () => {
    if (!orderId) return;
    setIsLoading(true);
    try {
      const response = await apiClient.get(
        `/orders/status-change-request/${orderId}`,
      );
      setRequests(response.data.data || []);
    } catch (error) {
      console.error("Error fetching status history:", error);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openHistory = useCallback((partId?: string, statusFrom?: string) => {
    setFilters({ partId, statusFrom });
    setIsSidebarOpen(true);
  }, []);

  const closeHistory = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <OrderStatusHistoryContext.Provider
      value={{
        requests,
        refreshRequests: fetchRequests,
        openHistory,
        closeHistory,
        isLoading,
      }}
    >
      {children}
      <StatusChangeHistorySidebar
        isOpen={isSidebarOpen}
        onClose={closeHistory}
        requests={requests}
        partId={filters.partId}
        statusFrom={filters.statusFrom}
        parts={parts}
      />
    </OrderStatusHistoryContext.Provider>
  );
}

export function useOrderStatusHistory() {
  const context = useContext(OrderStatusHistoryContext);
  if (context === undefined) {
    throw new Error(
      "useOrderStatusHistory must be used within an OrderStatusHistoryProvider",
    );
  }
  return context;
}
