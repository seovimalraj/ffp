"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EyeIcon, CubeIcon } from "@heroicons/react/24/outline";
import { posthog } from "posthog-js";
import { apiClient } from "@/lib/api";
import { DataTable, Column, DataTableSubRow } from "@/components/ui/data-table";
import { IRFQStatuses } from "@/types";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { useMetaStore } from "@/components/store/title-store";
import { StatusCards, StatusItem } from "@/components/ui/status-cards";
import { toTitleCase } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowUpFromLine } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import ExpandFileModal from "@/app/quote-config/components/expand-file-modal";

// Types based on RFQ API response
interface Quote {
  id: string;
  rfq_code: string;
  user_id: string;
  final_price: number | null;
  status: IRFQStatuses;
  order_id: string | null;
  created_at: string;
  updated_at: string;
  rfq_type: "general" | "manual";
  parts_count: number;
  parts: {
    file_name: string;
    cad_file_url: string;
    snapshot_2d_url: string;
  }[];
}

interface Filters {
  status: string;
  rfqType: "manual" | "general" | "any" | null;
}

enum StatusColor {
  total = "blue",
  draft = "gray",
  submitted = "orange",
  "under review" = "lime",
  quoted = "indigo",
  "payment pending" = "teal",
  paid = "green",
  rejected = "red",
  "pending approval" = "amber",
  pending = "sky",
  accepted = "emerald",
}

enum StatusPriority {
  "total" = 1,
  "draft" = 2,
  "submitted" = 3,
  "under review" = 4,
  "quoted" = 5,
  "payment pending" = 6,
  "paid" = 7,
  "pending approval" = 8,
  "pending" = 9,
  "rejected" = 10,
  "accepted" = 11,
}

