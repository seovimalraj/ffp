"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EyeIcon, CubeIcon } from "@heroicons/react/24/outline";
import { posthog } from "posthog-js";
import { apiClient } from "@/lib/api";
import { Column } from "@/components/ui/data-table";
import { IRFQStatuses } from "@/types";
import { DataView } from "@/components/ui/data-view";
import Link from "next/link";
import { formatDate } from "@/lib/format";

// Types based on RFQ API response
interface Quote {
  id: string;
  rfq_code: string;
  user_id: string;
  final_price: number | null;
  status: IRFQStatuses;
  created_at: string;
  updated_at: string;
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
  const [filters, _setFilters] = useState<Filters>({
    query: "",
    status: "Any",
    dateRange: { from: undefined, to: undefined },
  });

  useEffect(() => {
    // Track page view
    posthog.capture("quotes_list_view");

    // Fetch quotes from API
    const fetchQuotes = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get("/rfq");
        console.log(response.data);
        setQuotes(response.data.rfqs || []);
      } catch (error) {
        console.error("Failed to fetch quotes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotes();
  }, []);

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
  };

  const getStatusChip = (status: IRFQStatuses) => {
    const config = STATUS_CONFIG[status];

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
          href={`/quote-config/${row.id}`}
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
    <div className="min-h-screen">
      <div className="mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Quotes ({quotes.length})</CardTitle>
          </CardHeader>
          <CardContent>
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
                <DataView
                  columns={columns}
                  data={filteredQuotes}
                  searchPlaceholder="Search quotes..."
                  keyExtractor={(m) => m.id}
                  emptyMessage="No Quotes Found"
                  isLoading={loading}
                  defaultView="table"
                  showViewToggle={true}
                  numbering={true}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
