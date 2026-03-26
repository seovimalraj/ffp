"use client";

import { useMetaStore } from "@/components/store/title-store";
import { DataTable, Column } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  // StatusCards,
  StatusItem,
} from "@/components/ui/status-cards";
import { apiClient } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  // toTitleCase,
  cn,
} from "@/lib/utils";
import { ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
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
import React, { useState, useEffect, useCallback } from "react";

export type IQuoteRequest = {
  id: string;
  status: string;
  created_at: string;
  order: {
    order_code: string;
  };
  supplier: {
    name: string;
  };
};

interface Filters {
  status: string;
}

enum StatusColor {
  "total" = "slate",
  "requested" = "orange",
  "accepted" = "violet",
  "declined" = "red",
  "cancelled" = "gray",
}

const Page = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quoteRequests, setQuoteRequests] = useState<IQuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

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

  const fetchQuoteRequests = useCallback(
    async (isNext = false) => {
      if (isNext) {
        setIsFetchingMore(true);
      } else {
        setLoading(true);
        setPage(1);
      }

      try {
        const currentPage = isNext ? page + 1 : 1;
        const params = {
          page: currentPage,
          limit,
          status:
            filters.status !== "Any" ? filters.status.toLowerCase() : undefined,
        };

        const response = await apiClient.get("/quote-request", { params });
        const newData = response.data.data || [];
        const count = response.data.count || 0;

        setQuoteRequests((prev) => (isNext ? [...prev, ...newData] : newData));
        setTotalCount(count);
        setPage(currentPage);
        setHasMore(
          (isNext ? quoteRequests.length : 0) + newData.length < count,
        );
      } catch (error) {
        console.error("Error fetching quote requests:", error);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [page, limit, filters.status, quoteRequests.length],
  );

  useEffect(() => {
    fetchQuoteRequests();
  }, [filters.status]);

  useEffect(() => {
    setPageTitle("Quote Requests");
    return () => {
      resetTitle();
    };
  }, [setPageTitle, resetTitle]);

  const columns: Column<IQuoteRequest>[] = [
    {
      key: "id",
      header: "Ref Code",
      render: (row) => (
        <span className="text-xs font-mono text-slate-500">
          {row.id.substring(0, 8).toUpperCase()}
        </span>
      ),
      hidden: true,
    },
    {
      key: "order_code",
      header: "Order Code",
      render: (row) => (
        <Link
          href={`/supplier/quote-request/${row.id}`}
          className="text-violet-600 hover:text-violet-800 underline uppercase font-medium transition-colors"
        >
          {row.order.order_code}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              row.status === "requested"
                ? "bg-orange-500"
                : row.status === "accepted"
                  ? "bg-violet-500"
                  : row.status === "declined"
                    ? "bg-red-500"
                    : "bg-slate-400",
            )}
          />
          <span className="capitalize text-sm font-medium">{row.status}</span>
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Date",
      render: (row) => formatDate(row.created_at),
    },
  ];

  // For now, minimal status cards manually calculated from the current page
  // Ideally, there should be a summary endpoint like /supplier/orders-summary
  const statuses: StatusItem[] = [
    {
      label: "Total Requests",
      value: totalCount,
      color: "slate",
      onClick: () => setFilters({ status: "Any" }),
      highlight: filters.status === "Any",
    },
    {
      label: "Requested",
      value: filters.status === "requested" ? quoteRequests.length : 0, // This is just a placeholder since we don't have a summary api for quote requests yet
      color: "orange",
      onClick: () => setFilters({ status: "requested" }),
      highlight: filters.status === "requested",
    },
    {
      label: "Accepted",
      value: filters.status === "accepted" ? quoteRequests.length : 0,
      color: "violet",
      onClick: () => setFilters({ status: "accepted" }),
      highlight: filters.status === "accepted",
    },
  ];

  return (
    <div className="min-h-screen space-y-4">
      {/* <StatusCards isLoading={loading} items={statuses} minimal={true} /> */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800/60 transition-all">
        <div className="flex flex-1 flex-wrap items-center gap-8">
          <div className="flex items-center gap-1 p-1 bg-gray-100/50 dark:bg-gray-800/40 rounded-xl relative border border-gray-200/50 dark:border-gray-700/50">
            <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap">
              Filter by Status
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
                {["requested", "accepted", "declined", "cancelled"].map((s) => (
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
        <div className="mt-4">
          {loading ? (
            <div className="space-y-4 mt-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="w-[10%] h-[20px]" />
                  <Skeleton className="w-[30%] h-[20px]" />
                  <Skeleton className="w-[20%] h-[20px]" />
                  <Skeleton className="w-[20%] h-[20px]" />
                  <Skeleton className="w-[20%] h-[20px]" />
                </div>
              ))}
            </div>
          ) : quoteRequests.length === 0 ? (
            <div className="text-center py-12 text-[#111111]">
              <ClipboardDocumentListIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                No quote requests found
              </h3>
              <p className="text-gray-500 mb-4">
                You will see requests here once an admin assigns them to you.
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={quoteRequests}
              keyExtractor={(m) => m.id}
              emptyMessage="No Quote Requests Found"
              isLoading={loading || isFetchingMore}
              numbering={true}
              hasMore={hasMore}
              onEndReached={() => {
                if (hasMore && !isFetchingMore) {
                  fetchQuoteRequests(true);
                }
              }}
              actions={[
                {
                  label: "View Request",
                  icon: <EyeIcon className="w-4 h-4" />,
                  onClick: (req) =>
                    router.push(`/supplier/quote-request/${req.id}`),
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Page;