export default function QuotesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusesLoading, setStatusesLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const quotesRef = React.useRef<Quote[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Initialize filters from URL query params
  const [filters, setFilters] = useState<Filters>(() => {
    const status = searchParams?.get("status") ?? "Any";
    const rfqType =
      (searchParams?.get("rfqType") as Filters["rfqType"]) ?? "any";

    return {
      status,
      rfqType,
    };
  });

  const { setPageTitle, resetTitle } = useMetaStore();
  const QUOTE_LIMIT = 20;

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.status && filters.status !== "Any") {
      params.set("status", filters.status);
    }

    if (filters.rfqType && filters.rfqType !== "any") {
      params.set("rfqType", filters.rfqType);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;

    // Only update if the URL actually changed
    if (window.location.search !== (queryString ? `?${queryString}` : "")) {
      router.replace(newUrl, { scroll: false });
    }
  }, [filters, router]);

  useEffect(() => {
    setPageTitle("Quotes");
    return () => {
      resetTitle();
    };
  }, []);

  // Keep ref in sync with quotes state
  useEffect(() => {
    quotesRef.current = quotes;
  }, [quotes]);

  const buildStatusCards = React.useCallback(
    (statusCounts: {
      total: number;
      by_status: { status: string; count: number }[];
    }) => {
      const countsMap = new Map(
        statusCounts.by_status.map((s) => [s.status.toLowerCase(), s.count]),
      );

      // List of statuses we want to always show in order
      const permittedStatuses: IRFQStatuses[] = [
        "draft",
        "submitted",
        "under review",
        "quoted",
        "payment pending",
        "paid",
        "pending approval",
      ];

      const cards: StatusItem[] = [
        {
          label: "Total Quotes",
          value: statusCounts.total || 0,
          color: StatusColor["total"],
          onClick: () => setFilters((prev) => ({ ...prev, status: "Any" })),
          priority: StatusPriority["total"],
          highlight: filters.status === "Any",
        },
      ];

      permittedStatuses.forEach((statusKey) => {
        cards.push({
          label: toTitleCase(statusKey),
          value: countsMap.get(statusKey) || 0,
          color: (StatusColor[statusKey as keyof typeof StatusColor] ??
            "gray") as StatusItem["color"],
          onClick: () => setFilters((prev) => ({ ...prev, status: statusKey })),
          priority:
            StatusPriority[statusKey as keyof typeof StatusPriority] ?? 50,
          highlight: filters.status.toLowerCase() === statusKey.toLowerCase(),
        });
      });

      setStatuses(cards);
    },
    [filters.status],
  );

  const [rawStatusData, setRawStatusData] = React.useState<{
    total: number;
    by_status: { status: string; count: number }[];
  } | null>(null);

  const fetchStatuses = React.useCallback(async () => {
    setStatusesLoading(true);
    try {
      const params = {
        rfqType: filters.rfqType !== "any" ? filters.rfqType : undefined,
      };
      const response = await apiClient.get("/rfq/status-summary", { params });
      const statusData = response.data.statusCounts || {
        total: 0,
        by_status: [],
      };
      setRawStatusData(statusData);
    } catch (error) {
      console.error("Failed to fetch status summary:", error);
    } finally {
      setStatusesLoading(false);
    }
  }, [filters.rfqType]);

  const fetchQuotes = React.useCallback(
    async (isNext = false) => {
      if (isNext) {
        setIsFetchingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const currentQuotes = quotesRef.current;
        const params = {
          limit: QUOTE_LIMIT,
          cursorCreatedAt: isNext
            ? currentQuotes[currentQuotes.length - 1]?.created_at
            : undefined,
          cursorId: isNext
            ? currentQuotes[currentQuotes.length - 1]?.id
            : undefined,
          status:
            filters.status !== "Any" ? filters.status.toLowerCase() : undefined,
          rfqType: filters.rfqType !== "any" ? filters.rfqType : undefined,
        };

        const response = await apiClient.get("/rfq", { params });
        const newData = response.data.data || [];

        setQuotes((prev) => (isNext ? [...prev, ...newData] : newData));
        setHasMore(response.data.hasMore);
      } catch (error) {
        console.error("Failed to fetch quotes:", error);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [filters.status, filters.rfqType, QUOTE_LIMIT],
  );

  // Initial data fetch on mount
  useEffect(() => {
    posthog.capture("quotes_list_view");
    fetchStatuses();
    fetchQuotes();
  }, []);

  // Build/rebuild status cards when raw data or filter changes
  useEffect(() => {
    if (rawStatusData) {
      buildStatusCards(rawStatusData);
    }
  }, [rawStatusData, buildStatusCards]);

  useEffect(() => {
    fetchQuotes();
    fetchStatuses();
  }, [filters.status, filters.rfqType, fetchQuotes, fetchStatuses]);

  const filteredQuotes = useMemo(() => {
    return quotes;
  }, [quotes]);

  const STATUS_CONFIG: Record<
    IRFQStatuses,
    {
      label: string;
      variant:
        | "success"
        | "warning"
        | "default"
        | "secondary"
        | "destructive"
        | "outline";
    }
  > = {
    accepted: { label: "Accepted", variant: "success" },
    quoted: { label: "Quoted", variant: "secondary" },
    draft: { label: "Draft", variant: "warning" },
    rejected: { label: "Rejected", variant: "destructive" },
    pending: { label: "Pending", variant: "warning" },
    submitted: { label: "Submitted", variant: "default" },
    "payment pending": { label: "Payment Pending", variant: "warning" },
    "under review": { label: "Under Review", variant: "outline" },
    "pending approval": { label: "Pending Approval", variant: "secondary" },
    paid: { label: "Paid", variant: "success" },
  };

  const TYPE_CONFIG: Record<
    "general" | "manual",
    {
      label: string;
      variant:
        | "success"
        | "warning"
        | "default"
        | "secondary"
        | "destructive"
        | "outline";
    }
  > = {
    general: { label: "General", variant: "outline" },
    manual: { label: "Manual", variant: "secondary" },
  };

  const getStatusChip = (status: IRFQStatuses) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG["pending"];

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeChip = (type: "general" | "manual") => {
    const config = TYPE_CONFIG[type || "general"];

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleOpenQuote = (quoteId: string) => {
    router.push(`/quote-config/${quoteId}`);
  };

  const formatCurrency = (
    amount: number | null,
    currency: string,
    message: string,
  ) => {
    return amount
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency,
        }).format(amount)
      : message;
  };

  const columns: Column<Quote>[] = [
    {
      key: "rfq_code",
      header: "RFQ Code",
      render: (row) => (
        <Link
          href={
            row.status === "draft"
              ? `/quote-config/${row.id}`
              : row.status === "paid"
                ? `/portal/orders/${row.order_id}`
                : row.status === "submitted" || row.status === "payment pending"
                  ? `/checkout/${row.id}`
                  : `/portal/quotes/${row.id}`
          }
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {row.rfq_code}
        </Link>
      ),
    },
    {
      key: "final_price",
      header: "Final Price",
      render: (row) => formatCurrency(row.final_price, "USD", "Not Calculated"),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => getStatusChip(row.status),
    },
    {
      key: "rfq_type",
      header: "Type",
      render: (row) => getTypeChip(row.rfq_type),
    },
    {
      key: "parts_count",
      header: "Parts Count",
      render: (row, _, meta) => (
        <div className="flex items-center gap-3">
          <span>{row.parts_count}</span>
          {row.parts?.length > 0 && (
            <button
              onClick={() => meta?.toggleExpansion()}
              className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline underline-offset-2 transition-colors"
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
    {
      key: "updated_at",
      header: "Updated At",
      render: (row) => formatDate(row.updated_at),
    },
  ];

  return (
    <div className="min-h-screen space-y-4">
      <StatusCards
        isLoading={loading || statusesLoading}
        items={statuses}
        minimal={true}
      />
      {/* Toolbar Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800/60 transition-all">
        <div className="flex flex-1 flex-wrap items-center gap-8">
          {/* RFQ Type Tabs */}
          <div className="flex items-center gap-1 p-1 bg-gray-100/50 dark:bg-gray-800/40 rounded-xl relative border border-gray-200/50 dark:border-gray-700/50">
            {(["any", "general", "manual"] as const).map((type) => (
              <button
                key={type}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    rfqType: type as Filters["rfqType"],
                  }))
                }
                className={cn(
                  "relative px-6 py-2 rounded-lg text-sm font-bold transition-colors duration-200 capitalize",
                  (filters.rfqType || "any") === type
                    ? "text-white dark:text-gray-900"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100",
                )}
              >
                {(filters.rfqType || "any") === type && (
                  <motion.div
                    layoutId="active-tab-rfq-type"
                    className="absolute inset-0 bg-gray-900 dark:bg-white rounded-[8px] shadow-sm"
                    transition={{
                      type: "spring",
                      bounce: 0.15,
                      duration: 0.5,
                    }}
                  />
                )}
                <span className="relative z-10">
                  {type === "any" ? "All" : type}
                </span>
              </button>
            ))}
          </div>

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
                        ? "bg-blue-500"
                        : "bg-emerald-500",
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
                  "draft",
                  "submitted",
                  "under review",
                  "quoted",
                  "payment pending",
                  "paid",
                  "pending approval",
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

        {/* <div className="flex items-center self-end sm:self-center">
          <Button
            variant="default"
            size="sm"
            className="h-9 px-4 text-white hover:text-gray-100 transition-all flex items-center gap-2 font-semibold text-xs tracking-wide uppercase"
          >
            <ArrowUpFromLine size={14} className="opacity-60 mr-1" />
            <span>Export</span>
          </Button>
        </div> */}
      </div>

      {/* Content Section */}
      <div className="pt-2">
        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 py-4 border-b border-gray-50 dark:border-gray-900/50"
              >
                <Skeleton className="w-24 h-4 rounded-full" />
                <Skeleton className="w-32 h-4 rounded-full" />
                <Skeleton className="w-20 h-4 rounded-full" />
                <Skeleton className="w-24 h-4 rounded-full" />
              </div>
            ))}
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
              <CubeIcon className="w-16 h-16 text-blue-500/40 relative z-10" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">
              Your Quote List is Empty
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto leading-relaxed">
              Start by uploading your CAD files in the dashboard to receive
              instant pricing and manufacturing feedback.
            </p>
            <Button
              onClick={() => router.push("/portal/dashboard")}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 h-12 font-medium shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
            >
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <DataTable
              columns={columns}
              data={filteredQuotes}
              keyExtractor={(m) => m.id}
              emptyMessage="No Quotes Found"
              isLoading={loading || isFetchingMore}
              numbering={true}
              hasMore={hasMore}
              onEndReached={() => {
                if (hasMore && !isFetchingMore) {
                  fetchQuotes(true);
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
                              onClick={() => setSelectedFile(part.cad_file_url)}
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
                                  <CubeIcon className="w-6 h-6 text-gray-400 group-hover/thumb:text-blue-500 transition-colors" />
                                )}
                                <div className="absolute inset-0 bg-blue-500/0 group-hover/thumb:bg-blue-500/5 transition-colors" />
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm tracking-tight leading-none group-hover/part:text-blue-600 dark:group-hover/part:text-blue-400 transition-colors">
                                  {part.file_name}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                                    CAD File
                                  </span>
                                </div>
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
                  onClick: (quote) => handleOpenQuote(quote.id),
                },
              ]}
            />
          </div>
        )}
      </div>

      {selectedFile && (
        <ExpandFileModal
          expandedFile={selectedFile}
          setExpandedFile={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
