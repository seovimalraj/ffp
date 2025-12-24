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
  Clock,
  Star,
  Package,
  Factory,
  CheckCircle,
  Target,
  Users,
  Award,
  BarChart3,
  Download,
} from "lucide-react";

export default function SupplierAnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30d");
  const [chartView, setChartView] = useState("revenue");

  // Comprehensive KPIs
  const kpis = [
    {
      label: "Total Revenue",
      value: "$284,500",
      change: "+18.5%",
      trend: "up",
      icon: DollarSign,
      color: "green",
      subtext: "Last 30 days",
    },
    {
      label: "Orders Completed",
      value: "156",
      change: "+12",
      trend: "up",
      icon: Package,
      color: "blue",
      subtext: "24 in progress",
    },
    {
      label: "Avg Order Value",
      value: "$1,824",
      change: "+$142",
      trend: "up",
      icon: BarChart3,
      color: "purple",
      subtext: "Per order",
    },
    {
      label: "On-Time Delivery",
      value: "94.2%",
      change: "+2.4%",
      trend: "up",
      icon: CheckCircle,
      color: "emerald",
      subtext: "147 of 156",
    },
    {
      label: "Quality Score",
      value: "96.8%",
      change: "+1.2%",
      trend: "up",
      icon: Award,
      color: "yellow",
      subtext: "First pass rate",
    },
    {
      label: "Customer Rating",
      value: "4.8/5",
      change: "+0.2",
      trend: "up",
      icon: Star,
      color: "orange",
      subtext: "42 reviews",
    },
    {
      label: "Avg Lead Time",
      value: "6.2 days",
      change: "-1.3 days",
      trend: "down",
      icon: Clock,
      color: "cyan",
      subtext: "Improved",
    },
    {
      label: "Capacity Used",
      value: "78%",
      change: "+5%",
      trend: "up",
      icon: Factory,
      color: "indigo",
      subtext: "22% available",
    },
  ];

  // 12-month revenue trend
  const revenueData = [
    { month: "Jan", revenue: 185000, orders: 98, capacity: 68 },
    { month: "Feb", revenue: 210000, orders: 112, capacity: 72 },
    { month: "Mar", revenue: 245000, orders: 128, capacity: 75 },
    { month: "Apr", revenue: 230000, orders: 118, capacity: 71 },
    { month: "May", revenue: 268000, orders: 142, capacity: 78 },
    { month: "Jun", revenue: 290000, orders: 156, capacity: 82 },
    { month: "Jul", revenue: 275000, orders: 145, capacity: 79 },
    { month: "Aug", revenue: 295000, orders: 158, capacity: 84 },
    { month: "Sep", revenue: 310000, orders: 165, capacity: 86 },
    { month: "Oct", revenue: 298000, orders: 162, capacity: 83 },
    { month: "Nov", revenue: 284500, orders: 156, capacity: 78 },
    { month: "Dec", revenue: 0, orders: 0, capacity: 0 },
  ];

  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue));
  const maxOrders = Math.max(...revenueData.map((d) => d.orders));

  // Top customers by revenue
  const topCustomers = [
    {
      name: "AeroSpace Dynamics",
      orders: 42,
      revenue: 89500,
      growth: "+18%",
      rating: 4.9,
    },
    {
      name: "MedDevice Inc",
      orders: 38,
      revenue: 76200,
      growth: "+22%",
      rating: 4.8,
    },
    {
      name: "Acme Manufacturing",
      orders: 35,
      revenue: 58900,
      growth: "+12%",
      rating: 4.7,
    },
    {
      name: "TechCorp Industries",
      orders: 28,
      revenue: 42800,
      growth: "+8%",
      rating: 4.6,
    },
    {
      name: "Global Robotics Ltd",
      orders: 13,
      revenue: 17100,
      growth: "+5%",
      rating: 4.5,
    },
  ];

  // Material breakdown
  const materialBreakdown = [
    { material: "Aluminum", orders: 68, revenue: 125600, percentage: 44 },
    { material: "Stainless Steel", orders: 45, revenue: 92400, percentage: 32 },
    { material: "Steel", orders: 28, revenue: 45800, percentage: 16 },
    { material: "Titanium", orders: 12, revenue: 18200, percentage: 6 },
    { material: "Plastic", orders: 3, revenue: 2500, percentage: 2 },
  ];

  // Performance metrics over time
  const performanceMetrics = [
    {
      metric: "On-Time Delivery",
      current: 94.2,
      target: 95,
      previous: 91.8,
      trend: "up",
    },
    {
      metric: "Quality First Pass",
      current: 96.8,
      target: 98,
      previous: 95.6,
      trend: "up",
    },
    {
      metric: "Customer Satisfaction",
      current: 4.8,
      target: 4.9,
      previous: 4.6,
      trend: "up",
    },
    {
      metric: "Response Time (hrs)",
      current: 2.4,
      target: 2.0,
      previous: 3.1,
      trend: "down",
    },
  ];

  const getChartData = () => {
    if (chartView === "revenue")
      return revenueData.map((d) => ({
        ...d,
        value: d.revenue,
        max: maxRevenue,
      }));
    if (chartView === "orders")
      return revenueData.map((d) => ({
        ...d,
        value: d.orders,
        max: maxOrders,
      }));
    return revenueData.map((d) => ({ ...d, value: d.capacity, max: 100 }));
  };

  const formatChartValue = (value: number) => {
    if (chartView === "revenue") return `$${(value / 1000).toFixed(0)}K`;
    if (chartView === "orders") return value.toString();
    return `${value}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Supplier Analytics
          </h1>
          <p className="text-gray-600 mt-1">Performance metrics and insights</p>
        </div>
        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const colorMap: Record<string, string> = {
            green: "bg-green-50 text-green-600",
            blue: "bg-blue-50 text-blue-600",
            purple: "bg-purple-50 text-purple-600",
            emerald: "bg-emerald-50 text-emerald-600",
            yellow: "bg-yellow-50 text-yellow-600",
            orange: "bg-orange-50 text-orange-600",
            cyan: "bg-cyan-50 text-cyan-600",
            indigo: "bg-indigo-50 text-indigo-600",
          };
          return (
            <Card
              key={kpi.label}
              className="hover:shadow-lg transition-shadow bg-white"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-lg ${colorMap[kpi.color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <Badge
                    variant={kpi.trend === "up" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {kpi.trend === "up" ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {kpi.change}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {kpi.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{kpi.subtext}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue Trend Chart */}
      <Card className="hover:shadow-md transition-shadow bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              12-Month Trend
            </CardTitle>
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
                variant={chartView === "capacity" ? "default" : "outline"}
                size="sm"
                onClick={() => setChartView("capacity")}
              >
                Capacity
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {getChartData()
              .filter((d) => d.value > 0)
              .map((data) => (
                <div key={data.month} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 font-medium w-12">
                      {data.month}
                    </span>
                    <span className="text-gray-900 font-semibold">
                      {formatChartValue(data.value)}
                    </span>
                  </div>
                  <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${(data.value / data.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card className="hover:shadow-md transition-shadow bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Top Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCustomers.map((customer, index) => (
                <div key={customer.name} className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-gray-900 truncate">
                        {customer.name}
                      </p>
                      <span className="text-sm font-bold text-gray-900">
                        ${(customer.revenue / 1000).toFixed(1)}K
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>{customer.orders} orders</span>
                      <span className="text-green-600 font-medium">
                        {customer.growth}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {customer.rating}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card className="hover:shadow-md transition-shadow bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Performance vs Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {performanceMetrics.map((metric) => (
                <div key={metric.metric} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {metric.metric}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        Target: {metric.target}
                        {metric.metric.includes("%") ? "%" : ""}
                      </span>
                      {metric.trend === "up" ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                  </div>
                  <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${
                        metric.current >= metric.target
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}
                      style={{
                        width: `${(metric.current / metric.target) * 100}%`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-semibold text-gray-900">
                        {metric.current}
                        {metric.metric.includes("%") ? "%" : ""}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Previous: {metric.previous}
                    {metric.metric.includes("%") ? "%" : ""}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Material Breakdown */}
      <Card className="hover:shadow-md transition-shadow bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            Material Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {materialBreakdown.map((item) => (
              <div key={item.material} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">
                      {item.material}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {item.orders} orders
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      ${(item.revenue / 1000).toFixed(1)}K
                    </p>
                    <p className="text-xs text-gray-500">{item.percentage}%</p>
                  </div>
                </div>
                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
