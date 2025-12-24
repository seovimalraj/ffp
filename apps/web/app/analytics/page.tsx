"use client";

import DefaultLayout from "@/components/Layouts/DefaultLayout";
import {
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

interface ChartData {
  name: string;
  value: number;
  change: number;
  isPositive: boolean;
}

export default function AnalyticsPage() {
  // Mock analytics data
  const kpiData = [
    {
      title: "Total Revenue",
      value: "$284,350",
      change: "+12.5%",
      isPositive: true,
      icon: CurrencyDollarIcon,
      color: "text-primary",
    },
    {
      title: "Total Quotes",
      value: "1,247",
      change: "+8.2%",
      isPositive: true,
      icon: ChartBarIcon,
      color: "text-meta-3",
    },
    {
      title: "Active Customers",
      value: "342",
      change: "+5.1%",
      isPositive: true,
      icon: UserGroupIcon,
      color: "text-meta-5",
    },
    {
      title: "Avg. Lead Time",
      value: "4.2 days",
      change: "-0.8 days",
      isPositive: true,
      icon: ClockIcon,
      color: "text-meta-6",
    },
  ];

  const quotesByStatus: ChartData[] = [
    { name: "Pending", value: 45, change: 12, isPositive: true },
    { name: "Processing", value: 23, change: -5, isPositive: false },
    { name: "Quoted", value: 67, change: 18, isPositive: true },
    { name: "Approved", value: 89, change: 25, isPositive: true },
    { name: "Rejected", value: 12, change: -3, isPositive: false },
  ];

  const revenueByMonth = [
    { month: "Jan", revenue: 45000, quotes: 89 },
    { month: "Feb", revenue: 52000, quotes: 94 },
    { month: "Mar", revenue: 48000, quotes: 87 },
    { month: "Apr", revenue: 61000, quotes: 112 },
    { month: "May", revenue: 55000, quotes: 98 },
    { month: "Jun", revenue: 67000, quotes: 125 },
  ];

  const topCustomers = [
    { name: "Aerospace Dynamics", revenue: 45600, quotes: 23, growth: 15.2 },
    { name: "MedTech Solutions", revenue: 38900, quotes: 18, growth: 8.7 },
    {
      name: "AutoParts Manufacturing",
      revenue: 32400,
      quotes: 15,
      growth: 22.1,
    },
    { name: "Advanced Robotics Inc", revenue: 28700, quotes: 12, growth: -2.3 },
    {
      name: "Precision Components Ltd",
      revenue: 24800,
      quotes: 14,
      growth: 12.8,
    },
  ];

  const materialUsage = [
    { material: "Aluminum 6061-T6", percentage: 35, color: "bg-primary" },
    { material: "Stainless Steel 316", percentage: 25, color: "bg-meta-3" },
    { material: "Mild Steel", percentage: 20, color: "bg-meta-5" },
    { material: "Titanium Grade 2", percentage: 12, color: "bg-meta-6" },
    { material: "Other", percentage: 8, color: "bg-meta-1" },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <DefaultLayout>
      <div className="grid grid-cols-1 gap-9">
        {/* Page Header */}
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-black dark:text-white">
                Analytics & Reports
              </h3>
              <select
                defaultValue="30days"
                className="rounded border border-stroke bg-gray-50 py-2 px-3 text-black outline-none cursor-not-allowed opacity-75"
                disabled
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
                <option value="12months">Last 12 months</option>
              </select>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5">
          {kpiData.map((kpi, index) => (
            <div
              key={index}
              className="rounded-sm border border-stroke bg-white py-6 px-7.5 shadow-default dark:border-strokedark dark:bg-boxdark"
            >
              <div className="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-meta-2 dark:bg-meta-4">
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <h4 className="text-title-md font-bold text-black dark:text-white">
                    {kpi.value}
                  </h4>
                  <span className="text-sm font-medium">{kpi.title}</span>
                </div>
                <span
                  className={`flex items-center gap-1 text-sm font-medium ${
                    kpi.isPositive ? "text-meta-3" : "text-meta-1"
                  }`}
                >
                  {kpi.change}
                  {kpi.isPositive ? (
                    <ArrowTrendingUpIcon className="h-4 w-4" />
                  ) : (
                    <ArrowTrendingDownIcon className="h-4 w-4" />
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 gap-9 lg:grid-cols-2">
          {/* Quotes by Status */}
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
              <h3 className="font-medium text-black dark:text-white">
                Quotes by Status
              </h3>
            </div>
            <div className="p-7">
              <div className="space-y-4">
                {quotesByStatus.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-primary"></div>
                      <span className="text-black dark:text-white">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-black dark:text-white font-medium">
                        {item.value}
                      </span>
                      <span
                        className={`flex items-center gap-1 text-sm ${
                          item.isPositive ? "text-meta-3" : "text-meta-1"
                        }`}
                      >
                        {item.isPositive ? "+" : ""}
                        {item.change}
                        {item.isPositive ? (
                          <ArrowTrendingUpIcon className="h-3 w-3" />
                        ) : (
                          <ArrowTrendingDownIcon className="h-3 w-3" />
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Material Usage */}
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
              <h3 className="font-medium text-black dark:text-white">
                Material Usage Distribution
              </h3>
            </div>
            <div className="p-7">
              <div className="space-y-4">
                {materialUsage.map((material, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-black dark:text-white text-sm">
                        {material.material}
                      </span>
                      <span className="text-black dark:text-white font-medium">
                        {material.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div
                        className={`h-2 rounded-full ${material.color}`}
                        style={{ width: `${material.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
            <h3 className="font-medium text-black dark:text-white">
              Revenue & Quote Trends
            </h3>
          </div>
          <div className="p-7">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-6">
              {revenueByMonth.map((month, index) => (
                <div key={index} className="text-center">
                  <div className="mb-2">
                    <div
                      className="bg-primary rounded-t mx-auto"
                      style={{
                        height: `${month.revenue / 1000}px`,
                        width: "40px",
                        minHeight: "20px",
                        maxHeight: "100px",
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-meta-5 mb-1">{month.month}</div>
                  <div className="text-sm font-medium text-black dark:text-white">
                    {formatCurrency(month.revenue)}
                  </div>
                  <div className="text-xs text-meta-5">
                    {month.quotes} quotes
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
            <h3 className="font-medium text-black dark:text-white">
              Top Customers by Revenue
            </h3>
          </div>
          <div className="p-7">
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-2 text-left dark:bg-meta-4">
                    <th className="min-w-[200px] py-4 px-4 font-medium text-black dark:text-white">
                      Customer
                    </th>
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Revenue
                    </th>
                    <th className="min-w-[100px] py-4 px-4 font-medium text-black dark:text-white">
                      Quotes
                    </th>
                    <th className="min-w-[100px] py-4 px-4 font-medium text-black dark:text-white">
                      Growth
                    </th>
                    <th className="py-4 px-4 font-medium text-black dark:text-white">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((customer, index) => (
                    <tr key={index}>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white font-medium">
                          {customer.name}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white font-medium">
                          {formatCurrency(customer.revenue)}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white">
                          {customer.quotes}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                            customer.growth >= 0
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                          }`}
                        >
                          {customer.growth >= 0 ? "+" : ""}
                          {customer.growth.toFixed(1)}%
                        </span>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <button
                          className="hover:text-primary"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
