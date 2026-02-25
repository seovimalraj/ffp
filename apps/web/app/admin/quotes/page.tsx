"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EyeIcon, CubeIcon } from "@heroicons/react/24/outline";
import { apiClient } from "@/lib/api";
import { DataTable, Column, DataTableSubRow } from "@/components/ui/data-table";
import { IRFQStatuses } from "@/types";
import Link from "next/link";
import {
  formatDate,
  formatCurrencyGeneric,
  formatDateTime,
} from "@/lib/format";
import { useMetaStore } from "@/components/store/title-store";
import { StatusCards, StatusItem } from "@/components/ui/status-cards";
import {
  Building2,
  Search,
  ArrowUpFromLine,
  Filter,
  XCircle,
} from "lucide-react";
import { RequireAnyRole } from "@/components/auth/RequireAnyRole";
import { cn, toTitleCase } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ExpandFileModal from "@/app/quote-config/components/expand-file-modal";

// Types based on Admin RFQ API response
interface AdminQuote {
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
  organization_name: string;
  user_email: string;
  user_name: string;
  parts?: {
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
  "total" = "blue",
  "draft" = "gray",
  "submitted" = "orange",
  "under review" = "lime",
  "quoted" = "indigo",
  "payment pending" = "teal",
  "paid" = "green",
  "rejected" = "red",
  "pending approval" = "amber",
  "pending" = "sky",
  "accepted" = "emerald",
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

export default function AdminQuotesPage() {
  return (
    <RequireAnyRole
      roles={["admin", "org_admin", "reviewer", "finance"]}
      fallback={<div className="p-6 text-sm text-red-600">Access denied</div>}
    >
      <AdminQuotesContent />
    </RequireAnyRole>
  );
}

function AdminQuotesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const quotesRef = React.useRef<AdminQuote[]>([]);

  // Initialize filters from URL query params
  const [filters, setFilters] = useState<Filters>(() => {
    const status = searchParams?.get("status") ?? "Any";
    const rfqType =
      (searchParams?.get("rfqType") as Filters["rfqType"]) ?? "any";
    return { status, rfqType };
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
    if (window.location.search !== (queryString ? `?${queryString}` : "")) {
      router.replace(newUrl, { scroll: false });
    }
  }, [filters, router]);

  useEffect(() => {
    setPageTitle("Admin Quotes");
    return () => resetTitle();
  }, []);

  // Keep ref in sync with quotes state
  useEffect(() => {
    quotesRef.current = quotes;
  }, [quotes]);

  const buildStatusCards = React.useCallback(
    (statusCounts: { status: string; count: number }[]) => {
      const countsMap = new Map(
        statusCounts.map((s) => [s.status.toLowerCase(), s.count]),
      );
      const totalCount = statusCounts.reduce(
        (acc, curr) => acc + curr.count,
        0,
      );

      const permittedStatuses: IRFQStatuses[] = [
        "submitted",
        "under review",
        "quoted",
        "payment pending",
        "paid",
        "pending approval",
        "draft",
        "rejected",
      ];

      const cards: StatusItem[] = [
        {
          label: "Total Quotes",
          value: totalCount,
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

  const fetchQuotes = React.useCallback(
    async (isNext = false) => {
      if (isNext) setIsFetchingMore(true);
      else setLoading(true);

      try {
        const currentQuotes = quotesRef.current;
        const params: any = {
          limit: QUOTE_LIMIT,
          status:
            filters.status !== "Any" ? filters.status.toLowerCase() : undefined,
          rfqType: filters.rfqType !== "any" ? filters.rfqType : undefined,
        };

        if (isNext && currentQuotes.length > 0) {
          const lastQuote = currentQuotes[currentQuotes.length - 1];
          params.cursorCreatedAt = lastQuote.created_at;
          params.cursorId = lastQuote.id;
        }

        const response = await apiClient.get("/rfq/admin/all", { params });
        const newData = response.data.data || [];

        setQuotes((prev) => (isNext ? [...prev, ...newData] : newData));
        setHasMore(response.data.hasMore);

        if (response.data.counts) {
          buildStatusCards(response.data.counts);
        }
      } catch (error) {
        console.error("Failed to fetch admin quotes:", error);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [filters.status, filters.rfqType, buildStatusCards],
  );

  useEffect(() => {
    fetchQuotes();
  }, [filters.status, filters.rfqType, fetchQuotes]);

  const filteredQuotes = useMemo(() => {
    if (!searchQuery) return quotes;
    const q = searchQuery.toLowerCase();
    return quotes.filter(
      (quote) =>
        quote.rfq_code.toLowerCase().includes(q) ||
        quote.organization_name.toLowerCase().includes(q) ||
        quote.user_email?.toLowerCase().includes(q) ||
        quote.user_name?.toLowerCase().includes(q),
    );
  }, [quotes, searchQuery]);

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

  const columns: Column<AdminQuote>[] = [
    {
      key: "rfq_code",
      header: "RFQ Code",
      render: (row) => (
        <Link
          href={`/admin/quotes/${row.id}`}
          className="text-blue-600 hover:text-blue-800 underline font-medium"
        >
          {row.rfq_code}
        </Link>
      ),
    },
    {
      key: "organization_name",
      header: "Company",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-gray-500" />
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {row.organization_name}
          </span>
        </div>
      ),
    },
    {
      key: "user_name",
      header: "Customer",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {row.user_name || "N/A"}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">
            {row.user_email}
          </span>
        </div>
      ),
    },
    {
      key: "final_price",
      header: "Value",
      render: (row) => (
        <span className="font-bold text-gray-900 dark:text-gray-100">
          {row.final_price ? formatCurrencyGeneric(row.final_price) : "Pending"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const config = STATUS_CONFIG[row.status] || STATUS_CONFIG["pending"];
        return (
          <Badge variant={config.variant} className="capitalize">
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: "rfq_type",
      header: "Type",
      render: (row) => {
        const config = TYPE_CONFIG[row.rfq_type] || TYPE_CONFIG["general"];
        return (
          <Badge variant={config.variant} className="capitalize">
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: "parts_count",
      header: "Parts",
      render: (row, _, meta) => (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold">
            {row.parts_count}
          </span>
          {row.parts && row.parts.length > 0 && (
            <button
              onClick={() => meta?.toggleExpansion()}
              className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline underline-offset-2 transition-colors"
            >
              {meta?.isExpanded ? "Hide" : "Show"}
            </button>
          )}
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
            {formatDateTime(row.created_at)}
          </span>
          <span className="text-[10px] text-gray-400 capitalize">
            Updated {new Date(row.updated_at).toLocaleDateString()}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen space-y-4">
      <StatusCards isLoading={loading} items={statuses} minimal={true} />

      {/* Toolbar Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800/60 transition-all">
        <div className="flex flex-1 flex-wrap items-center gap-4 lg:gap-8">
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
                  "relative px-4 py-1.5 rounded-lg text-sm font-bold transition-colors duration-200 capitalize min-w-[80px]",
                  (filters.rfqType || "any") === type
                    ? "text-white dark:text-gray-900"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100",
                )}
              >
                {(filters.rfqType || "any") === type && (
                  <motion.div
                    layoutId="active-tab-rfq-type-admin"
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

          {/* Status Dropdown */}
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
              <SelectTrigger className="h-8 min-w-[140px] bg-transparent border-none shadow-none focus:ring-0 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all rounded-lg px-3 font-bold text-sm text-gray-900 dark:text-gray-100">
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
                  "rejected",
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

          {/* Search Bar */}
          <div className="relative group flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              placeholder="Search by RFQ, Company, Name or Email..."
              className="pl-10 h-10 bg-gray-100/50 dark:bg-gray-800/40 border-gray-200/50 dark:border-gray-700/50 rounded-xl focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 font-semibold text-xs tracking-wide uppercase rounded-xl"
          >
            <ArrowUpFromLine size={14} className="opacity-60" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Content Section */}
      <div className="pt-2">
        {loading && quotes.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 py-4 px-6 bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800"
              >
                <Skeleton className="w-24 h-4 rounded-full" />
                <Skeleton className="w-32 h-4 rounded-full" />
                <Skeleton className="w-20 h-4 rounded-full" />
                <Skeleton className="w-24 h-4 rounded-full" />
                <Skeleton className="w-24 h-4 rounded-full" />
              </div>
            ))}
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
              <div className="relative w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-200 dark:border-gray-700">
                <CubeIcon className="w-10 h-10 text-gray-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Quotes Found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              We couldn't find any quotes matching your current filters or
              search criteria.
            </p>
            {(filters.status !== "Any" ||
              filters.rfqType !== "any" ||
              searchQuery) && (
              <Button
                variant="link"
                className="mt-4 text-blue-600 font-semibold"
                onClick={() => {
                  setFilters({ status: "Any", rfqType: "any" });
                  setSearchQuery("");
                }}
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <div className="bg-white dark:bg-gray-950/50 rounded-[2rem] border border-gray-100 dark:border-gray-800/60 overflow-hidden shadow-xl shadow-gray-200/20 dark:shadow-none">
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
                            className="hover:bg-white dark:hover:bg-gray-800/40 rounded-xl transition-all duration-300 px-4 py-1.5"
                          >
                            <div className="flex items-center group/part w-full pr-4">
                              <div className="flex items-center gap-4">
                                <div
                                  onClick={() =>
                                    setSelectedFile(part.cad_file_url)
                                  }
                                  className="relative w-12 h-12 rounded-lg cursor-pointer bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center p-1.5 overflow-hidden group/thumb transition-transform hover:scale-105 active:scale-95 shadow-sm"
                                >
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
                    label: "Admin Review",
                    icon: <EyeIcon className="w-4 h-4" />,
                    onClick: (quote) =>
                      router.push(`/admin/quotes/${quote.id}`),
                  },
                ]}
              />
            </div>
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
