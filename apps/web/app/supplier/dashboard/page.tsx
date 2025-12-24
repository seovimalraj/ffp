"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Package,
  DollarSign,
  Factory,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  getSupplierDashboardStats,
  getSupplierActiveOrders,
} from "@/lib/database";

export default function SupplierDashboardPage() {
  const [stats, setStats] = useState({
    activeOrders: 0,
    monthlyRevenue: 0,
    machineUtilization: 0,
    avgLeadTime: 0,
  });
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [statsData, ordersData] = await Promise.all([
          getSupplierDashboardStats(),
          getSupplierActiveOrders(),
        ]);

        setStats(statsData);
        setActiveOrders(ordersData);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const statCards = [
    {
      label: "Active Orders",
      value: loading ? "..." : stats.activeOrders.toString(),
      change: loading ? "..." : `${stats.activeOrders} in progress`,
      trend: "up",
      icon: Package,
      color: "emerald",
      href: "/supplier/orders",
    },
    {
      label: "Monthly Revenue",
      value: loading
        ? "..."
        : `$${stats.monthlyRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "From active orders",
      trend: "up",
      icon: DollarSign,
      color: "green",
      href: "/supplier/analytics",
    },
    {
      label: "Machine Utilization",
      value: loading ? "..." : `${stats.machineUtilization}%`,
      change:
        stats.machineUtilization > 80 ? "High capacity" : "Capacity available",
      trend: stats.machineUtilization > 80 ? "up" : "neutral",
      icon: Factory,
      color: "teal",
      href: "/supplier/capacity",
    },
    {
      label: "Avg Lead Time",
      value: loading ? "..." : `${stats.avgLeadTime} days`,
      change: "On target",
      trend: "neutral",
      icon: Clock,
      color: "cyan",
      href: "/supplier/analytics",
    },
  ];

  const alerts = [
    {
      type: "warning",
      message: "Low material stock: Aluminum 6061 (85kg remaining)",
      action: "View Inventory",
      href: "/supplier/inventory",
    },
    {
      type: "warning",
      message: "CNC Mill #3 at 98% utilization",
      action: "View Capacity",
      href: "/supplier/capacity",
    },
    {
      type: "success",
      message: "5 orders completed this week",
      action: "View Orders",
      href: "/supplier/orders",
    },
    {
      type: "info",
      message: "3 new RFQs awaiting response",
      action: "View RFQs",
      href: "/supplier/orders",
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      in_production: "bg-blue-100 text-blue-700 ring-1 ring-blue-600/20",
      pending: "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-600/20",
      quality_check: "bg-purple-100 text-purple-700 ring-1 ring-purple-600/20",
      completed: "bg-green-100 text-green-700 ring-1 ring-green-600/20",
      shipped: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-600/20",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getAlertIcon = (type: string) => {
    if (type === "warning") return AlertTriangle;
    if (type === "success") return CheckCircle2;
    return AlertCircle;
  };

  const getAlertColor = (type: string) => {
    if (type === "warning")
      return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100";
    if (type === "success")
      return "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 text-green-900 dark:text-green-100";
    return "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 text-blue-900 dark:text-blue-100";
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; ring: string }> = {
      emerald: {
        bg: "bg-emerald-500/10",
        text: "text-emerald-600",
        ring: "ring-emerald-500/20",
      },
      green: {
        bg: "bg-green-500/10",
        text: "text-green-600",
        ring: "ring-green-500/20",
      },
      teal: {
        bg: "bg-teal-500/10",
        text: "text-teal-600",
        ring: "ring-teal-500/20",
      },
      cyan: {
        bg: "bg-cyan-500/10",
        text: "text-cyan-600",
        ring: "ring-cyan-500/20",
      },
    };
    return colors[color] || colors.emerald;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Production Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
            Monitor your manufacturing operations and capacity
          </p>
        </div>
        <Link
          href="/supplier/capacity"
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-105 font-semibold"
        >
          <Factory size={20} />
          View Capacity
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const colors = getColorClasses(stat.color);
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group relative bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 dark:border-gray-800/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] overflow-hidden"
            >
              {/* Background gradient */}
              <div
                className={`absolute inset-0 ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`${colors.bg} ${colors.text} p-3 rounded-xl ring-2 ${colors.ring}`}
                  >
                    <Icon size={24} />
                  </div>
                  {!loading && (
                    <ArrowUpRight
                      className="text-gray-400 group-hover:text-emerald-600 transition-colors"
                      size={20}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {loading ? (
                      <Loader2 className="w-8 h-8 animate-spin inline" />
                    ) : (
                      stat.value
                    )}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    {!loading && stat.trend === "up" && (
                      <TrendingUp size={14} />
                    )}
                    {stat.change}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Alerts */}
      {!loading && alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((alert, idx) => {
            const AlertIcon = getAlertIcon(alert.type);
            return (
              <div
                key={idx}
                className={`p-5 rounded-xl border shadow-md ${getAlertColor(alert.type)}`}
              >
                <div className="flex items-start gap-3">
                  <AlertIcon
                    className={`flex-shrink-0 mt-0.5 ${alert.type === "warning" ? "text-yellow-600" : alert.type === "success" ? "text-green-600" : "text-blue-600"}`}
                    size={20}
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{alert.message}</p>
                    <Link
                      href={alert.href}
                      className={`text-sm mt-2 inline-flex items-center gap-1 font-medium ${alert.type === "warning" ? "text-yellow-700 hover:text-yellow-800" : alert.type === "success" ? "text-green-700 hover:text-green-800" : "text-blue-700 hover:text-blue-800"}`}
                    >
                      {alert.action}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Orders */}
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/50 shadow-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Package size={24} className="text-emerald-600" />
              Active Orders
            </h2>
            <Link
              href="/supplier/orders"
              className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              View All
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No active orders</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/supplier/production/${order.id}`}
                  className="group flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-900"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                        {order.id}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {order.customer_company || order.customer_name} •{" "}
                      {Array.isArray(order.parts) ? order.parts.length : 0}{" "}
                      parts
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      $
                      {Number(order.total_price).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                    >
                      {order.status.replace("_", " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 shadow-2xl shadow-emerald-500/30">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <h2 className="text-2xl font-bold mb-2">Optimize Production</h2>
            <p className="text-emerald-100">
              Manage machine capacity and schedule efficiently
            </p>
          </div>
          <Link
            href="/supplier/schedule"
            className="px-8 py-4 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all duration-300 hover:scale-105 font-bold text-lg shadow-xl"
          >
            View Schedule
          </Link>
        </div>
      </div>
    </div>
  );
}
