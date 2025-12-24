"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Building2,
  FileText,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Activity,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Package,
  Star,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // Enhanced stats with more detail
  const stats = [
    {
      label: "Total Users",
      value: "1,247",
      change: "+12%",
      trend: "up",
      icon: Users,
      color: "blue",
      href: "/admin/users",
      subtext: "Last 30 days",
      actual: 156,
    },
    {
      label: "Organizations",
      value: "156",
      change: "+8",
      trend: "up",
      icon: Building2,
      color: "green",
      href: "/admin/organizations",
      subtext: "Active orgs",
      actual: 8,
    },
    {
      label: "Active Quotes",
      value: "428",
      change: "+23%",
      trend: "up",
      icon: FileText,
      color: "purple",
      href: "/admin/quotes",
      subtext: "Pending review",
      actual: 98,
    },
    {
      label: "Total Orders",
      value: "892",
      change: "+18%",
      trend: "up",
      icon: ShoppingCart,
      color: "orange",
      href: "/admin/orders",
      subtext: "In production",
      actual: 234,
    },
    {
      label: "Monthly Revenue",
      value: "$284,500",
      change: "+32%",
      trend: "up",
      icon: DollarSign,
      color: "emerald",
      href: "/admin/analytics",
      subtext: "Target: $300K",
      actual: 284500,
    },
    {
      label: "Avg Quote Value",
      value: "$2,840",
      change: "+5%",
      trend: "up",
      icon: TrendingUp,
      color: "indigo",
      href: "/admin/analytics",
      subtext: "Industry avg: $2.6K",
      actual: 2840,
    },
    {
      label: "Completion Rate",
      value: "94.2%",
      change: "+2.1%",
      trend: "up",
      icon: CheckCircle2,
      color: "teal",
      href: "/admin/metrics",
      subtext: "On-time delivery",
      actual: 94.2,
    },
    {
      label: "Avg Response Time",
      value: "2.4h",
      change: "-18%",
      trend: "up",
      icon: Clock,
      color: "cyan",
      href: "/admin/metrics",
      subtext: "Quote turnaround",
      actual: 2.4,
    },
  ];

  // Order pipeline data
  const orderPipeline = [
    { status: "Pending Review", count: 42, color: "yellow", icon: Clock },
    { status: "In Production", count: 156, color: "blue", icon: Loader2 },
    { status: "Quality Check", count: 38, color: "purple", icon: CheckCircle2 },
    { status: "Ready to Ship", count: 29, color: "green", icon: Package },
    { status: "Shipped", count: 627, color: "gray", icon: ShoppingCart },
  ];

  // Revenue chart data (simplified bar chart)
  const revenueData = [
    { month: "Jan", revenue: 215000, orders: 687 },
    { month: "Feb", revenue: 198000, orders: 612 },
    { month: "Mar", revenue: 242000, orders: 734 },
    { month: "Apr", revenue: 268000, orders: 821 },
    { month: "May", revenue: 284500, orders: 892 },
  ];

  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue));

  // Recent activity
  const recentActivity = [
    {
      id: 1,
      type: "user",
      message: "New user registered: john@acme.com",
      time: "5 minutes ago",
      icon: Users,
      color: "blue",
    },
    {
      id: 2,
      type: "order",
      message: "Order ORD-2025-0892 marked as shipped",
      time: "12 minutes ago",
      icon: ShoppingCart,
      color: "green",
    },
    {
      id: 3,
      type: "quote",
      message: "Quote Q-2025-0428 approved by admin",
      time: "23 minutes ago",
      icon: FileText,
      color: "purple",
    },
    {
      id: 4,
      type: "alert",
      message: "High value order placed: $24,500",
      time: "45 minutes ago",
      icon: DollarSign,
      color: "emerald",
    },
    {
      id: 5,
      type: "org",
      message: "New organization: TechCorp Industries",
      time: "1 hour ago",
      icon: Building2,
      color: "orange",
    },
    {
      id: 6,
      type: "user",
      message: "Supplier verified: Precision Parts Co.",
      time: "2 hours ago",
      icon: CheckCircle2,
      color: "teal",
    },
    {
      id: 7,
      type: "system",
      message: "System backup completed successfully",
      time: "3 hours ago",
      icon: Activity,
      color: "gray",
    },
    {
      id: 8,
      type: "order",
      message: "Order ORD-2025-0889 completed",
      time: "4 hours ago",
      icon: CheckCircle2,
      color: "green",
    },
  ];

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

  // Top suppliers
  const topSuppliers = [
    {
      id: 1,
      name: "Precision Parts Co.",
      orders: 156,
      revenue: 89400,
      rating: 4.9,
      status: "verified",
    },
    {
      id: 2,
      name: "MachineWorks Ltd.",
      orders: 142,
      revenue: 76800,
      rating: 4.8,
      status: "verified",
    },
    {
      id: 3,
      name: "Advanced Manufacturing",
      orders: 128,
      revenue: 68200,
      rating: 4.7,
      status: "verified",
    },
    {
      id: 4,
      name: "Quality Components Inc.",
      orders: 98,
      revenue: 52400,
      rating: 4.6,
      status: "pending",
    },
    {
      id: 5,
      name: "Industrial Solutions LLC",
      orders: 87,
      revenue: 45600,
      rating: 4.5,
      status: "verified",
    },
  ];

  // Top customers
  const topCustomers = [
    {
      id: 1,
      name: "Aerospace Dynamics",
      orders: 89,
      revenue: 124600,
      industry: "Aerospace",
    },
    {
      id: 2,
      name: "Medical Devices Corp",
      orders: 67,
      revenue: 98200,
      industry: "Medical",
    },
    {
      id: 3,
      name: "Automotive Systems Inc",
      orders: 54,
      revenue: 76800,
      industry: "Automotive",
    },
    {
      id: 4,
      name: "Defense Technologies",
      orders: 42,
      revenue: 68400,
      industry: "Defense",
    },
    {
      id: 5,
      name: "Consumer Electronics LLC",
      orders: 38,
      revenue: 52100,
      industry: "Electronics",
    },
  ];

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

  const getPipelineColor = (color: string) => {
    const colors: Record<string, string> = {
      yellow: "bg-yellow-500",
      blue: "bg-blue-500",
      purple: "bg-purple-500",
      green: "bg-green-500",
      gray: "bg-gray-400",
    };
    return colors[color] || colors.gray;
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
        </div>
      </div>

      {/* Key Metrics Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="block transition-transform hover:scale-105"
            >
              <Card className="bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`p-2 rounded-lg ${getColorClasses(stat.color)}`}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="flex items-center gap-1">
                      {stat.trend === "up" ? (
                        <ArrowUpRight size={16} className="text-green-600" />
                      ) : (
                        <ArrowDownRight size={16} className="text-red-600" />
                      )}
                      <span
                        className={`text-xs font-medium ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}
                      >
                        {stat.change}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">
                      {stat.value}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-xs text-gray-500">{stat.subtext}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

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
            <div className="space-y-4">
              {revenueData.map((data) => (
                <div key={data.month} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {data.month}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-600">
                        {data.orders} orders
                      </span>
                      <span className="font-semibold text-gray-900">
                        ${(data.revenue / 1000).toFixed(0)}K
                      </span>
                    </div>
                  </div>
                  <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-lg flex items-center justify-end px-3"
                      style={{ width: `${(data.revenue / maxRevenue) * 100}%` }}
                    >
                      {(data.revenue / maxRevenue) * 100 > 30 && (
                        <span className="text-xs font-semibold text-white">
                          ${(data.revenue / 1000).toFixed(0)}K
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Total Revenue (5 months)
                </p>
                <p className="text-2xl font-bold text-gray-900">$1,207,500</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Avg per Month</p>
                <p className="text-2xl font-bold text-emerald-600">$241,500</p>
              </div>
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
          <CardContent>
            <div className="space-y-4">
              {orderPipeline.map((stage) => {
                const Icon = stage.icon;
                const total = orderPipeline.reduce(
                  (sum, s) => sum + s.count,
                  0,
                );
                const percentage = (stage.count / total) * 100;

                return (
                  <div key={stage.status} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          {stage.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                          {percentage.toFixed(1)}%
                        </span>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                          {stage.count}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getPipelineColor(stage.color)} rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Total Orders in Pipeline
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {orderPipeline.reduce((sum, s) => sum + s.count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              {topSuppliers.map((supplier, index) => (
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
              ))}
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
              {topCustomers.map((customer, index) => (
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
              ))}
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
              {recentActivity.map((activity) => {
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
              })}
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
