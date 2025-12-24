"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  ShoppingCart,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  Clock,
  Target,
  Activity,
  Award,
  Building2,
  Star,
  ArrowUpRight,
} from "lucide-react";

export default function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">(
    "30d",
  );
  const [chartView, setChartView] = useState<"revenue" | "orders" | "both">(
    "both",
  );

  // Enhanced KPI data
  const kpiData = [
    {
      title: "Total Revenue",
      value: "$2.4M",
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "emerald",
      detail: "$284K this month",
    },
    {
      title: "Total Orders",
      value: "1,284",
      change: "+8.2%",
      trend: "up",
      icon: ShoppingCart,
      color: "blue",
      detail: "892 active",
    },
    {
      title: "Active Customers",
      value: "342",
      change: "+15.3%",
      trend: "up",
      icon: Users,
      color: "purple",
      detail: "156 new this quarter",
    },
    {
      title: "Avg Order Value",
      value: "$1,869",
      change: "-3.2%",
      trend: "down",
      icon: Package,
      color: "orange",
      detail: "Target: $2.1K",
    },
    {
      title: "Quote Conversion",
      value: "68.4%",
      change: "+5.2%",
      trend: "up",
      icon: Target,
      color: "cyan",
      detail: "428 pending",
    },
    {
      title: "Avg Response Time",
      value: "2.4h",
      change: "-18%",
      trend: "up",
      icon: Clock,
      color: "indigo",
      detail: "Under SLA",
    },
    {
      title: "Customer Retention",
      value: "91.2%",
      change: "+2.1%",
      trend: "up",
      icon: Award,
      color: "teal",
      detail: "312 repeat customers",
    },
    {
      title: "Supplier Rating",
      value: "4.7/5",
      change: "+0.2",
      trend: "up",
      icon: Star,
      color: "yellow",
      detail: "156 active suppliers",
    },
  ];

  // Revenue and orders trend (12 months)
  const trendData = [
    { month: "Jan", revenue: 185000, orders: 587, quotes: 847 },
    { month: "Feb", revenue: 195000, orders: 612, quotes: 892 },
    { month: "Mar", revenue: 210000, orders: 734, quotes: 1024 },
    { month: "Apr", revenue: 198000, orders: 621, quotes: 914 },
    { month: "May", revenue: 225000, orders: 789, quotes: 1134 },
    { month: "Jun", revenue: 240000, orders: 834, quotes: 1198 },
    { month: "Jul", revenue: 252000, orders: 867, quotes: 1245 },
    { month: "Aug", revenue: 238000, orders: 801, quotes: 1176 },
    { month: "Sep", revenue: 268000, orders: 921, quotes: 1312 },
    { month: "Oct", revenue: 255000, orders: 878, quotes: 1245 },
    { month: "Nov", revenue: 278000, orders: 956, quotes: 1389 },
    { month: "Dec", revenue: 284500, orders: 892, quotes: 1402 },
  ];

  const maxRevenue = Math.max(...trendData.map((m) => m.revenue));
  const maxOrders = Math.max(...trendData.map((m) => m.orders));

  // Top customers with detailed metrics
  const topCustomers = [
    {
      name: "Aerospace Dynamics Corp",
      orders: 89,
      revenue: 425000,
      growth: 22,
      ltv: 892000,
      avgOrderValue: 4775,
      retention: 98,
    },
    {
      name: "Medical Devices International",
      orders: 67,
      revenue: 380000,
      growth: 18,
      ltv: 756000,
      avgOrderValue: 5671,
      retention: 95,
    },
    {
      name: "Automotive Systems Inc",
      orders: 54,
      revenue: 298000,
      growth: 15,
      ltv: 645000,
      avgOrderValue: 5519,
      retention: 92,
    },
    {
      name: "Defense Technologies LLC",
      orders: 42,
      revenue: 425000,
      growth: 28,
      ltv: 987000,
      avgOrderValue: 10119,
      retention: 100,
    },
    {
      name: "Consumer Electronics Corp",
      orders: 38,
      revenue: 312000,
      growth: -5,
      ltv: 598000,
      avgOrderValue: 8211,
      retention: 87,
    },
  ];

  // Supplier performance metrics
  const supplierPerformance = [
    {
      name: "Precision Parts Co.",
      orders: 156,
      revenue: 89400,
      rating: 4.9,
      onTimeDelivery: 98,
      qualityScore: 97,
      responseTime: 1.8,
    },
    {
      name: "MachineWorks Ltd.",
      orders: 142,
      revenue: 76800,
      rating: 4.8,
      onTimeDelivery: 96,
      qualityScore: 96,
      responseTime: 2.1,
    },
    {
      name: "Advanced Manufacturing",
      orders: 128,
      revenue: 68200,
      rating: 4.7,
      onTimeDelivery: 94,
      qualityScore: 95,
      responseTime: 2.4,
    },
    {
      name: "Quality Components Inc.",
      orders: 98,
      revenue: 52400,
      rating: 4.6,
      onTimeDelivery: 92,
      qualityScore: 93,
      responseTime: 2.8,
    },
    {
      name: "Industrial Solutions LLC",
      orders: 87,
      revenue: 45600,
      rating: 4.5,
      onTimeDelivery: 90,
      qualityScore: 91,
      responseTime: 3.2,
    },
  ];

  // Order status distribution
  const ordersByStatus = [
    {
      status: "Delivered",
      count: 542,
      percentage: 42,
      color: "green",
      avgDays: 12,
    },
    {
      status: "In Production",
      count: 318,
      percentage: 25,
      color: "blue",
      avgDays: 7,
    },
    {
      status: "Pending Review",
      count: 255,
      percentage: 20,
      color: "yellow",
      avgDays: 2,
    },
    {
      status: "Shipped",
      count: 127,
      percentage: 10,
      color: "indigo",
      avgDays: 3,
    },
    { status: "Cancelled", count: 42, percentage: 3, color: "red", avgDays: 0 },
  ];

  // Material breakdown with revenue
  const materialBreakdown = [
    {
      material: "Aluminum",
      orders: 485,
      percentage: 38,
      revenue: 912000,
      avgPrice: 1880,
      color: "blue",
    },
    {
      material: "Stainless Steel",
      orders: 342,
      percentage: 27,
      revenue: 768000,
      avgPrice: 2246,
      color: "gray",
    },
    {
      material: "Steel",
      orders: 256,
      percentage: 20,
      revenue: 498000,
      avgPrice: 1945,
      color: "slate",
    },
    {
      material: "Titanium",
      orders: 128,
      percentage: 10,
      revenue: 384000,
      avgPrice: 3000,
      color: "purple",
    },
    {
      material: "Plastic",
      orders: 73,
      percentage: 5,
      revenue: 87600,
      avgPrice: 1200,
      color: "cyan",
    },
  ];

  // Industry breakdown
  const industryBreakdown = [
    {
      industry: "Aerospace",
      orders: 289,
      revenue: 876000,
      percentage: 36.5,
      color: "blue",
    },
    {
      industry: "Medical",
      orders: 245,
      revenue: 612000,
      percentage: 25.5,
      color: "red",
    },
    {
      industry: "Automotive",
      orders: 198,
      revenue: 487000,
      percentage: 20.3,
      color: "orange",
    },
    {
      industry: "Defense",
      orders: 156,
      revenue: 298000,
      percentage: 12.4,
      color: "purple",
    },
    {
      industry: "Electronics",
      orders: 98,
      revenue: 127000,
      percentage: 5.3,
      color: "cyan",
    },
  ];

  // Finish type popularity
  const finishPopularity = [
    {
      finish: "Anodized Type II",
      count: 342,
      percentage: 42,
      avgCost: 12,
      color: "blue",
    },
    {
      finish: "Powder Coating",
      count: 256,
      percentage: 31,
      avgCost: 8,
      color: "green",
    },
    {
      finish: "Bead Blasting",
      count: 124,
      percentage: 15,
      avgCost: 6,
      color: "purple",
    },
    {
      finish: "Chrome Plating",
      count: 67,
      percentage: 8,
      avgCost: 18,
      color: "gray",
    },
    {
      finish: "As Machined",
      count: 34,
      percentage: 4,
      avgCost: 0,
      color: "slate",
    },
  ];

  // Conversion funnel
  const conversionFunnel = [
    { stage: "Uploads", count: 2847, percentage: 100, color: "blue" },
    {
      stage: "Quotes Generated",
      count: 1924,
      percentage: 67.6,
      color: "purple",
    },
    { stage: "Quotes Sent", count: 1402, percentage: 72.9, color: "indigo" },
    { stage: "Quotes Approved", count: 959, percentage: 68.4, color: "cyan" },
    { stage: "Orders Placed", count: 892, percentage: 93.0, color: "green" },
  ];

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; bar: string }> =
      {
        blue: { bg: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500" },
        green: {
          bg: "bg-green-50",
          text: "text-green-600",
          bar: "bg-green-500",
        },
        purple: {
          bg: "bg-purple-50",
          text: "text-purple-600",
          bar: "bg-purple-500",
        },
        orange: {
          bg: "bg-orange-50",
          text: "text-orange-600",
          bar: "bg-orange-500",
        },
        yellow: {
          bg: "bg-yellow-50",
          text: "text-yellow-600",
          bar: "bg-yellow-500",
        },
        red: { bg: "bg-red-50", text: "text-red-600", bar: "bg-red-500" },
        indigo: {
          bg: "bg-indigo-50",
          text: "text-indigo-600",
          bar: "bg-indigo-500",
        },
        gray: { bg: "bg-gray-50", text: "text-gray-600", bar: "bg-gray-400" },
        slate: {
          bg: "bg-slate-50",
          text: "text-slate-600",
          bar: "bg-slate-400",
        },
        cyan: { bg: "bg-cyan-50", text: "text-cyan-600", bar: "bg-cyan-500" },
        teal: { bg: "bg-teal-50", text: "text-teal-600", bar: "bg-teal-500" },
        emerald: {
          bg: "bg-emerald-50",
          text: "text-emerald-600",
          bar: "bg-emerald-500",
        },
      };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Comprehensive performance metrics and business insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={timeRange}
            onValueChange={(value: any) => setTimeRange(value)}
          >
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" /> Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend === "up" ? TrendingUp : TrendingDown;
          const colorClasses = getColorClasses(kpi.color);
          return (
            <Card
              key={kpi.title}
              className="bg-white hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`p-2 rounded-lg ${colorClasses.bg} ${colorClasses.text}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendIcon
                      className={`w-4 h-4 ${kpi.trend === "up" ? "text-green-600" : "text-red-600"}`}
                    />
                    <span
                      className={`text-xs font-semibold ${kpi.trend === "up" ? "text-green-600" : "text-red-600"}`}
                    >
                      {kpi.change}
                    </span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-1">
                  {kpi.value}
                </p>
                <p className="text-sm text-gray-600 mb-1">{kpi.title}</p>
                <p className="text-xs text-gray-500">{kpi.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue & Orders Trend */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} />
              Revenue & Orders Trend (12 Months)
            </div>
            <div className="flex gap-2">
              <Button
                variant={chartView === "revenue" ? "default" : "outline"}
                size="sm"
                onClick={() => setChartView("revenue")}
              >
                Revenue
              </Button>
              <Button
                variant={chartView === "orders" ? "default" : "outline"}
                size="sm"
                onClick={() => setChartView("orders")}
              >
                Orders
              </Button>
              <Button
                variant={chartView === "both" ? "default" : "outline"}
                size="sm"
                onClick={() => setChartView("both")}
              >
                Both
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trendData.map((item) => {
              const revenueHeight = (item.revenue / maxRevenue) * 100;
              const ordersHeight = (item.orders / maxOrders) * 100;

              return (
                <div key={item.month} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700 w-12">
                      {item.month}
                    </span>
                    <div className="flex items-center gap-6">
                      {(chartView === "revenue" || chartView === "both") && (
                        <span className="text-gray-600">
                          <span className="font-semibold text-emerald-600">
                            ${(item.revenue / 1000).toFixed(0)}K
                          </span>
                        </span>
                      )}
                      {(chartView === "orders" || chartView === "both") && (
                        <span className="text-gray-600">
                          <span className="font-semibold text-blue-600">
                            {item.orders}
                          </span>{" "}
                          orders
                        </span>
                      )}
                      <span className="text-gray-500 text-xs">
                        {item.quotes} quotes
                      </span>
                    </div>
                  </div>

                  {chartView === "both" ? (
                    <div className="flex gap-2">
                      <div className="flex-1 relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg"
                          style={{ width: `${revenueHeight}%` }}
                        />
                      </div>
                      <div className="flex-1 relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg"
                          style={{ width: `${ordersHeight}%` }}
                        />
                      </div>
                    </div>
                  ) : chartView === "revenue" ? (
                    <div className="relative h-10 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-end px-4"
                        style={{ width: `${revenueHeight}%` }}
                      >
                        {revenueHeight > 25 && (
                          <span className="text-sm font-semibold text-white">
                            ${(item.revenue / 1000).toFixed(0)}K
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-10 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-end px-4"
                        style={{ width: `${ordersHeight}%` }}
                      >
                        {ordersHeight > 25 && (
                          <span className="text-sm font-semibold text-white">
                            {item.orders}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Revenue (12mo)</p>
              <p className="text-2xl font-bold text-emerald-600">$2,888K</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Orders (12mo)</p>
              <p className="text-2xl font-bold text-blue-600">9,492</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-purple-600">68.4%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel and Order Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target size={20} />
              Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {conversionFunnel.map((stage, index) => {
                const colorClasses = getColorClasses(stage.color);
                const dropoffPercentage =
                  index > 0
                    ? (
                        ((conversionFunnel[index - 1].count - stage.count) /
                          conversionFunnel[index - 1].count) *
                        100
                      ).toFixed(1)
                    : null;

                return (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">
                          {stage.stage}
                        </span>
                        {dropoffPercentage &&
                          parseFloat(dropoffPercentage) > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs text-red-600"
                            >
                              -{dropoffPercentage}% drop
                            </Badge>
                          )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900">
                          {stage.count}
                        </span>
                        <Badge
                          className={`${colorClasses.bg} ${colorClasses.text} border-0`}
                        >
                          {stage.percentage}%
                        </Badge>
                      </div>
                    </div>
                    <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 ${colorClasses.bar} rounded-lg flex items-center justify-center`}
                        style={{ width: `${stage.percentage}%` }}
                      >
                        {stage.percentage > 20 && (
                          <span className="text-sm font-semibold text-white">
                            {stage.count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Overall Conversion Rate</p>
                <p className="text-2xl font-bold text-green-600">31.3%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart size={20} />
              Orders by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ordersByStatus.map((item) => {
                const colorClasses = getColorClasses(item.color);
                return (
                  <div key={item.status}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {item.status}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                          {item.avgDays}d avg
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {item.count}
                        </span>
                        <Badge
                          className={`${colorClasses.bg} ${colorClasses.text} border-0`}
                        >
                          {item.percentage}%
                        </Badge>
                      </div>
                    </div>
                    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 ${colorClasses.bar} rounded-full`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Total Active Orders</p>
                <p className="text-2xl font-bold text-gray-900">1,284</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers and Supplier Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={20} />
                Top Customers
              </div>
              <Button variant="ghost" size="sm">
                View All
                <ArrowUpRight size={14} className="ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCustomers.map((customer, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-gray-50 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {customer.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {customer.orders} orders
                          </Badge>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-600">
                            ${(customer.ltv / 1000).toFixed(0)}K LTV
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        ${(customer.revenue / 1000).toFixed(0)}K
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <TrendingUp
                          className={`w-3.5 h-3.5 ${customer.growth >= 0 ? "text-green-600" : "text-red-600"}`}
                        />
                        <span
                          className={`text-xs font-semibold ${customer.growth >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {customer.growth > 0 ? "+" : ""}
                          {customer.growth}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Avg Order</p>
                      <p className="font-semibold text-gray-900">
                        ${(customer.avgOrderValue / 1000).toFixed(1)}K
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Retention</p>
                      <p className="font-semibold text-gray-900">
                        {customer.retention}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Status</p>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-green-100 text-green-700"
                      >
                        Active
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Supplier Performance */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={20} />
                Supplier Performance
              </div>
              <Button variant="ghost" size="sm">
                View All
                <ArrowUpRight size={14} className="ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {supplierPerformance.map((supplier, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-gray-50 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {supplier.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <Star
                              size={12}
                              className="text-yellow-500 fill-yellow-500"
                            />
                            <span className="text-xs font-semibold text-gray-900">
                              {supplier.rating}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-600">
                            {supplier.orders} orders
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        ${(supplier.revenue / 1000).toFixed(1)}K
                      </p>
                      <p className="text-xs text-gray-500 mt-1">revenue</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">On-Time</p>
                      <p className="font-semibold text-green-600">
                        {supplier.onTimeDelivery}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Quality</p>
                      <p className="font-semibold text-blue-600">
                        {supplier.qualityScore}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Response</p>
                      <p className="font-semibold text-purple-600">
                        {supplier.responseTime}h
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Material, Industry, and Finish Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Material Breakdown */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package size={20} />
              Material Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {materialBreakdown.map((item) => {
                const colorClasses = getColorClasses(item.color);
                return (
                  <div key={item.material}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {item.material}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.orders}
                        </p>
                        <p className="text-xs text-gray-500">
                          ${(item.revenue / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                    <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 ${colorClasses.bar} rounded-full`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Avg: ${item.avgPrice}/order
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Industry Breakdown */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={20} />
              Industry Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {industryBreakdown.map((item) => {
                const colorClasses = getColorClasses(item.color);
                return (
                  <div key={item.industry}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {item.industry}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.orders}
                        </p>
                        <p className="text-xs text-gray-500">
                          ${(item.revenue / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                    <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 ${colorClasses.bar} rounded-full`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.percentage.toFixed(1)}% of total
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Finish Popularity */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award size={20} />
              Finish Popularity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {finishPopularity.map((item) => {
                const colorClasses = getColorClasses(item.color);
                return (
                  <div key={item.finish}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 truncate">
                        {item.finish}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.count}
                        </p>
                        <p className="text-xs text-gray-500">
                          ${item.avgCost}/part
                        </p>
                      </div>
                    </div>
                    <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 ${colorClasses.bar} rounded-full`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.percentage}% of orders
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
