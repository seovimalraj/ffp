"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EyeIcon, CubeIcon } from "@heroicons/react/24/outline";
import { apiClient } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/data-table";
import { IRFQStatuses } from "@/types";
import Link from "next/link";
import { formatDate, formatCurrencyGeneric } from "@/lib/format";
import { useMetaStore } from "@/components/store/title-store";
import { StatusCards } from "@/components/ui/status-cards";
import { CheckCircle, Clock, Wallet, Building2, Search } from "lucide-react";
import { RequireAnyRole } from "@/components/auth/RequireAnyRole";
import { Input } from "@/components/ui/input";

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
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [statusFilter] = useState("Any");
  const [searchQuery, setSearchQuery] = useState("");
  const { setPageTitle, resetTitle } = useMetaStore();
  const QUOTE_LIMIT = 20;

  useEffect(() => {
    setPageTitle("Quotes");
    return () => resetTitle();
  }, []);

  const fetchQuotes = React.useCallback(
    async (isNext = false) => {
      if (isNext) setIsFetchingMore(true);
      else setLoading(true);

      try {
        const lastQuote = isNext ? quotes[quotes.length - 1] : null;
        const params: any = {
          limit: QUOTE_LIMIT,
          status:
            statusFilter !== "Any" ? statusFilter.toLowerCase() : undefined,
        };

        if (isNext && lastQuote) {
          params.cursorCreatedAt = lastQuote.created_at;
          params.cursorId = lastQuote.id;
        }

        const response = await apiClient.get("/rfq/admin/all", { params });
        const newData = response.data.data || [];

        setQuotes((prev) => (isNext ? [...prev, ...newData] : newData));
        setHasMore(response.data.hasMore);
      } catch (error) {
        console.error("Failed to fetch admin quotes:", error);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [quotes, statusFilter],
  );

  useEffect(() => {
    fetchQuotes();
  }, [statusFilter]);

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

  const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
    accepted: { label: "Accepted", variant: "success" },
    quoted: { label: "Quoted", variant: "secondary" },
    draft: { label: "Draft", variant: "warning" },
    rejected: { label: "Rejected", variant: "destructive" },
    pending: { label: "Pending", variant: "warning" },
    submitted: { label: "Submitted", variant: "default" },
    "payment pending": { label: "Payment Pending", variant: "warning" },
    "pending approval": { label: "Pending Approval", variant: "secondary" },
    paid: { label: "Paid", variant: "success" },
  };

  const TYPE_CONFIG: Record<
    "general" | "manual",
    { label: string; variant: any }
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
          className="text-indigo-600 hover:text-indigo-800 font-bold underline"
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
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <span className="font-semibold text-slate-900">
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
          <span className="text-sm font-medium text-slate-700">
            {row.user_name || "N/A"}
          </span>
          <span className="text-[10px] text-slate-500 font-mono tracking-tighter">
            {row.user_email}
          </span>
        </div>
      ),
    },
    {
      key: "final_price",
      header: "Value",
      render: (row) => (
        <span className="font-bold text-slate-900">
          {row.final_price ? formatCurrencyGeneric(row.final_price) : "Pending"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const config = STATUS_CONFIG[row.status] || {
          label: row.status,
          variant: "outline",
        };
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
        const config = TYPE_CONFIG[row.rfq_type] || {
          label: row.rfq_type,
          variant: "outline",
        };
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
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
          {row.parts_count}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created Date",
      render: (row) => {
        return (
          <div className="flex flex-col">
            <span className="text-slate-700 text-sm font-medium">
              {formatDate(row.created_at)}
            </span>
            <span className="text-[10px] text-slate-400 capitalize">
              Modified {new Date(row.updated_at).toLocaleDateString()}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Quotations
          </h1>
          <p className="text-slate-500 text-sm">
            Centralized management for all platform manufacture requests.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by ID, Company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 w-64 rounded-xl border-slate-200 focus:ring-indigo-500"
            />
          </div>
          <Button
            onClick={() => fetchQuotes()}
            variant="outline"
            className="h-11 rounded-xl gap-2 border-slate-200"
          >
            Refresh
          </Button>
        </div>
      </div>

      <StatusCards
        isLoading={loading}
        items={[
          {
            label: "Total Quotes",
            value: quotes.length,
            icon: CubeIcon,
            color: "blue",
          },
          {
            label: "Manual Reviews",
            value: quotes.filter((q) => q.status === "pending approval").length,
            icon: Clock,
            color: "orange",
          },
          {
            label: "Active RFQs",
            value: quotes.filter((q) => q.status === "submitted").length,
            icon: CheckCircle,
            color: "indigo",
          },
          {
            label: "Total Published",
            value: quotes.filter((q) => q.status === "quoted").length,
            icon: Wallet,
            color: "green",
          },
        ]}
      />

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-xl shadow-slate-200/50">
        {loading && quotes.length === 0 ? (
          <div className="p-12 space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredQuotes}
            keyExtractor={(m) => m.id}
            emptyMessage="No Quotations Found"
            isLoading={loading || isFetchingMore}
            numbering={true}
            hasMore={hasMore}
            onEndReached={() => {
              if (hasMore && !isFetchingMore) {
                fetchQuotes(true);
              }
            }}
            actions={[
              {
                label: "Admin Review",
                icon: <EyeIcon className="w-4 h-4" />,
                onClick: (quote) => router.push(`/admin/quotes/${quote.id}`),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
