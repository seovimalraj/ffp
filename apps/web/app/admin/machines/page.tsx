"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Cpu,
  Search,
  CheckCircle,
  XCircle,
  Settings,
  Wrench,
  Calendar,
  TrendingUp,
  Activity,
  Package,
} from "lucide-react";
import { useState } from "react";

interface Machine {
  id: string;
  name: string;
  type: string;
  supplier: string;
  status: "operational" | "maintenance" | "offline" | "idle";
  utilization: number;
  specifications: {
    axes: string;
    workEnvelope: string;
    spindle: string;
    toolCapacity: number;
  };
  currentJob: string | null;
  hoursRun: number;
  nextMaintenance: string;
  performance: number;
}

const mockMachines: Machine[] = [
  {
    id: "1",
    name: "Haas VF-4SS",
    type: "5-Axis CNC Mill",
    supplier: "Precision Parts Co",
    status: "operational",
    utilization: 87,
    specifications: {
      axes: "5-Axis",
      workEnvelope: '20" x 16" x 20"',
      spindle: "12,000 RPM",
      toolCapacity: 40,
    },
    currentJob: "ORD-2024-001",
    hoursRun: 3240,
    nextMaintenance: "2024-02-05",
    performance: 95,
  },
  {
    id: "2",
    name: "DMG MORI NTX 2000",
    type: "CNC Turning Center",
    supplier: "Advanced CNC Solutions",
    status: "operational",
    utilization: 92,
    specifications: {
      axes: "3-Axis + C-Axis",
      workEnvelope: '26" dia x 35"',
      spindle: "5,000 RPM",
      toolCapacity: 24,
    },
    currentJob: "ORD-2024-002",
    hoursRun: 4150,
    nextMaintenance: "2024-01-28",
    performance: 98,
  },
  {
    id: "3",
    name: "Mazak Integrex i-400S",
    type: "Multi-Tasking Machine",
    supplier: "MetalWorks Pro",
    status: "maintenance",
    utilization: 0,
    specifications: {
      axes: "5-Axis",
      workEnvelope: '31" dia x 60"',
      spindle: "6,000 RPM",
      toolCapacity: 60,
    },
    currentJob: null,
    hoursRun: 5820,
    nextMaintenance: "2024-01-25",
    performance: 89,
  },
  {
    id: "4",
    name: "Okuma MB-5000H",
    type: "Horizontal Machining Center",
    supplier: "Precision Parts Co",
    status: "operational",
    utilization: 78,
    specifications: {
      axes: "4-Axis",
      workEnvelope: '32" x 32" x 32"',
      spindle: "15,000 RPM",
      toolCapacity: 80,
    },
    currentJob: "ORD-2024-004",
    hoursRun: 2890,
    nextMaintenance: "2024-02-15",
    performance: 93,
  },
  {
    id: "5",
    name: "Citizen Cincom L20",
    type: "Swiss-Type Lathe",
    supplier: "Advanced CNC Solutions",
    status: "idle",
    utilization: 0,
    specifications: {
      axes: "7-Axis",
      workEnvelope: "20mm dia",
      spindle: "10,000 RPM",
      toolCapacity: 27,
    },
    currentJob: null,
    hoursRun: 1650,
    nextMaintenance: "2024-03-01",
    performance: 97,
  },
  {
    id: "6",
    name: "Trumpf TruLaser 3030",
    type: "Laser Cutting",
    supplier: "MetalWorks Pro",
    status: "operational",
    utilization: 85,
    specifications: {
      axes: "2-Axis",
      workEnvelope: '60" x 120"',
      spindle: "N/A",
      toolCapacity: 0,
    },
    currentJob: "ORD-2024-003",
    hoursRun: 3120,
    nextMaintenance: "2024-02-10",
    performance: 91,
  },
  {
    id: "7",
    name: "Makino a51nx",
    type: "Horizontal Machining",
    supplier: "Titanium Works",
    status: "offline",
    utilization: 0,
    specifications: {
      axes: "5-Axis",
      workEnvelope: '20" x 20" x 20"',
      spindle: "20,000 RPM",
      toolCapacity: 60,
    },
    currentJob: null,
    hoursRun: 6420,
    nextMaintenance: "2024-01-20",
    performance: 78,
  },
  {
    id: "8",
    name: "Hurco VMX30i",
    type: "Vertical Machining Center",
    supplier: "Rapid Prototyping Inc",
    status: "operational",
    utilization: 95,
    specifications: {
      axes: "3-Axis",
      workEnvelope: '30" x 20" x 20"',
      spindle: "10,000 RPM",
      toolCapacity: 24,
    },
    currentJob: "ORD-2024-006",
    hoursRun: 1280,
    nextMaintenance: "2024-03-15",
    performance: 96,
  },
];

