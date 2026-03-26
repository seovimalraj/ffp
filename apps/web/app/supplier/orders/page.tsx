"use client";

import { useMetaStore } from "@/components/store/title-store";
import { DataTable, Column, DataTableSubRow } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusCards, StatusItem } from "@/components/ui/status-cards";
import { apiClient } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CubeIcon } from "@heroicons/react/24/outline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EyeIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import ExpandFileModal from "@/app/quote-config/components/expand-file-modal";

export type IOrder = {
  order_id: string;
  order_code: string;
  total_amount: number | null;
  confirmed_at: string;
  payment_status: string;
  status: string;
  part_count: number;
  created_at: string;
  parts: {
    cad_file_url: string;
    file_name: string;
    snapshot_2d_url: string;
  }[];
};

interface Filters {
  status: string;
}

enum StatusColor {
  "total" = "slate",
  "active" = "indigo",
  "pending" = "orange",
  "paid" = "violet",
  "processing" = "fuchsia",
  "shipped" = "amber",
  "delivered" = "rose",
  "completed" = "emerald",
  "cancelled" = "red",
  "payment pending" = "pink",
}

enum StatusPriority {
  "total" = 1,
  "active" = 2,
  "payment pending" = 3,
  "paid" = 4,
  "processing" = 5,
  "shipped" = 6,
  "delivered" = 7,
  "completed" = 8,
  "cancelled" = 9,
}

