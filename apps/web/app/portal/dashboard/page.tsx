"use client";

import {
  TrendingUp,
  Package,
  Clock,
  FileText,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DashboardAPI,
  DashboardStats,
  RecentOrder,
  RecentQuote,
} from "@/lib/api/dashboard";
import { toast } from "sonner";
import CustomLoader from "@/components/ui/loader/CustomLoader";
import { useMetaStore } from "@/components/store/title-store";
import { motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils";

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

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

  const { setPageTitle, resetTitle } = useMetaStore();

  useEffect(() => {
    setPageTitle("Dashboard");
    return () => {
      resetTitle();
    };
  }, []);

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
      icon: (props: any) => (
        <img src="/icons/package.png" className="w-8 h-8" {...props} />
      ),
      color: "orange",
      href: "/portal/orders",
    },
    {
      label: "Total Spent",
      value: stats.totalSpent,
      change: "Lifetime",
      trend: "up",
      icon: (props: any) => (
        <img src="/icons/spending.png" className="w-8 h-8" {...props} />
      ),
      color: "purple",
      href: "/portal/orders",
    },
    {
      label: "Avg Lead Time",
      value: stats.avgLeadTime,
      change: "Target: 5 days",
      trend: "neutral",
      icon: (props: any) => (
        <img src="/icons/lead-time.png" className="w-8 h-8" {...props} />
      ),
      color: "green",
      href: "/portal/analytics",
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_review:
        "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-500/30",
      approved:
        "bg-green-50 text-green-700 ring-1 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/30",
      draft:
        "bg-gray-50 text-gray-700 ring-1 ring-gray-600/20 dark:bg-gray-900/20 dark:text-gray-400 dark:ring-gray-500/30",
      in_production:
        "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-500/30",
      quality_check:
        "bg-purple-50 text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-500/30",
      shipped:
        "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-500/30",
      completed:
        "bg-green-50 text-green-700 ring-1 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/30",
    };
    return (
      colors[status] ||
      "bg-gray-50 text-gray-700 ring-1 ring-gray-600/20 dark:bg-gray-900/20 dark:text-gray-400 dark:ring-gray-500/30"
    );
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; ring: string }> = {
      blue: {
        bg: "bg-blue-500/10 dark:bg-blue-500/20",
        text: "text-blue-600 dark:text-blue-400",
        ring: "ring-blue-500/20",
      },
      green: {
        bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        text: "text-emerald-600 dark:text-emerald-400",
        ring: "ring-emerald-500/20",
      },
      purple: {
        bg: "bg-purple-500/10 dark:bg-purple-500/20",
        text: "text-purple-600 dark:text-purple-400",
        ring: "ring-purple-500/20",
      },
      orange: {
        bg: "bg-orange-500/10 dark:bg-orange-500/20",
        text: "text-orange-600 dark:text-orange-400",
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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 p-6 lg:p-8 max-w-[1600px] mx-auto"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statItems.map((stat) => {
          const Icon = stat.icon;
          const colors = getColorClasses(stat.color);
          return (
            <motion.div variants={itemVariants} key={stat.label}>
              <Link
                href={stat.href}
                className="group relative block bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/50 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-6">
                  <div
                    className={cn(
                      "p-3 rounded-xl transition-colors duration-300",
                      colors.bg,
                      colors.text,
                    )}
                  >
                    <Icon strokeWidth={1.5} size={24} />
                  </div>
                  {stat.trend === "up" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full">
                      <TrendingUp size={12} />
                      {stat.change}
                    </span>
                  )}
                  {stat.trend === "neutral" && (
                    <span className="inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                      {stat.change}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {stat.value}
                  </div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </div>
                </div>
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-1 group-hover:-translate-y-1">
                  <ArrowUpRight
                    className="text-gray-300 dark:text-gray-600"
                    size={20}
                  />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Quotes */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FileText
                  size={18}
                  className="text-blue-600 dark:text-blue-400"
                />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Recent Quotes
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Latest activity from your quotes
                </p>
              </div>
            </div>
            <Link
              href="/portal/quotes"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 hover:gap-1.5 transition-all"
            >
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="flex-1 p-4">
            {recentQuotes.length > 0 ? (
              <div className="space-y-2">
                {recentQuotes.map((quote) => (
                  <Link
                    key={quote.id}
                    href={`/quote-config/${quote.id}`}
                    className="group flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all cursor-pointer"
                  >
                    <div className="flex flex-col gap-1 min-w-0 pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {quote.rfq_code || quote.id}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider",
                            getStatusColor(quote.status),
                          )}
                        >
                          {quote.status?.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[280px]">
                        {quote.description || "No description provided"}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                        <span>{quote.date}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <span>
                          {quote.parts} {quote.parts === 1 ? "part" : "parts"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-sm font-bold text-gray-900 dark:text-white">
                        {quote.amount}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <FileText
                    size={32}
                    className="text-gray-300 dark:text-gray-600"
                  />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  No quotes yet
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                  Start a new quote to see your activity here
                </p>
                <Link
                  href="/instant-quote"
                  className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus size={12} /> Create Quote
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Orders */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <Package
                  size={18}
                  className="text-orange-600 dark:text-orange-400"
                />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Recent Orders
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Track your ongoing orders
                </p>
              </div>
            </div>
            <Link
              href="/portal/orders"
              className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 flex items-center gap-1 hover:gap-1.5 transition-all"
            >
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="flex-1 p-4">
            {recentOrders.length > 0 ? (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/portal/orders/${order.id}`}
                    className="group flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all cursor-pointer"
                  >
                    <div className="flex flex-col gap-1 min-w-0 pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                          {order.order_code || order.id}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider",
                            getStatusColor(order.status),
                          )}
                        >
                          {order.status?.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[280px]">
                        {order.description || "No description provided"}
                      </span>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                          <Clock size={12} />
                          <span>Due: {order.dueDate}</span>
                        </div>
                        <div className="flex-1 h-1.5 w-24 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${order.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-sm font-bold text-gray-900 dark:text-white">
                        {order.amount}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <Package
                    size={32}
                    className="text-gray-300 dark:text-gray-600"
                  />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  No active orders
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                  Your placed orders will appear here
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8 md:p-12 shadow-2xl group"
      >
        {/* Animated gradients */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl opacity-50 group-hover:opacity-75 transition-opacity duration-700" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl opacity-50 group-hover:opacity-75 transition-opacity duration-700" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl text-center md:text-left">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready for your next project?
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Get instant pricing and lead times for CNC machining, Injection
              Molding, Vacuum Casting, and sheet metal fabrication.
            </p>
          </div>
          <Link
            href="/instant-quote"
            className="group/btn flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-50 px-8 py-4 rounded-xl font-bold shadow-lg shadow-white/10 hover:shadow-white/20 hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap"
          >
            <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500 group-hover/btn:scale-110 transition-transform" />
            <span>Start New Quote</span>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
