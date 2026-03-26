"use client";

import {
  FileText,
  ArrowRight,
  Package,
  CheckCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { StatusCards, StatusItem } from "@/components/ui/status-cards";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import CustomLoader from "@/components/ui/loader/CustomLoader";
import { useMetaStore } from "@/components/store/title-store";
import { motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { formatDate } from "@/lib/format";

// Dynamically import apexcharts to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 15, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 110,
      damping: 15,
    },
  },
};

export default function SupplierDashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Data states
  const [orderSummary, setOrderSummary] = useState<{
    total: number;
    completed: number;
    active: number;
    by_status: { status: string; count: number }[];
  }>({ total: 0, completed: 0, active: 0, by_status: [] });

  const [quoteRequestsCount, setQuoteRequestsCount] = useState(0);
  const [recentQuoteRequests, setRecentQuoteRequests] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

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
        const [ordersSummaryRes, quoteRes, ordersRes] = await Promise.all([
          apiClient.get("/supplier/orders-summary"),
          apiClient.get("/quote-request", { params: { page: 1, limit: 3 } }),
          apiClient.get("/supplier/orders/infinite", { params: { limit: 3 } }),
        ]);

        const summaryData = ordersSummaryRes.data.statuses || {
          total: 0,
          completed: 0,
          active: 0,
          by_status: [],
        };

        // Custom counting active and completed if the backend does not return it directly at the root
        let total = summaryData.total || 0;
        let active = summaryData.active || 0;
        let completed = summaryData.completed || 0;

        if (!summaryData.active && summaryData.by_status) {
          total =
            summaryData.total ||
            summaryData.by_status.reduce(
              (acc: number, curr: any) => acc + curr.count,
              0,
            );
          active = summaryData.by_status
            .filter(
              (s: any) =>
                s.status.toLowerCase() !== "completed" &&
                s.status.toLowerCase() !== "cancelled",
            )
            .reduce((acc: number, curr: any) => acc + curr.count, 0);
          completed = summaryData.by_status
            .filter((s: any) => s.status.toLowerCase() === "completed")
            .reduce((acc: number, curr: any) => acc + curr.count, 0);
        }

        setOrderSummary({
          total,
          active,
          completed,
          by_status: summaryData.by_status || [],
        });

        setRecentQuoteRequests(quoteRes.data.data || []);
        setQuoteRequestsCount(quoteRes.data.count || 0);
        setRecentOrders(ordersRes.data.data || []);
      } catch (error) {
        console.error("Failed to load supplier dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      requested: "bg-orange-50 text-orange-700 border-orange-200",
      accepted: "bg-violet-50 text-violet-700 border-violet-200",
      declined: "bg-red-50 text-red-700 border-red-200",
      payment_pending: "bg-pink-50 text-pink-700 border-pink-200",
      paid: "bg-violet-50 text-violet-700 border-violet-200",
      processing: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
      shipped: "bg-amber-50 text-amber-700 border-amber-200",
      delivered: "bg-rose-50 text-rose-700 border-rose-200",
      completed: "bg-purple-50 text-purple-700 border-purple-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
    };
    return (
      colors[status?.toLowerCase()?.replace(" ", "_")] ||
      "bg-slate-50 text-slate-700 border-slate-200"
    );
  };

  // Combine quotes and orders for the recent activity table
  const unifiedActivity = [
    ...recentQuoteRequests.map((q) => ({
      id: q.id,
      code: q.order?.order_code || q.id.substring(0, 8).toUpperCase(),
      type: "Quote Request",
      date: q.created_at,
      status: q.status,
      href: `/supplier/quote-request/${q.id}`,
    })),
    ...recentOrders.map((o) => ({
      id: o.order_id,
      code: o.order_code || o.order_id.substring(0, 8).toUpperCase(),
      type: "Order",
      date: o.created_at,
      status: o.status,
      href: `/supplier/orders/${o.order_id}`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <CustomLoader />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(" ")[0] || "Partner";

  const statsItems: StatusItem[] = [
    {
      label: "Total Orders",
      value: orderSummary.total,
      icon: Package,
      color: "blue",
    },
    {
      label: "Active Orders",
      value: orderSummary.active,
      icon: Clock,
      color: "indigo",
    },
    {
      label: "Completed Orders",
      value: orderSummary.completed,
      icon: CheckCircle,
      color: "emerald",
    },
    {
      label: "Quote Requests",
      value: quoteRequestsCount,
      icon: FileText,
      color: "amber",
    },
  ];

  // Pie chart configuration for order distribution
  const chartSeries = [orderSummary.active, orderSummary.completed];
  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "inherit",
      animations: {
        enabled: true,
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150,
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350,
        },
      },
    },
    labels: ["Active", "Completed"],
    colors: ["#6366f1", "#10b981"], // Indigo for active, Emerald for completed
    dataLabels: {
      enabled: false,
    },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: "14px",
              fontFamily: "inherit",
              fontWeight: 600,
              color: "#64748b",
            },
            value: {
              show: true,
              fontSize: "24px",
              fontFamily: "inherit",
              fontWeight: 700,
              color: "#0f172a",
            },
            total: {
              show: true,
              showAlways: true,
              label: "Total Orders",
              fontSize: "12px",
              fontFamily: "inherit",
              fontWeight: 600,
              color: "#64748b",
              formatter: function (w) {
                return w.globals.seriesTotals.reduce((a: any, b: any) => {
                  return a + b;
                }, 0);
              },
            },
          },
        },
      },
    },
    legend: {
      position: "bottom",
      fontFamily: "inherit",
      fontWeight: 500,
      labels: {
        colors: "#475569",
      },
      markers: {
        radius: 12,
      },
    },
    stroke: {
      show: true,
      colors: ["transparent"],
      width: 2,
    },
    tooltip: {
      fillSeriesColor: false,
      y: {
        formatter: function (val) {
          return val + " orders";
        },
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12 p-6 max-w-[1440px] mx-auto pb-24"
    >
      {/* Hello Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-slate-500 text-lg">
            Manage your quote requests and production workflow.
          </p>
        </div>
      </section>

      {/* Stats Overview */}
      <section>
        <StatusCards items={statsItems} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Action Cards & Chart */}
        <section className="col-span-1 lg:col-span-2 space-y-8">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2 px-1">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                title: "View Quote Requests",
                description:
                  "Review new quote requests and respond to open RFQs.",
                icon: FileText,
                href: "/supplier/quote-request",
                action: "Review RFQs",
                color: "amber",
              },
              {
                title: "Manage Orders",
                description:
                  "Track progress and status of active manufacturing orders.",
                icon: Package,
                href: "/supplier/orders",
                action: "View Orders",
                color: "indigo",
              },
            ].map((card, idx) => {
              const content = (
                <div className="group flex flex-col h-full bg-white rounded-3xl p-8 border border-slate-200/60 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-colors duration-300",
                      card.color === "amber" &&
                        "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white",
                      card.color === "indigo" &&
                        "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white",
                    )}
                  >
                    <card.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {card.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-grow">
                    {card.description}
                  </p>

                  <div
                    className={cn(
                      "flex items-center gap-1 text-xs font-bold uppercase tracking-wider",
                      card.color === "amber"
                        ? "text-amber-600"
                        : "text-indigo-600",
                    )}
                  >
                    {card.action} <ChevronRight size={14} />
                  </div>

                  <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 group-hover:-rotate-12 group-hover:scale-110">
                    <card.icon size={120} />
                  </div>
                </div>
              );

              return (
                <motion.div
                  key={idx}
                  variants={itemVariants}
                  className="h-full"
                >
                  <Link href={card.href} className="h-full">
                    {content}
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Chart Section */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm flex flex-col md:flex-row gap-8 items-center justify-around overflow-hidden"
          >
            <div className="flex-1 space-y-4 max-w-sm">
              <h3 className="text-2xl font-bold text-slate-900">
                Order Distribution
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed pb-4">
                Visual breakdown of your assigned production orders by their
                active status versus those you have already successfully
                completed. Focus on maintaining a healthy completion rate to
                boost your supplier score.
              </p>
              <div className="flex gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/supplier/orders")}
                  className="text-indigo-600 font-semibold hover:bg-indigo-50 rounded-lg group px-0 h-auto"
                >
                  View all orders{" "}
                  <ArrowRight
                    size={14}
                    className="ml-2 group-hover:translate-x-1 transition-transform"
                  />
                </Button>
              </div>
            </div>
            <div className="w-[300px] h-[300px] shrink-0 flex items-center justify-center relative">
              {orderSummary.total > 0 ? (
                <ReactApexChart
                  options={chartOptions}
                  series={chartSeries}
                  type="donut"
                  height="300"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <Package className="w-10 h-10 opacity-30" />
                  <span className="text-sm font-medium">No order data yet</span>
                </div>
              )}
              <div className="absolute inset-0 rounded-full border border-slate-100/50 pointer-events-none scale-[1.05]" />
            </div>
          </motion.div>
        </section>

        {/* Recent Activity Table (Sidebar on Desktop) */}
        <section className="col-span-1 space-y-8">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center justify-between px-1">
            Recent Activity
          </h2>
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col"
          >
            <div className="divide-y divide-slate-100/80">
              {unifiedActivity.length > 0 ? (
                unifiedActivity.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-5 hover:bg-slate-50/60 transition-colors group cursor-pointer flex flex-col gap-2 relative overflow-hidden"
                    onClick={() => router.push(act.href)}
                  >
                    <div className="flex items-center justify-between gap-3 relative z-10">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm",
                            act.type === "Quote Request"
                              ? "bg-amber-50 border-amber-100 text-amber-600"
                              : "bg-indigo-50 border-indigo-100 text-indigo-600",
                          )}
                        >
                          {act.type === "Quote Request" ? (
                            <FileText size={18} />
                          ) : (
                            <Package size={18} />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase truncate">
                            {act.code}
                          </span>
                          <span className="text-xs text-slate-500 truncate">
                            {formatDate(act.date)}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <ChevronRight
                          size={18}
                          className="text-slate-300 group-hover:text-indigo-500 transition-colors group-hover:translate-x-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1 ml-[52px] relative z-10">
                      <span
                        className={cn(
                          "text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border",
                          getStatusColor(act.status),
                        )}
                      >
                        {act.status?.replace("_", " ")}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-500">
                        {act.type}
                      </span>
                    </div>

                    {/* Hover Decoration */}
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center text-slate-400 text-sm flex flex-col items-center">
                  <Clock className="w-8 h-8 opacity-20 mb-3" />
                  No recent activity found.
                </div>
              )}
            </div>
          </motion.div>
        </section>
      </div>
    </motion.div>
  );
}