const Page = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusesLoading, setStatusesLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const ordersRef = useRef<IOrder[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(() => {
    const status = searchParams?.get("status") ?? "Any";
    return { status };
  });

  const { setPageTitle, resetTitle } = useMetaStore();

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== "Any") {
      params.set("status", filters.status);
    }
    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;
    if (window.location.search !== (queryString ? `?${queryString}` : "")) {
      router.replace(newUrl, { scroll: false });
    }
  }, [filters, router]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const [rawStatusData, setRawStatusData] = useState<{
    total: number;
    active: number;
    completed: number;
  } | null>(null);

  const fetchStatuses = useCallback(async () => {
    setStatusesLoading(true);
    try {
      const response = await apiClient.get("/supplier/orders-summary");
      const statusData = response.data.statuses || {
        total: 0,
        active: 0,
        completed: 0,
      };
      setRawStatusData(statusData);
    } catch (error) {
      console.error("Failed to fetch order summary:", error);
    } finally {
      setStatusesLoading(false);
    }
  }, []);

  const buildStatusCards = useCallback(
    (statusCounts: {
      total: number;
      active: number;
      completed: number;
    }) => {
      const cards: StatusItem[] = [
        {
          label: "Total Orders",
          value: statusCounts.total || 0,
          color: StatusColor["total"],
          onClick: () => setFilters({ status: "Any" }),
          priority: StatusPriority["total"],
          highlight: filters.status === "Any",
        },
        {
          label: "Active",
          value: statusCounts.active || 0,
          color: StatusColor["active"],
          onClick: () => setFilters({ status: "active" }),
          priority: StatusPriority["active"],
          highlight: filters.status === "active",
        },
        {
          label: "Completed",
          value: statusCounts.completed || 0,
          color: StatusColor["completed"],
          onClick: () => setFilters({ status: "completed" }),
          priority: StatusPriority["completed"],
          highlight: filters.status === "completed",
        },
      ];

      setStatuses(cards);
    },
    [filters.status],
  );

  const fetchOrders = useCallback(
    async (isNext = false) => {
      if (isNext) {
        setIsFetchingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const currentOrders = ordersRef.current;
        const lastOrder = isNext
          ? currentOrders[currentOrders.length - 1]
          : null;

        const params = {
          limit: 20,
          cursorCreatedAt: lastOrder?.created_at,
          cursorId: lastOrder?.order_id,
          status:
            filters.status !== "Any" ? filters.status.toLowerCase() : undefined,
        };

        const response = await apiClient.get("/supplier/orders/infinite", {
          params,
        });
        const newData = response.data.data || [];

        setOrders((prev) => (isNext ? [...prev, ...newData] : newData));
        setHasMore(response.data.hasMore);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [filters.status],
  );

  useEffect(() => {
    fetchStatuses();
    fetchOrders();
  }, []);

  useEffect(() => {
    if (rawStatusData) {
      buildStatusCards(rawStatusData);
    }
  }, [rawStatusData, buildStatusCards]);

  useEffect(() => {
    fetchOrders();
    fetchStatuses();
  }, [filters.status, fetchOrders, fetchStatuses]);

  useEffect(() => {
    setPageTitle("Orders");
    return () => {
      resetTitle();
    };
  }, []);

  const columns: Column<IOrder>[] = [
    {
      key: "order_code",
      header: "Order Code",
      render: (row) => (
        <Link
          href={`/supplier/orders/${row.order_id}`}
          className="text-violet-600 hover:text-violet-800 underline uppercase font-medium"
        >
          {row.order_code}
        </Link>
      ),
    },
    {
      key: "part_count",
      header: "Parts Count",
      render: (row, _, meta) => (
        <div className="flex items-center gap-3">
          <span>{row.part_count}</span>
          {row.parts?.length > 0 && (
            <button
              onClick={() => meta?.toggleExpansion()}
              className="text-violet-600 hover:text-violet-800 text-xs font-semibold underline underline-offset-2 transition-colors"
            >
              {meta?.isExpanded ? "Hide Parts" : "Show Parts"}
            </button>
          )}
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Created At",
      render: (row) => formatDate(row.created_at),
    },
  ];

  return (
    <div className="min-h-screen space-y-4">
      <StatusCards
        isLoading={loading || statusesLoading}
        items={statuses}
        minimal={true}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800/60 transition-all">
        <div className="flex flex-1 flex-wrap items-center gap-8">
          <div className="flex items-center gap-1 p-1 bg-gray-100/50 dark:bg-gray-800/40 rounded-xl relative border border-gray-200/50 dark:border-gray-700/50">
            <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap">
              Status
            </span>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
            <Select
              value={filters.status}
              onValueChange={(val) =>
                setFilters((prev) => ({ ...prev, status: val }))
              }
            >
              <SelectTrigger
                id="status"
                className="h-8 min-w-[140px] bg-transparent border-none shadow-none focus:ring-0 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all rounded-lg px-3 font-bold text-sm text-gray-900 dark:text-gray-100"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shadow-sm",
                      filters.status === "Any"
                        ? "bg-slate-500"
                        : "bg-violet-500",
                    )}
                  />
                  <SelectValue placeholder="Select status" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200 dark:border-gray-800 shadow-2xl backdrop-blur-xl bg-white/90 dark:bg-gray-950/90">
                <SelectItem value="Any" className="font-medium">
                  All Statuses
                </SelectItem>
                {[
                  "payment pending",
                  "paid",
                  "processing",
                  "shipped",
                  "delivered",
                  "completed",
                  "cancelled",
                ].map((s) => (
                  <SelectItem
                    key={s}
                    value={s}
                    className="font-medium capitalize"
                  >
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mx-auto">
        <div>
          <div className="mt-4">
            {loading ? (
              <div className="space-y-4 mt-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="w-16 h-4" />
                    <Skeleton className="w-24 h-4" />
                    <Skeleton className="w-20 h-4" />
                    <Skeleton className="w-16 h-4" />
                    <Skeleton className="w-12 h-4" />
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-[#111111]">
                <CubeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  No orders assigned yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Orders will appear here once they are assigned to your
                  organization.
                </p>
              </div>
            ) : (
              <>
                <DataTable
                  columns={columns}
                  data={orders}
                  keyExtractor={(m) => m.order_id}
                  emptyMessage="No Orders Found"
                  isLoading={loading || isFetchingMore}
                  numbering={true}
                  hasMore={hasMore}
                  onEndReached={() => {
                    if (hasMore && !isFetchingMore) {
                      fetchOrders(true);
                    }
                  }}
                  renderExpansion={(row) => (
                    <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-800/50">
                      <div className="flex flex-col gap-1">
                        {row.parts?.map((part, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <DataTableSubRow
                              isLast={idx === (row.parts?.length ?? 0) - 1}
                              className="hover:bg-white dark:hover:bg-gray-800/40 rounded-xl transition-all duration-300 px-4 py-1"
                            >
                              <div className="flex items-center group/part w-full pr-4">
                                <div
                                  onClick={() =>
                                    setSelectedFile(part.cad_file_url)
                                  }
                                  className="flex items-center gap-4"
                                >
                                  <div className="relative w-12 h-12 rounded-lg cursor-pointer bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center p-1.5 overflow-hidden group/thumb transition-transform hover:scale-105 active:scale-95 shadow-sm">
                                    {part.snapshot_2d_url ? (
                                      <img
                                        src={part.snapshot_2d_url}
                                        className="w-full h-full object-contain"
                                        alt={part.file_name}
                                      />
                                    ) : (
                                      <CubeIcon className="w-6 h-6 text-gray-400 group-hover/thumb:text-violet-500 transition-colors" />
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm tracking-tight leading-none group-hover/part:text-violet-600 dark:group-hover/part:text-violet-400 transition-colors">
                                      {part.file_name}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </DataTableSubRow>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                  actions={[
                    {
                      label: "Open",
                      icon: <EyeIcon className="w-4 h-4" />,
                      onClick: (order) =>
                        router.push(`/supplier/orders/${order.order_id}`),
                    },
                  ]}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {selectedFile && (
        <ExpandFileModal
          expandedFile={selectedFile}
          setExpandedFile={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
};

export default Page;
