"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EyeIcon, CubeIcon } from "@heroicons/react/24/outline";
import { posthog } from "posthog-js";
import { apiClient } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/data-table";
import { IRFQStatuses } from "@/types";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { useMetaStore } from "@/components/store/title-store";
import { StatusCards } from "@/components/ui/status-cards";
import { CheckCircle, Clock, File, Wallet } from "lucide-react";

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
}

interface Filters {
  query: string;
  status: string;
  dateRange: { from: Date | undefined; to: Date | undefined };
}

export default function QuotesListPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [filters, _setFilters] = useState<Filters>({
    query: "",
    status: "Any",
    dateRange: { from: undefined, to: undefined },
  });
  const { setPageTitle, resetTitle } = useMetaStore();
  const QUOTE_LIMIT = 20;

  useEffect(() => {
    setPageTitle("Quotes");
    return () => {
      resetTitle();
    };
  }, []);

  const fetchQuotes = React.useCallback(
    async (isNext = false) => {
      if (isNext) {
        setIsFetchingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const lastQuote = isNext ? quotes[quotes.length - 1] : null;
        const params = {
          limit: QUOTE_LIMIT,
          cursorCreatedAt: lastQuote?.created_at,
          cursorId: lastQuote?.id,
          status:
            filters.status !== "Any" ? filters.status.toLowerCase() : undefined,
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
    [quotes, filters.status],
  );

  useEffect(() => {
    // Track page view
    posthog.capture("quotes_list_view");
    fetchQuotes();
  }, [filters.status]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) => {
      // Search query filter
      if (
        filters.query &&
        !quote.rfq_code.toLowerCase().includes(filters.query.toLowerCase())
      ) {
        return false;
      }

      // Status filter
      if (
        filters.status !== "Any" &&
        quote.status !== filters.status.toLowerCase()
      ) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.from || filters.dateRange.to) {
        const quoteDate = new Date(quote.created_at);
        if (filters.dateRange.from && quoteDate < filters.dateRange.from)
          return false;
        if (filters.dateRange.to && quoteDate > filters.dateRange.to)
          return false;
      }

      return true;
    });
  }, [quotes, filters]);

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
    const config = STATUS_CONFIG[status];

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
                : `/checkout/${row.id}`
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
      render: (row) => row.parts_count,
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
        isLoading={loading}
        items={[
          {
            label: "Total Quotes",
            value: quotes.length,
            icon: CubeIcon,
            color: "blue",
          },
          {
            label: "Draft Quotes",
            value: quotes.filter((quote) => quote.status === "draft").length,
            icon: File,
            color: "gray",
          },
          {
            label: "Pending Quotes",
            value: quotes.filter((quote) => quote.status === "pending approval")
              .length,
            icon: Clock,
            color: "lime",
          },
          {
            label: "Submitted Quotes",
            value: quotes.filter((quote) => quote.status === "submitted")
              .length,
            icon: CheckCircle,
            color: "orange",
          },
          {
            label: "Paid Quotes",
            value: quotes.filter((quote) => quote.status === "paid").length,
            icon: Wallet,
            color: "green",
          },
        ]}
      />
      <div className="mx-auto">
        <div>
          <div className="mt-4">
            {loading ? (
              <div className="space-y-4">
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
            ) : filteredQuotes.length === 0 ? (
              <div className="text-center py-12">
                <CubeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No quotes yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Drag & drop a CAD file on the Dashboard to start an instant
                  quote.
                </p>
                <Button onClick={() => router.push("/portal/dashboard")}>
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              <>
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
                  actions={[
                    {
                      label: "Open",
                      icon: <EyeIcon className="w-4 h-4" />,
                      onClick: (quote) => handleOpenQuote(quote.id),
                    },
                  ]}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
