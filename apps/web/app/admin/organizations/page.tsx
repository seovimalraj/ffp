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
  users?: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    role: string;
    verified: boolean;
    created_at: string;
  }[];
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

        const response = await apiClient.get("/admin/organizations", {
          params,
        });
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
        <span className="capitalize px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-medium border border-gray-200 dark:border-gray-700">
          {row.organization_type}
        </span>
      ),
    },
    {
      key: "primary_user",
      header: "Primary Contact",
      render: (row, _, meta) => {
        const primaryUser = row.users?.[0];
        return (
          <div className="flex items-center gap-3">
            <div className="flex flex-col max-w-[200px]">
              <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {primaryUser?.name || "No name"}
              </span>
              <span className="text-xs text-gray-500 truncate">
                {primaryUser?.email || "No email"}
              </span>
            </div>
            {row.users && row.users.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  meta?.toggleExpansion();
                }}
                className="text-blue-600 hover:text-blue-800 text-[10px] font-bold uppercase tracking-wider underline underline-offset-4 transition-colors ml-2"
              >
                {meta?.isExpanded
                  ? "Hide Members"
                  : `Show Members (${row.users.length})`}
              </button>
            )}
          </div>
        );
      },
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
              renderExpansion={(row) => (
                <div className="px-8 py-6 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-800/50">
                  <div className="mb-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Organization Members
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {row.users?.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                          {user.name?.charAt(0) ||
                            user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-gray-900 dark:text-gray-100 truncate text-sm">
                            {user.name || "N/A"}
                          </span>
                          <span className="text-xs text-gray-500 truncate mb-1">
                            {user.email}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                              {user.role}
                            </span>
                            {user.verified && (
                              <span className="px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/10 text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">
                                Verified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
