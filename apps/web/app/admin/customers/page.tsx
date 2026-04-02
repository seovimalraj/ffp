"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Plus,
  ArrowUpFromLine,
  Mail,
  Phone,
  CheckCircle2,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import { useMetaStore } from "@/components/store/title-store";
import { StatusCards, StatusItem } from "@/components/ui/status-cards";

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  verified: boolean;
  created_at: string;
  organizations?: {
    id: string;
    name: string;
    display_name: string | null;
  };
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const customersRef = React.useRef<Customer[]>([]);

  const { setPageTitle, resetTitle } = useMetaStore();
  const PAGE_LIMIT = 20;

  useEffect(() => {
    setPageTitle("Users");
    return () => {
      resetTitle();
    };
  }, [setPageTitle, resetTitle]);

  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  const fetchCustomers = React.useCallback(
    async (isNext = false) => {
      if (isNext) {
        setIsFetchingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = {
          limit: PAGE_LIMIT,
          offset: isNext ? customersRef.current.length : 0,
        };

        const response = await apiClient.get("/admin/customers", {
          params,
        });
        const { data, pagination } = response.data;

        setCustomers((prev) => (isNext ? [...prev, ...data] : data));
        setHasMore(pagination.hasMore);
        setTotalCount(pagination.total);
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [PAGE_LIMIT],
  );

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const stats: StatusItem[] = useMemo(
    () => [
      {
        label: "Total Users",
        value: totalCount,
        color: "indigo",
        icon: Users,
        priority: 1,
      },
    ],
    [totalCount],
  );

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "User",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            {row.name?.charAt(0) || row.email.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {row.name || "N/A"}
            </span>
            <div className="flex items-center gap-2">
              {row.verified ? (
                <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">
                  <CheckCircle2 size={12} />
                  Verified
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Pending
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Mail size={12} className="opacity-60" />
            {row.email}
          </div>
          {row.phone && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Phone size={12} className="opacity-60" />
              {row.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (row) => (
        <span className="text-gray-700 dark:text-gray-300 font-medium">
          {row.organizations?.name || "Independent"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Joined",
      render: (row) => (
        <div className="text-xs text-gray-500">
          {formatDate(row.created_at)}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen space-y-4">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            Customers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage relationships and oversee all registered customer accounts
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
            className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-2 font-semibold text-xs tracking-wide uppercase"
            disabled
          >
            <Plus size={14} />
            <span>Add User</span>
          </Button>
        </div>
      </div>

      <StatusCards isLoading={loading} items={stats} minimal={true} />

      {/* Content Section */}
      <div className="pt-2">
        {loading && customers.length === 0 ? (
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
              data={customers}
              keyExtractor={(m) => m.id}
              emptyMessage="No Customers Found"
              isLoading={loading || isFetchingMore}
              numbering={true}
              hasMore={hasMore}
              onEndReached={() => {
                if (hasMore && !isFetchingMore) {
                  fetchCustomers(true);
                }
              }}
              actions={[
                {
                  label: "View",
                  onClick: (customer) =>
                    console.log("View customer", customer.id),
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
