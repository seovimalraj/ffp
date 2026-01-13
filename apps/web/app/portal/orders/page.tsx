"use client";

import { useMetaStore } from "@/components/store/title-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, Column } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusCards } from "@/components/ui/status-cards";
import { apiClient } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { CubeIcon } from "@heroicons/react/24/outline";
import {
  EyeIcon,
  Package,
  Clock,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useEffect } from "react";

export type IOrder = {
  order_id: string;
  order_code: string;
  total_amount: number | null;
  confirmed_at: Date;
  payment_status: string;
  status: string;
  part_count: number;
  created_at: Date;
};

const Page = () => {
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { setPageTitle, resetTitle } = useMetaStore();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get("/orders");
        setOrders(response.data || []);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

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
          href={`/portal/orders/${row.order_id}`}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {row.order_code}
        </Link>
      ),
    },
    {
      key: "total_amount",
      header: "Total Amount",
      render: (row) => formatCurrency(row.total_amount || 0, "USD"),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => row.status,
    },
    {
      key: "payment_status",
      header: "Payment Status",
      render: (row) => row.payment_status,
    },
    {
      key: "parts_count",
      header: "Parts Count",
      render: (row) => row.part_count,
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
        isLoading={loading}
        items={[
          {
            label: "Total Orders",
            value: orders.length,
            icon: Package,
            color: "blue",
          },
          {
            label: "Pending Orders",
            value: orders.filter((order) => order.status === "pending").length,
            icon: Clock,
            color: "orange",
          },
          {
            label: "Completed Orders",
            value: orders.filter((order) => order.status === "completed")
              .length,
            icon: CheckCircle2,
            color: "green",
          },
          {
            label: "Payment Pending",
            value: orders.filter((order) => order.payment_status === "pending")
              .length,
            icon: DollarSign,
            color: "rose",
          },
        ]}
      />
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
              <div className="text-center py-12">
                <CubeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No orders yet
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
                  data={orders}
                  keyExtractor={(m) => m.order_code}
                  emptyMessage="No Orders Found"
                  isLoading={loading}
                  numbering={true}
                  actions={[
                    {
                      label: "Open",
                      icon: <EyeIcon className="w-4 h-4" />,
                      onClick: (order) =>
                        router.push(`/order/${order.order_code}`),
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
};

export default Page;
