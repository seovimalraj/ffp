"use client";

import {
  TrendingUp,
  Package,
  Clock,
  DollarSign,
  FileText,
  ArrowUpRight,
  ArrowRight,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DashboardAPI,
  DashboardStats,
  RecentOrder,
  RecentQuote,
} from "../../../lib/api/dashboard";
import { toast } from "sonner";
import CustomLoader from "@/components/ui/loader/CustomLoader";

export default function CustomerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeQuotes: 0,
    openOrders: 0,
    totalSpent: "$0",
    avgLeadTime: "0 days",
  });
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [statsData, quotesData, ordersData] = await Promise.all([
          DashboardAPI.getStats(),
          DashboardAPI.getRecentQuotes(),
          DashboardAPI.getRecentOrders(),
        ]);

        setStats(statsData);
        setRecentQuotes(quotesData);
        setRecentOrders(ordersData);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const statItems = [
    {
      label: "Active Quotes",
      value: stats.activeQuotes.toString(),
      change: "Active now",
      trend: "neutral",
      icon: FileText,
      color: "blue",
      href: "/portal/quotes",
    },
    {
      label: "Open Orders",
      value: stats.openOrders.toString(),
      change: "In progress",
      trend: "neutral",
      icon: Package,
      color: "green",
      href: "/portal/orders",
    },
    {
      label: "Total Spent",
      value: stats.totalSpent,
      change: "Lifetime",
      trend: "up",
      icon: DollarSign,
      color: "purple",
      href: "/portal/orders",
    },
    {
      label: "Avg Lead Time",
      value: stats.avgLeadTime,
      change: "Target: 5 days",
      trend: "neutral",
      icon: Clock,
      color: "orange",
      href: "/portal/analytics",
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_review: "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-600/20",
      approved: "bg-green-100 text-green-700 ring-1 ring-green-600/20",
      draft: "bg-gray-100 text-gray-700 ring-1 ring-gray-600/20",
      in_production: "bg-blue-100 text-blue-700 ring-1 ring-blue-600/20",
      quality_check: "bg-purple-100 text-purple-700 ring-1 ring-purple-600/20",
      shipped: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-600/20",
      completed: "bg-green-100 text-green-700 ring-1 ring-green-600/20",
    };
    return (
      colors[status] || "bg-gray-100 text-gray-700 ring-1 ring-gray-600/20"
    );
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; ring: string }> = {
      blue: {
        bg: "bg-blue-500/10",
        text: "text-blue-600",
        ring: "ring-blue-500/20",
      },
      green: {
        bg: "bg-green-500/10",
        text: "text-green-600",
        ring: "ring-green-500/20",
      },
      purple: {
        bg: "bg-purple-500/10",
        text: "text-purple-600",
        ring: "ring-purple-500/20",
      },
      orange: {
        bg: "bg-orange-500/10",
        text: "text-orange-600",
        ring: "ring-orange-500/20",
      },
    };
    return colors[color] || colors.blue;
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <CustomLoader />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-6">
      <div className="flex items-center justify-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Overview of your manufacturing activities
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((stat) => {
          const Icon = stat.icon;
          const colors = getColorClasses(stat.color);
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group relative bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${colors.bg} ${colors.text} p-2.5 rounded-lg`}>
                  <Icon size={20} />
                </div>
                {stat.trend === "up" && (
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                    <TrendingUp size={12} />
                    {stat.change}
                  </span>
                )}
                {stat.trend === "neutral" && (
                  <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                    {stat.change}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  {stat.label}
                </div>
              </div>
              <ArrowUpRight
                className="absolute top-5 right-5 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1 group-hover:-translate-y-1"
                size={18}
              />
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Quotes */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col h-full">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText size={18} className="text-gray-400" />
              Recent Quotes
            </h2>
            <Link
              href="/portal/quotes"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:gap-1.5 transition-all"
            >
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="p-4 flex-1">
            {recentQuotes.length > 0 ? (
              <div className="space-y-3">
                {recentQuotes.map((quote) => (
                  <Link
                    key={quote.id}
                    href={`/portal/quotes/${quote.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {quote.rfq_code || quote.id}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${getStatusColor(quote.status)}`}
                      >
                        {quote.status?.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">
                        {quote.description}
                      </p>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {quote.amount}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
                      <span>{quote.date}</span>
                      <span>•</span>
                      <span>
                        {quote.parts} {quote.parts === 1 ? "part" : "parts"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <FileText size={32} className="mb-2 opacity-20" />
                <p className="text-sm">No recent quotes found</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col h-full">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Package size={18} className="text-gray-400" />
              Recent Orders
            </h2>
            <Link
              href="/portal/orders"
              className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1 hover:gap-1.5 transition-all"
            >
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="p-4 flex-1">
            {recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/portal/orders/${order.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {order.order_code || order.id}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${getStatusColor(order.status)}`}
                      >
                        {order.status?.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">
                        {order.description}
                      </p>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {order.amount}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-gray-400">
                        Due: {order.dueDate}
                      </span>
                      <div className="w-16 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${order.progress}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Package size={32} className="mb-2 opacity-20" />
                <p className="text-sm">No recent orders found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Ready for your next project?
            </h2>
            <p className="text-gray-300 max-w-lg">
              Get instant pricing and lead times for CNC machining, Injection
              Molding, Vacuum Casting, and sheet metal fabrication.
            </p>
          </div>
          <Link
            href="/instant-quote"
            className="px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition-colors font-semibold shadow-lg whitespace-nowrap"
          >
            Start New Quote
          </Link>
        </div>
      </div>
    </div>
  );
}
