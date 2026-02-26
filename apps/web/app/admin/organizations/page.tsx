"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, ArrowUpFromLine } from "lucide-react";
import { apiClient } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import { useMetaStore } from "@/components/store/title-store";
import { StatusCards, StatusItem } from "@/components/ui/status-cards";

interface Organization {
  id: string;
  name: string;
  display_name: string | null;
  address: string | null;
  organization_type: string;
  created_at: string;
  updated_at: string;
  // Placeholder for future fields
  users_count?: number;
  quotes_count?: number;
  orders_count?: number;
  revenue?: string;
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const organizationsRef = React.useRef<Organization[]>([]);

  const { setPageTitle, resetTitle } = useMetaStore();
  const PAGE_LIMIT = 20;

  useEffect(() => {
    setPageTitle("Organizations");
    return () => {
      resetTitle();
    };
  }, [setPageTitle, resetTitle]);

  // Keep ref in sync
  useEffect(() => {
    organizationsRef.current = organizations;
  }, [organizations]);

  const fetchOrganizations = React.useCallback(
    async (isNext = false) => {
      if (isNext) {
        setIsFetchingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = {
          limit: PAGE_LIMIT,
          offset: isNext ? organizationsRef.current.length : 0,
        };

        const response = await apiClient.get("/admin", { params });
        const { data, pagination } = response.data;

        setOrganizations((prev) => (isNext ? [...prev, ...data] : data));
        setHasMore(pagination.hasMore);
        setTotalCount(pagination.total);
      } catch (error) {
        console.error("Failed to fetch organizations:", error);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [PAGE_LIMIT],
  );

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const stats: StatusItem[] = useMemo(
    () => [
      {
        label: "Total Organizations",
        value: totalCount,
        color: "blue",
        icon: Building2,
        priority: 1,
      },
      // We can add more stats here if the API provides them
    ],
    [totalCount],
  );

  const columns: Column<Organization>[] = [
    {
      key: "name",
      header: "Organization Name",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {row.name}
          </span>
          {row.display_name && (
            <span className="text-xs text-gray-500">{row.display_name}</span>
          )}
        </div>
      ),
    },
    {
      key: "organization_type",
      header: "Type",
      render: (row) => (
        <span className="capitalize px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-medium">
          {row.organization_type}
        </span>
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
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-500" />
            Organizations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Overview and management of all registered organizations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 transition-all flex items-center gap-2 font-semibold text-xs tracking-wide uppercase"
          >
            <ArrowUpFromLine size={14} className="opacity-60" />
            <span>Export</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-2 font-semibold text-xs tracking-wide uppercase"
            disabled
          >
            <Plus size={14} />
            <span>New Organization</span>
          </Button>
        </div>
      </div>

      <StatusCards isLoading={loading} items={stats} minimal={true} />

      {/* Content Section */}
      <div className="pt-2">
        {loading && organizations.length === 0 ? (
          <div className="space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 py-4 border-b border-gray-50 dark:border-gray-900/50"
              >
                <Skeleton className="w-48 h-4 rounded-full" />
                <Skeleton className="w-24 h-4 rounded-full" />
                <Skeleton className="w-32 h-4 rounded-full" />
                <Skeleton className="w-32 h-4 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <DataTable
              columns={columns}
              data={organizations}
              keyExtractor={(m) => m.id}
              emptyMessage="No Organizations Found"
              isLoading={loading || isFetchingMore}
              numbering={true}
              hasMore={hasMore}
              onEndReached={() => {
                if (hasMore && !isFetchingMore) {
                  fetchOrganizations(true);
                }
              }}
              actions={[
                {
                  label: "View",
                  onClick: (org) => console.log("View org", org.id),
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
