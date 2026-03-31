"use client";

import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface RevenueChartProps {
  categories: string[];
  cncData: number[];
  sheetMetalData: number[];
}

export function RevenueChart({ categories, cncData, sheetMetalData }: RevenueChartProps) {
  const options: ApexOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
      fontFamily: "inherit",
      background: "transparent",
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      }
    },
    colors: ["#7c3aed", "#3b82f6"], // Violet for CNC, Blue for Sheet Metal
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 100],
      },
    },
    dataLabels: { enabled: false },
    stroke: {
      curve: "smooth",
      width: 3,
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: "#64748b" },
      },
    },
    yaxis: {
      labels: {
        formatter: (value) => `$${(value / 1000).toFixed(0)}k`,
        style: { colors: "#64748b" },
      },
    },
    grid: {
      borderColor: "#e2e8f0",
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      markers: { radius: 12 },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (val) => `$${val.toLocaleString()}` },
    },
  };

  const series = [
    { name: "CNC Machining", data: cncData },
    { name: "Sheet Metal", data: sheetMetalData },
  ];

  return <Chart options={options} series={series} type="area" height={350} />;
}

interface OrderStatusChartProps {
  series: number[];
  labels: string[];
}

export function OrderStatusChart({ series, labels }: OrderStatusChartProps) {
  const options: ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "inherit",
      background: "transparent",
    },
    labels,
    colors: ["#eab308", "#3b82f6", "#a855f7", "#22c55e", "#64748b"], // Custom colors mapped to statuses
    plotOptions: {
      pie: {
        donut: {
          size: "75%",
          labels: {
            show: true,
            name: { show: true, fontSize: "14px", color: "#64748b" },
            value: {
              show: true,
              fontSize: "24px",
              fontWeight: 600,
              color: "#0f172a",
              formatter: (val) => val,
            },
            total: {
              show: true,
              showAlways: true,
              label: "Active Orders",
              fontSize: "14px",
              color: "#64748b",
              formatter: function (w) {
                return w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
              },
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: false },
    legend: {
      show: true,
      position: "bottom",
      markers: { radius: 12 },
    },
    tooltip: { theme: "light" },
  };

  return <Chart options={options} series={series} type="donut" height={350} />;
}

interface PlatformGrowthChartProps {
  categories: string[];
  customerData: number[];
  supplierData: number[];
}

export function PlatformGrowthChart({ categories, customerData, supplierData }: PlatformGrowthChartProps) {
  const options: ApexOptions = {
    chart: {
      type: "line",
      toolbar: { show: false },
      fontFamily: "inherit",
      background: "transparent",
    },
    colors: ["#7c3aed", "#10b981"], // Violet for Customers, Emerald for Suppliers
    stroke: { curve: "smooth", width: 3 },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: "#64748b" } },
    },
    yaxis: {
      labels: { style: { colors: "#64748b" } },
    },
    grid: {
      borderColor: "#e2e8f0",
      strokeDashArray: 4,
    },
    legend: { position: "top", horizontalAlign: "right" },
    tooltip: { theme: "light" },
    dataLabels: { enabled: false }
  };

  const series = [
    { name: "New Customers", data: customerData },
    { name: "New Suppliers", data: supplierData },
  ];

  return <Chart options={options} series={series} type="line" height={300} />;
}
