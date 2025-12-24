"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ClockIcon,
  CurrencyDollarIcon,
  UserIcon,
  TruckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  TagIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

interface KanbanOrder {
  id: string;
  quoteId: string;
  customerName: string;
  customerEmail: string;
  status: "quote" | "ordered" | "production" | "shipping" | "delivered";
  priority: "low" | "normal" | "high" | "urgent";
  totalValue: number;
  currency: string;
  orderDate: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  items: Array<{
    id: string;
    partName: string;
    fileName: string;
    quantity: number;
    material: string;
    process: string;
    unitPrice: number;
  }>;
  timeline: Array<{
    status: string;
    timestamp: string;
    notes?: string;
    userId?: string;
  }>;
  assignedTo?: string;
  tags: string[];
  notes: string;
  lastUpdated: string;
}

interface KanbanData {
  quote: KanbanOrder[];
  ordered: KanbanOrder[];
  production: KanbanOrder[];
  shipping: KanbanOrder[];
  delivered: KanbanOrder[];
}

interface KanbanStats {
  totalOrders: number;
  totalValue: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

const COLUMN_CONFIG = {
  quote: {
    title: "Quotes",
    color: "bg-blue-50 border-blue-200",
    headerColor: "bg-blue-100 text-blue-800",
    icon: CurrencyDollarIcon,
  },
  ordered: {
    title: "Orders",
    color: "bg-orange-50 border-orange-200",
    headerColor: "bg-orange-100 text-orange-800",
    icon: CheckCircleIcon,
  },
  production: {
    title: "Production",
    color: "bg-yellow-50 border-yellow-200",
    headerColor: "bg-yellow-100 text-yellow-800",
    icon: ExclamationTriangleIcon,
  },
  shipping: {
    title: "Shipping",
    color: "bg-purple-50 border-purple-200",
    headerColor: "bg-purple-100 text-purple-800",
    icon: TruckIcon,
  },
  delivered: {
    title: "Delivered",
    color: "bg-green-50 border-green-200",
    headerColor: "bg-green-100 text-green-800",
    icon: CheckCircleIcon,
  },
};

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-800",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const STATUS_ORDER = [
  "quote",
  "ordered",
  "production",
  "shipping",
  "delivered",
];

