"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Factory,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Clock,
  Zap,
  BarChart3,
  Settings,
  Package,
  Download,
  Wrench,
  PlayCircle,
  Eye,
} from "lucide-react";

interface Machine {
  id: string;
  name: string;
  type: string;
  utilization: number;
  status: "operational" | "warning" | "maintenance" | "down";
  currentJob: string | null;
  hoursRemaining: number;
  nextMaintenance: string;
  totalCapacity: number;
  usedCapacity: number;
  efficiency: number;
}

export default function SupplierCapacityPage() {
  const [timeRange, setTimeRange] = useState("week");

  const machines: Machine[] = [
    {
      id: "1",
      name: "CNC Mill #1",
      type: "Milling",
      utilization: 85,
      status: "operational",
      currentJob: "ORD-2025-0045",
      hoursRemaining: 12,
      nextMaintenance: "2024-02-15",
      totalCapacity: 168,
      usedCapacity: 143,
      efficiency: 94,
    },
    {
      id: "2",
      name: "CNC Mill #2",
      type: "Milling",
      utilization: 72,
      status: "operational",
      currentJob: "ORD-2025-0044",
      hoursRemaining: 8,
      nextMaintenance: "2024-02-10",
      totalCapacity: 168,
      usedCapacity: 121,
      efficiency: 96,
    },
    {
      id: "3",
      name: "CNC Mill #3",
      type: "Milling",
      utilization: 95,
      status: "warning",
      currentJob: "ORD-2025-0043",
      hoursRemaining: 18,
      nextMaintenance: "2024-02-05",
      totalCapacity: 168,
      usedCapacity: 160,
      efficiency: 89,
    },
    {
      id: "4",
      name: "CNC Lathe #1",
      type: "Turning",
      utilization: 60,
      status: "operational",
      currentJob: "ORD-2025-0042",
      hoursRemaining: 6,
      nextMaintenance: "2024-02-20",
      totalCapacity: 168,
      usedCapacity: 101,
      efficiency: 92,
    },
    {
      id: "5",
      name: "CNC Lathe #2",
      type: "Turning",
      utilization: 45,
      status: "operational",
      currentJob: null,
      hoursRemaining: 0,
      nextMaintenance: "2024-02-18",
      totalCapacity: 168,
      usedCapacity: 76,
      efficiency: 97,
    },
    {
      id: "6",
      name: "5-Axis Mill #1",
      type: "5-Axis Milling",
      utilization: 88,
      status: "operational",
      currentJob: "ORD-2025-0041",
      hoursRemaining: 15,
      nextMaintenance: "2024-02-12",
      totalCapacity: 168,
      usedCapacity: 148,
      efficiency: 95,
    },
    {
      id: "7",
      name: "Wire EDM #1",
      type: "EDM",
      utilization: 52,
      status: "operational",
      currentJob: "ORD-2025-0040",
      hoursRemaining: 4,
      nextMaintenance: "2024-02-25",
      totalCapacity: 168,
      usedCapacity: 87,
      efficiency: 93,
    },
    {
      id: "8",
      name: "Grinding Machine #1",
      type: "Grinding",
      utilization: 38,
      status: "operational",
      currentJob: null,
      hoursRemaining: 0,
      nextMaintenance: "2024-02-08",
      totalCapacity: 168,
      usedCapacity: 64,
      efficiency: 91,
    },
    {
      id: "9",
      name: "CNC Mill #4",
      type: "Milling",
      utilization: 78,
      status: "operational",
      currentJob: "ORD-2025-0039",
      hoursRemaining: 10,
      nextMaintenance: "2024-02-14",
      totalCapacity: 168,
      usedCapacity: 131,
      efficiency: 95,
    },
    {
      id: "10",
      name: "Swiss Lathe #1",
      type: "Swiss Turning",
      utilization: 0,
      status: "maintenance",
      currentJob: null,
      hoursRemaining: 0,
      nextMaintenance: "2024-01-24",
      totalCapacity: 168,
      usedCapacity: 0,
      efficiency: 0,
    },
  ];

  const weeklyData = [
    { day: "Mon", utilization: 82, jobs: 45, available: 280 },
    { day: "Tue", utilization: 88, jobs: 52, available: 198 },
    { day: "Wed", utilization: 85, jobs: 48, available: 245 },
    { day: "Thu", utilization: 79, jobs: 42, available: 312 },
    { day: "Fri", utilization: 92, jobs: 58, available: 145 },
    { day: "Sat", utilization: 65, jobs: 35, available: 425 },
    { day: "Sun", utilization: 45, jobs: 22, available: 580 },
  ];

  const upcomingJobs = [
    {
      id: "ORD-2025-0051",
      customer: "AeroSpace Dynamics",
      parts: 12,
      hours: 24,
      priority: "high",
      startDate: "2024-01-26",
    },
    {
      id: "ORD-2025-0052",
      customer: "MedDevice Inc",
      parts: 8,
      hours: 16,
      priority: "normal",
      startDate: "2024-01-27",
    },
    {
      id: "ORD-2025-0053",
      customer: "TechCorp Industries",
      parts: 15,
      hours: 32,
      priority: "urgent",
      startDate: "2024-01-25",
    },
    {
      id: "ORD-2025-0054",
      customer: "Global Robotics",
      parts: 6,
      hours: 12,
      priority: "normal",
      startDate: "2024-01-28",
    },
    {
      id: "ORD-2025-0055",
      customer: "Acme Manufacturing",
      parts: 20,
      hours: 40,
      priority: "high",
      startDate: "2024-01-29",
    },
  ];

  const stats = {
    avgUtilization: Math.round(
      machines.reduce((sum, m) => sum + m.utilization, 0) / machines.length,
    ),
    availableCapacity: Math.round(
      machines.reduce((sum, m) => sum + (m.totalCapacity - m.usedCapacity), 0),
    ),
    totalCapacity: machines.reduce((sum, m) => sum + m.totalCapacity, 0),
    operational: machines.filter((m) => m.status === "operational").length,
    warning: machines.filter((m) => m.status === "warning").length,
    maintenance: machines.filter((m) => m.status === "maintenance").length,
    avgEfficiency: Math.round(
      machines
        .filter((m) => m.efficiency > 0)
        .reduce((sum, m) => sum + m.efficiency, 0) /
        machines.filter((m) => m.efficiency > 0).length,
    ),
    activeJobs: machines.filter((m) => m.currentJob).length,
  };

  const getStatusIcon = (status: Machine["status"]) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "maintenance":
        return <Wrench className="w-5 h-5 text-blue-500" />;
      case "down":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: Machine["status"]) => {
    const variants = {
      operational: "bg-green-100 text-green-700 border-green-200",
      warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
      maintenance: "bg-blue-100 text-blue-700 border-blue-200",
      down: "bg-red-100 text-red-700 border-red-200",
    };
    return (
      <Badge
        className={`${variants[status]} border text-xs flex items-center gap-1`}
      >
        {getStatusIcon(status)}
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      urgent: "bg-red-100 text-red-700 border-red-200",
      high: "bg-orange-100 text-orange-700 border-orange-200",
      normal: "bg-blue-100 text-blue-700 border-blue-200",
      low: "bg-gray-100 text-gray-700 border-gray-200",
    };
    return (
      <Badge
        className={`${variants[priority as keyof typeof variants]} border text-xs`}
      >
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const maxUtilization = Math.max(...weeklyData.map((d) => d.utilization));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Capacity Management
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor and optimize production capacity
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Avg Utilization</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.avgUtilization}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.activeJobs} active jobs
                </p>
              </div>
              <Factory className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Available Capacity</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.availableCapacity}h
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  of {stats.totalCapacity}h total
                </p>
              </div>
              <Zap className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Machines Status</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.operational}/{machines.length}
                </p>
                <p className="text-xs text-yellow-500 mt-1">
                  {stats.warning} need attention
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Avg Efficiency</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.avgEfficiency}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Overall performance
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white border border-gray-200">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="machines">
            Machines ({machines.length})
          </TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Weekly Utilization Chart */}
          <Card className="hover:shadow-md transition-shadow bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Weekly Capacity Utilization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-4">
                {weeklyData.map((day, idx) => {
                  const height = (day.utilization / maxUtilization) * 100;
                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="w-full bg-gray-100 rounded-lg h-48 relative flex items-end p-2">
                        <div
                          className={`w-full rounded transition-all ${
                            day.utilization >= 90
                              ? "bg-red-500"
                              : day.utilization >= 75
                                ? "bg-yellow-500"
                                : "bg-green-500"
                          }`}
                          style={{ height: `${height}%` }}
                        />
                        <div className="absolute inset-x-0 top-2 text-center">
                          <div className="text-lg font-bold text-gray-900">
                            {day.utilization}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {day.jobs} jobs
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm font-medium text-gray-700">
                        {day.day}
                      </div>
                      <div className="text-xs text-gray-500">
                        {day.available}h avail
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Jobs */}
          <Card className="hover:shadow-md transition-shadow bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Upcoming Jobs Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {getPriorityBadge(job.priority)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {job.id}
                      </div>
                      <div className="text-sm text-gray-600">
                        {job.customer}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        <span>{job.parts} parts</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{job.hours}h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(job.startDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Machines Tab */}
        <TabsContent value="machines" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {machines.map((machine) => (
              <Card
                key={machine.id}
                className="hover:shadow-lg transition-shadow bg-white"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(machine.status)}
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {machine.name}
                        </h3>
                        <p className="text-sm text-gray-600">{machine.type}</p>
                      </div>
                    </div>
                    {getStatusBadge(machine.status)}
                  </div>

                  <div className="space-y-3">
                    {/* Utilization Bar */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Utilization</span>
                        <span className="font-semibold text-gray-900">
                          {machine.utilization}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            machine.utilization >= 90
                              ? "bg-red-500"
                              : machine.utilization >= 75
                                ? "bg-yellow-500"
                                : "bg-green-500"
                          }`}
                          style={{ width: `${machine.utilization}%` }}
                        />
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-600">Capacity</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {machine.usedCapacity}/{machine.totalCapacity}h
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Efficiency</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {machine.efficiency}%
                        </p>
                      </div>
                      {machine.currentJob ? (
                        <>
                          <div>
                            <p className="text-xs text-gray-600">Current Job</p>
                            <p className="text-sm font-semibold text-blue-600">
                              {machine.currentJob}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Remaining</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {machine.hoursRemaining}h
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2">
                          <Badge className="bg-green-100 text-green-700 border-green-200 border">
                            <PlayCircle className="w-3 h-3 mr-1" />
                            Available
                          </Badge>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-xs text-gray-600">
                          Next Maintenance
                        </p>
                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(
                            machine.nextMaintenance,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <Eye className="w-3 h-3 mr-1" />
                        Details
                      </Button>
                      <Button size="sm" variant="outline">
                        <Settings className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card className="hover:shadow-md transition-shadow bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Production Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {machines
                  .filter((m) => m.currentJob)
                  .map((machine) => (
                    <div
                      key={machine.id}
                      className="p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {machine.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {machine.type}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-blue-600">
                            {machine.currentJob}
                          </div>
                          <div className="text-xs text-gray-500">
                            {machine.hoursRemaining}h remaining
                          </div>
                        </div>
                      </div>
                      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-blue-500 rounded-full"
                          style={{
                            width: `${((machine.totalCapacity - machine.hoursRemaining) / machine.totalCapacity) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Machine Type Distribution */}
            <Card className="hover:shadow-md transition-shadow bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Factory className="w-5 h-5 text-purple-600" />
                  Capacity by Machine Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(new Set(machines.map((m) => m.type))).map(
                    (type) => {
                      const typeMachines = machines.filter(
                        (m) => m.type === type,
                      );
                      const avgUtil = Math.round(
                        typeMachines.reduce(
                          (sum, m) => sum + m.utilization,
                          0,
                        ) / typeMachines.length,
                      );
                      const totalCap = typeMachines.reduce(
                        (sum, m) => sum + m.totalCapacity,
                        0,
                      );
                      const usedCap = typeMachines.reduce(
                        (sum, m) => sum + m.usedCapacity,
                        0,
                      );
                      return (
                        <div key={type} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-700">
                              {type}
                            </span>
                            <span className="text-gray-600">
                              {typeMachines.length} machines • {avgUtil}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                              style={{ width: `${avgUtil}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500">
                            {usedCap}h / {totalCap}h capacity
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Efficiency Metrics */}
            <Card className="hover:shadow-md transition-shadow bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Efficiency Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {machines
                    .filter((m) => m.efficiency > 0)
                    .sort((a, b) => b.efficiency - a.efficiency)
                    .slice(0, 5)
                    .map((machine) => (
                      <div
                        key={machine.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                      >
                        <div>
                          <div className="font-semibold text-gray-900">
                            {machine.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {machine.type}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {machine.efficiency}%
                          </div>
                          <div className="text-xs text-gray-500">
                            efficiency
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
