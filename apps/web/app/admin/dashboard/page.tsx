"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  Users,
  Building2,
  FileText,
  ShoppingCart,
  TrendingUp,
  Activity,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Package,
  Star,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import {
  RevenueChart,
  OrderStatusChart,
  PlatformGrowthChart,
} from "./components/DashboardCharts";
import { useMetaStore } from "@/components/store/title-store";
import { StatusCards, StatusItem } from "@/components/ui/status-cards";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "180d">(
    "180d",
  );
  const [dashboardData, setDashboardData] = useState<any>(null);
  const { setPageTitle, resetTitle } = useMetaStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const response = await api.get(`/admin/stats?period=${timeRange}`);
        setDashboardData(response.data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [timeRange]);

  // Dynamic top stats from API
  const stats: StatusItem[] = [
    {
      label: "Total Users",
      value: dashboardData?.topStats?.totalUsers?.toLocaleString() || "0",
      icon: Users,
      color: "blue",
      onClick: () => router.push("/admin/users"),
      subValue: "Platform users",
    },
    {
      label: "Organizations",
      value: dashboardData?.topStats?.totalOrgs?.toLocaleString() || "0",
      icon: Building2,
      color: "green",
      onClick: () => router.push("/admin/organizations"),
      subValue: "Active orgs",
    },
    {
      label: "Active Quotes",
      value: dashboardData?.topStats?.totalQuotes?.toLocaleString() || "0",
      icon: FileText,
      color: "purple",
      onClick: () => router.push("/admin/quotes"),
      subValue: "RFQs in system",
    },
    {
      label: "Total Orders",
      value: dashboardData?.topStats?.totalOrders?.toLocaleString() || "0",
      icon: ShoppingCart,
      color: "orange",
      onClick: () => router.push("/admin/orders"),
      subValue: "Completed & active",
    },
  ];

  // Dynamic activity from API
  const recentActivity =
    dashboardData?.activity?.map((a: any) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      time: a.time,
      icon: a.type === "order" ? ShoppingCart : Activity,
      color: a.type === "order" ? "blue" : "gray",
      user: a.user,
    })) || [];

  // System alerts
  const systemAlerts = [
    {
      id: 1,
      severity: "warning",
      message: "High API usage detected - 85% of quota used",
      time: "10 minutes ago",
      icon: AlertCircle,
    },
    {
      id: 2,
      severity: "info",
      message: "Database maintenance scheduled for tonight at 2 AM EST",
      time: "2 hours ago",
      icon: Activity,
    },
    {
      id: 3,
      severity: "error",
      message: "3 failed webhook deliveries in the last hour",
      time: "1 hour ago",
      icon: XCircle,
    },
    {
      id: 4,
      severity: "success",
      message: "All payment processing services operational",
      time: "3 hours ago",
      icon: CheckCircle2,
    },
  ];

  // Dynamic suppliers from API
  const topSuppliers =
    dashboardData?.leaderboards?.topSuppliers?.map((s: any, idx: number) => ({
      id: idx + 1,
      name: s.name,
      orders: s.orders,
      revenue: s.revenue,
      rating: 5.0, // Default for now
      status: "verified",
    })) || [];

  // Dynamic customers from API
  const topCustomers =
    dashboardData?.leaderboards?.topCustomers?.map((c: any, idx: number) => ({
      id: idx + 1,
      name: c.name,
      orders: c.orders,
      revenue: c.revenue,
      industry: "Manufacturing", // Default for now
    })) || [];

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      blue: "bg-blue-50 text-blue-600",
      green: "bg-green-50 text-green-600",
      purple: "bg-purple-50 text-purple-600",
      orange: "bg-orange-50 text-orange-600",
      emerald: "bg-emerald-50 text-emerald-600",
      indigo: "bg-indigo-50 text-indigo-600",
      teal: "bg-teal-50 text-teal-600",
      cyan: "bg-cyan-50 text-cyan-600",
      yellow: "bg-yellow-50 text-yellow-600",
      gray: "bg-gray-50 text-gray-600",
    };
    return colors[color] || colors.blue;
  };

  const getSeverityStyles = (severity: string) => {
    const styles: Record<string, string> = {
      warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
      info: "bg-blue-50 border-blue-200 text-blue-800",
      error: "bg-red-50 border-red-200 text-red-800",
      success: "bg-green-50 border-green-200 text-green-800",
    };
    return styles[severity] || styles.info;
  };

  const getSeverityIconColor = (severity: string) => {
    const colors: Record<string, string> = {
      warning: "text-yellow-600",
      info: "text-blue-600",
      error: "text-red-600",
      success: "text-green-600",
    };
    return colors[severity] || colors.info;
  };

  useEffect(() => {
    setPageTitle("Dashboard");
    return () => {
      resetTitle();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive system overview and performance metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={timeRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("7d")}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("30d")}
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("90d")}
          >
            90 Days
          </Button>
          <Button
            variant={timeRange === "180d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("180d")}
          >
            6 Months
          </Button>
        </div>
      </div>

      {/* Key Metrics Stats Grid */}
      <StatusCards items={stats} isLoading={isLoading} />

      {/* Revenue Chart and Order Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} />
                Revenue Trend
              </div>
              <Link href="/admin/analytics">
                <Button variant="ghost" size="sm">
                  View Details
                  <ArrowUpRight size={14} className="ml-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="-ml-3 mt-4 h-[350px] flex items-center justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Loader2 className="animate-spin" size={32} />
                  <span className="text-sm">Loading analytics...</span>
                </div>
              ) : dashboardData?.revenue ? (
                <RevenueChart
                  categories={dashboardData.revenue.categories}
                  cncData={dashboardData.revenue.cncData}
                  sheetMetalData={dashboardData.revenue.sheetMetalData}
                />
              ) : (
                <div className="text-gray-400">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Pipeline */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={20} />
                Order Pipeline
              </div>
              <Link href="/admin/orders">
                <Button variant="ghost" size="sm">
                  View All Orders
                  <ArrowUpRight size={14} className="ml-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center py-6 h-[350px]">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-sm">Loading pipeline...</span>
              </div>
            ) : dashboardData?.orders?.segments ? (
              <div className="w-full sm:max-w-xs md:max-w-sm">
                <OrderStatusChart
                  series={dashboardData.orders.segments.map(
                    (s: any) => s.count,
                  )}
                  labels={dashboardData.orders.segments.map(
                    (s: any) => s.label,
                  )}
                />
              </div>
            ) : (
              <div className="text-gray-400">No pipeline data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Growth Chart */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} />
            Platform Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="-ml-3 h-[300px] flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-sm">Loading growth metrics...</span>
              </div>
            ) : dashboardData?.growth ? (
              <div className="w-full">
                <PlatformGrowthChart
                  categories={dashboardData.growth.categories}
                  customerData={dashboardData.growth.customerData}
                  supplierData={dashboardData.growth.supplierData}
                />
              </div>
            ) : (
              <div className="text-gray-400">No growth data</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Suppliers and Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suppliers */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={20} />
                Top Suppliers
              </div>
              <Link href="/admin/suppliers">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowUpRight size={14} className="ml-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))
              ) : (
                topSuppliers.map((supplier, index) => (
                  <div
                    key={supplier.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {supplier.name}
                          </p>
                          {supplier.status === "verified" && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-green-100 text-green-700"
                            >
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-600">
                            {supplier.orders} orders
                          </span>
                          <span className="text-xs text-gray-600">•</span>
                          <div className="flex items-center gap-1">
                            <Star
                              size={12}
                              className="text-yellow-500 fill-yellow-500"
                            />
                            <span className="text-xs text-gray-600">
                              {supplier.rating}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        ${(supplier.revenue / 1000).toFixed(1)}K
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={20} />
                Top Customers
              </div>
              <Link href="/admin/customers">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowUpRight size={14} className="ml-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))
              ) : (
                topCustomers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {customer.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-600">
                            {customer.orders} orders
                          </span>
                          <span className="text-xs text-gray-600">•</span>
                          <Badge variant="outline" className="text-xs">
                            {customer.industry}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        ${(customer.revenue / 1000).toFixed(1)}K
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and System Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={20} />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))
              ) : (
                recentActivity.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className={`p-2 rounded-lg ${getColorClasses(activity.color)}`}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          {activity.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href="/admin/activity">
                <Button variant="outline" size="sm" className="w-full">
                  View All Activity
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* System Alerts */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle size={20} />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemAlerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${getSeverityStyles(alert.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        size={18}
                        className={getSeverityIconColor(alert.severity)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs opacity-75 mt-1">{alert.time}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href="/admin/settings">
                <Button variant="outline" size="sm" className="w-full">
                  Manage Alerts
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