export function KanbanBoard() {
  const [kanbanData, setKanbanData] = useState<KanbanData | null>(null);
  const [stats, setStats] = useState<KanbanStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadKanbanData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/orders/kanban");

      if (!response.ok) {
        throw new Error("Failed to load orders");
      }

      const result = await response.json();
      setKanbanData(result.data);
      setStats(result.stats);
    } catch (err) {
      console.error("Failed to load Kanban data:", err);
      setError("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateOrderStatus = async (
    orderId: string,
    newStatus: string,
    notes?: string,
  ) => {
    try {
      const response = await fetch("/api/orders/kanban", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          newStatus,
          notes,
          userId: "demo-user",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order status");
      }

      // Refresh data
      loadKanbanData();
    } catch (error) {
      console.error("Failed to update order:", error);
    }
  };

  useEffect(() => {
    loadKanbanData();
  }, [loadKanbanData]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={`loading-${i}`}
                className="bg-gray-100 rounded-lg h-96"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !kanbanData || !stats) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-red-600 mb-4">{error || "No data available"}</p>
            <Button onClick={loadKanbanData}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Order Management
        </h1>
        <p className="text-gray-600">
          Manage your manufacturing orders through the production pipeline
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Orders
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalOrders}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <CheckCircleIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalValue.toLocaleString()}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  In Production
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.byStatus.production}
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Urgent Orders
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.byPriority.urgent}
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <ClockIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {STATUS_ORDER.map((columnId) => {
          const config = COLUMN_CONFIG[columnId as keyof typeof COLUMN_CONFIG];
          const orders = kanbanData[columnId as keyof KanbanData];

          return (
            <div
              key={columnId}
              className={`rounded-lg border-2 ${config.color} p-4`}
            >
              {/* Column Header */}
              <div
                className={`flex items-center justify-between mb-4 p-3 rounded-lg ${config.headerColor}`}
              >
                <div className="flex items-center">
                  <config.icon className="w-5 h-5 mr-2" />
                  <h3 className="font-semibold">{config.title}</h3>
                </div>
                <Badge variant="secondary">{orders.length}</Badge>
              </div>

              {/* Orders */}
              <div className="space-y-3 min-h-[200px]">
                {orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onMoveOrder={updateOrderStatus}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface OrderCardProps {
  readonly order: KanbanOrder;
  readonly onMoveOrder: (
    orderId: string,
    newStatus: string,
    notes?: string,
  ) => void;
}

function OrderCard({ order, onMoveOrder }: OrderCardProps) {
  const daysUntilDelivery = order.estimatedDelivery
    ? Math.ceil(
        (new Date(order.estimatedDelivery).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  const getDeliveryText = () => {
    if (daysUntilDelivery !== null && daysUntilDelivery >= 0) {
      return `${daysUntilDelivery} days`;
    }
    if (order.status === "delivered") {
      return "Delivered";
    }
    return "Overdue";
  };

  const getNextStatus = () => {
    const currentIndex = STATUS_ORDER.indexOf(order.status);
    if (currentIndex >= 0 && currentIndex < STATUS_ORDER.length - 1) {
      return STATUS_ORDER[currentIndex + 1];
    }
    return null;
  };

  const nextStatus = getNextStatus();
  const nextStatusConfig = nextStatus
    ? COLUMN_CONFIG[nextStatus as keyof typeof COLUMN_CONFIG]
    : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Order Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold text-gray-900">{order.id}</h4>
            <p className="text-sm text-gray-600">{order.customerName}</p>
          </div>
          <Badge className={PRIORITY_COLORS[order.priority]}>
            {order.priority}
          </Badge>
        </div>

        {/* Order Value */}
        <div className="flex items-center mb-2">
          <CurrencyDollarIcon className="w-4 h-4 text-gray-500 mr-1" />
          <span className="font-medium text-gray-900">
            {order.totalValue.toLocaleString()} {order.currency}
          </span>
        </div>

        {/* Items Count */}
        <div className="text-sm text-gray-600 mb-3">
          {order.items.length} item{order.items.length !== 1 ? "s" : ""}
          {order.items.length > 0 && (
            <span className="block truncate">
              {order.items[0].partName}
              {order.items.length > 1 && ` +${order.items.length - 1} more`}
            </span>
          )}
        </div>

        {/* Delivery Timeline */}
        {order.estimatedDelivery && (
          <div className="flex items-center text-sm mb-3">
            <CalendarIcon className="w-4 h-4 text-gray-500 mr-1" />
            <span
              className={`${
                daysUntilDelivery !== null && daysUntilDelivery < 3
                  ? "text-red-600 font-medium"
                  : "text-gray-600"
              }`}
            >
              {getDeliveryText()}
            </span>
          </div>
        )}

        {/* Assigned To */}
        {order.assignedTo && (
          <div className="flex items-center text-sm mb-3">
            <UserIcon className="w-4 h-4 text-gray-500 mr-1" />
            <span className="text-gray-600 truncate">{order.assignedTo}</span>
          </div>
        )}

        {/* Tags */}
        {order.tags.length > 0 && (
          <div className="flex items-center flex-wrap gap-1 mb-2">
            <TagIcon className="w-3 h-3 text-gray-400 mr-1" />
            {order.tags.slice(0, 2).map((tag, i) => (
              <Badge key={`${tag}-${i}`} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {order.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{order.tags.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Progress Bar (for production/shipping) */}
        {(order.status === "production" || order.status === "shipping") && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span>{order.status === "production" ? "60%" : "90%"}</span>
            </div>
            <Progress
              value={order.status === "production" ? 60 : 90}
              className="h-2"
            />
          </div>
        )}

        {/* Move Action */}
        {nextStatus && nextStatusConfig && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onMoveOrder(order.id, nextStatus)}
              className="w-full text-xs"
            >
              Move to {nextStatusConfig.title}
              <ChevronRightIcon className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-500 mt-3">
          Updated {new Date(order.lastUpdated).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}