export default function AdminMachinesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredMachines = mockMachines.filter((machine) => {
    const matchesSearch =
      machine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      machine.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      machine.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || machine.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Machine["status"]) => {
    const variants = {
      operational: {
        bg: "bg-green-500/10 text-green-500 border-green-500/20",
        icon: CheckCircle,
      },
      maintenance: {
        bg: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        icon: Wrench,
      },
      offline: {
        bg: "bg-red-500/10 text-red-500 border-red-500/20",
        icon: XCircle,
      },
      idle: {
        bg: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        icon: Activity,
      },
    };

    const variant = variants[status];
    const Icon = variant.icon;

    return (
      <Badge
        className={`${variant.bg} border flex items-center gap-1 px-2 py-1`}
      >
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return "text-green-500";
    if (utilization >= 70) return "text-yellow-500";
    if (utilization > 0) return "text-blue-500";
    return "text-gray-500";
  };

  const stats = {
    total: mockMachines.length,
    operational: mockMachines.filter((m) => m.status === "operational").length,
    maintenance: mockMachines.filter((m) => m.status === "maintenance").length,
    avgUtilization: Math.round(
      mockMachines.reduce((sum, m) => sum + m.utilization, 0) /
        mockMachines.length,
    ),
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Machines</h1>
          <p className="text-gray-400 mt-1">
            Monitor and manage manufacturing equipment
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Package className="w-4 h-4 mr-2" />
          Add Machine
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-800/50 border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Machines</p>
              <p className="text-3xl font-bold text-white mt-1">
                {stats.total}
              </p>
            </div>
            <Cpu className="w-10 h-10 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Operational</p>
              <p className="text-3xl font-bold text-white mt-1">
                {stats.operational}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">In Maintenance</p>
              <p className="text-3xl font-bold text-white mt-1">
                {stats.maintenance}
              </p>
            </div>
            <Wrench className="w-10 h-10 text-yellow-500" />
          </div>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Avg Utilization</p>
              <p className="text-3xl font-bold text-white mt-1">
                {stats.avgUtilization}%
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by machine name, type, or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-900/50 border-slate-700 text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-white"
          >
            <option value="all">All Status</option>
            <option value="operational">Operational</option>
            <option value="maintenance">Maintenance</option>
            <option value="offline">Offline</option>
            <option value="idle">Idle</option>
          </select>
        </div>
      </Card>

      {/* Machines Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMachines.map((machine) => (
          <Card
            key={machine.id}
            className="bg-slate-800/50 border-slate-700 p-6 hover:bg-slate-800/70 transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {machine.name}
                  </h3>
                  <p className="text-sm text-gray-400">{machine.type}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {machine.supplier}
                  </p>
                </div>
              </div>
              {getStatusBadge(machine.status)}
            </div>

            {/* Specifications */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Axes</p>
                <p className="text-sm font-medium text-white">
                  {machine.specifications.axes}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Work Envelope</p>
                <p className="text-sm font-medium text-white">
                  {machine.specifications.workEnvelope}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Spindle Speed</p>
                <p className="text-sm font-medium text-white">
                  {machine.specifications.spindle}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Tool Capacity</p>
                <p className="text-sm font-medium text-white">
                  {machine.specifications.toolCapacity > 0
                    ? `${machine.specifications.toolCapacity} tools`
                    : "N/A"}
                </p>
              </div>
            </div>

            {/* Utilization */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Utilization</span>
                <span
                  className={`text-sm font-semibold ${getUtilizationColor(machine.utilization)}`}
                >
                  {machine.utilization}%
                </span>
              </div>
              <div className="bg-slate-900/50 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    machine.utilization >= 90
                      ? "bg-green-500"
                      : machine.utilization >= 70
                        ? "bg-yellow-500"
                        : machine.utilization > 0
                          ? "bg-blue-500"
                          : "bg-gray-600"
                  }`}
                  style={{ width: `${machine.utilization}%` }}
                />
              </div>
            </div>

            {/* Current Job & Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Current Job</p>
                {machine.currentJob ? (
                  <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 border">
                    {machine.currentJob}
                  </Badge>
                ) : (
                  <span className="text-sm text-gray-500">None</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Performance</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {machine.performance}%
                  </span>
                  <TrendingUp className="w-3 h-3 text-green-500" />
                </div>
              </div>
            </div>

            {/* Maintenance Info */}
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Next Maintenance</p>
                  <p className="text-sm font-medium text-white">
                    {machine.nextMaintenance}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Hours Run</p>
                <p className="text-sm font-medium text-white">
                  {machine.hoursRun.toLocaleString()}h
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-slate-700">
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </Button>
              <Button variant="outline" className="flex-1 border-slate-700">
                <Activity className="w-4 h-4 mr-2" />
                Monitor
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
