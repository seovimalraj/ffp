"use client";

import CreateWarehouseModal from "@/components/modals/create-warehouse-modal";
import { PermissionsGuard } from "@/components/permission-guard";
import { Button } from "@/components/ui/button";
import { DataView, Column, CardConfig } from "@/components/ui/data-view";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";
import { IGroupWarehouses } from "@/types";
import { PermissionsNames } from "@cnc-quote/shared";
import {
  Eye,
  PlusIcon,
  Trash,
  Warehouse,
  MapPin,
  Package,
  TrendingUp,
  Box,
  FactoryIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

const StatCard = ({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: typeof Warehouse;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </div>
);

const Page = () => {
  const [warehouses, setWarehouses] = useState<IGroupWarehouses[]>([]);
  const [isCreateWarehouseModalOpen, setIsCreateWarehouseModalOpen] =
    useState(false);
  const [isWarehousesLoading, setIsWarehousesLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const router = useRouter();

  useEffect(() => {
    async function getWarehouses() {
      try {
        setIsWarehousesLoading(true);
        const response = await apiClient.get("/supplier/warehouses");
        if (response.status === 200) {
          setWarehouses(response.data.warehouses ?? []);
        } else {
          notify.error("Error while fetching warehouses");
        }
      } catch (error: any) {
        console.error(error, "<--here");
        notify.error(
          error?.response?.data?.message || "Error while fetching warehouses",
        );
      } finally {
        setIsWarehousesLoading(false);
      }
    }
    getWarehouses();
  }, [refresh]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalCapacity = warehouses.reduce(
      (sum, w) => sum + (w.total_capacity || 0),
      0,
    );
    const usedCapacity = warehouses.reduce(
      (sum, w) => sum + (w.used_capacity || 0),
      0,
    );
    const avgUtilization =
      totalCapacity > 0 ? ((usedCapacity / totalCapacity) * 100).toFixed(1) : 0;
    const criticalWarehouses = warehouses.filter((w) => {
      const util =
        w.total_capacity > 0 ? (w.used_capacity / w.total_capacity) * 100 : 0;
      return util >= 90;
    }).length;

    return {
      total: warehouses.length,
      totalCapacity,
      usedCapacity,
      avgUtilization,
      criticalWarehouses,
    };
  }, [warehouses]);

  const columns: Column<IGroupWarehouses>[] = [
    {
      key: "id",
      header: "ID",
      hidden: true,
      render: (row) => row.id,
    },
    {
      key: "name",
      header: "Warehouse",
      sortable: true,
      headerClassName:
        "py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-900",
      cellClassName:
        "whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Warehouse className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: "address",
      header: "Location",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin className="h-4 w-4 text-gray-400" />
          <span className="truncate max-w-[200px]">{row.address || "—"}</span>
        </div>
      ),
    },
    {
      key: "capacity",
      header: "Capacity Usage",
      render: (row) => {
        const percentage =
          row.total_capacity > 0
            ? Math.min((row.used_capacity / row.total_capacity) * 100, 100)
            : 0;
        const getColor = () => {
          if (percentage >= 90) return "bg-red-500";
          if (percentage >= 70) return "bg-amber-500";
          return "bg-emerald-500";
        };
        return (
          <div className="w-32">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">
                {row.used_capacity?.toLocaleString() || 0}
              </span>
              <span className="font-medium">{percentage.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${getColor()} rounded-full transition-all`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "total_capacity",
      header: "Total Capacity",
      sortable: true,
      render: (row) => (
        <span className="text-gray-700 font-medium">
          {row.total_capacity?.toLocaleString() || 0} {row.unit || "kg"}
        </span>
      ),
    },
  ];

  const cardConfig: CardConfig<IGroupWarehouses> = {
    title: (row) => row.name,
    subtitle: (row) => row.address || "No address specified",
    icon: () => <Warehouse className="h-5 w-5 text-primary" />,
    badge: (row) => {
      const util =
        row.total_capacity > 0
          ? (row.used_capacity / row.total_capacity) * 100
          : 0;
      if (util >= 90)
        return { label: "Critical", color: "bg-red-100 text-red-700" };
      if (util >= 70)
        return { label: "High Usage", color: "bg-amber-100 text-amber-700" };
      return { label: "Healthy", color: "bg-emerald-100 text-emerald-700" };
    },
    stats: [
      {
        label: "Total Capacity",
        value: (row) =>
          `${row.total_capacity?.toLocaleString() || "0"} ${row.unit || "kg"}`,
        icon: <Box className="h-4 w-4" />,
      },
      {
        label: "Used",
        value: (row) =>
          `${row.used_capacity?.toLocaleString() || "0"} ${row.unit || "kg"}`,
        icon: <Package className="h-4 w-4" />,
      },
    ],
    progress: {
      current: (row) => row.used_capacity || 0,
      total: (row) => row.total_capacity || 1,
      label: "Storage Utilization",
    },
    accentColor: (row) => {
      const util =
        row.total_capacity > 0
          ? (row.used_capacity / row.total_capacity) * 100
          : 0;
      if (util >= 90) return "bg-red-500";
      if (util >= 70) return "bg-amber-500";
      return "bg-emerald-500";
    },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warehouses</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your warehouse locations and monitor storage capacity.
          </p>
        </div>
        <div className="flex items-center justify-center gap-x-2">
          <PermissionsGuard permissions={PermissionsNames.warehouseWriteAccess}>
            <div className="mt-4 sm:mt-0">
              <Button
                onClick={() => router.push("/supplier/warehouse/materials")}
                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-black shadow-sm hover:bg-gray-100 border border-gray-300"
              >
                <FactoryIcon
                  className="-ml-0.5 mr-1.5 h-5 w-5"
                  aria-hidden="true"
                />
                Manage Materials
              </Button>
            </div>
          </PermissionsGuard>
          <PermissionsGuard permissions={PermissionsNames.warehouseWriteAccess}>
            <div className="mt-4 sm:mt-0">
              <Button
                onClick={() => setIsCreateWarehouseModalOpen(true)}
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
              >
                <PlusIcon
                  className="-ml-0.5 mr-1.5 h-5 w-5"
                  aria-hidden="true"
                />
                Add Warehouse
              </Button>
            </div>
          </PermissionsGuard>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Warehouse}
          label="Total Warehouses"
          value={stats.total}
          color="bg-blue-500"
        />
        <StatCard
          icon={Package}
          label="Total Capacity"
          value={stats.totalCapacity.toLocaleString()}
          subtext="kg"
          color="bg-emerald-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg. Utilization"
          value={`${stats.avgUtilization}%`}
          color="bg-violet-500"
        />
        <StatCard
          icon={Box}
          label="Critical Warehouses"
          value={stats.criticalWarehouses}
          subtext="≥90% capacity"
          color={stats.criticalWarehouses > 0 ? "bg-red-500" : "bg-gray-400"}
        />
      </div>

      {/* Data View with Table/Card Toggle */}
      <DataView
        columns={columns}
        data={warehouses}
        keyExtractor={(w) => w.id || w.name}
        emptyMessage="No warehouses found. Add your first warehouse to get started."
        isLoading={isWarehousesLoading}
        numbering={true}
        cardConfig={cardConfig}
        defaultView="cards"
        showViewToggle={true}
        searchable={true}
        searchPlaceholder="Search warehouses..."
        searchKeys={["name", "address"]}
        actions={[
          {
            label: "View Details",
            icon: <Eye className="size-4" />,
            onClick: (row) =>
              router.push(`/supplier/warehouse/entity/${row.id}`),
          },
          {
            label: "Delete",
            icon: <Trash className="size-4" />,
            onClick: (row) => console.log("Delete", row),
            className: "text-red-500 hover:text-red-600",
          },
        ]}
      />

      <CreateWarehouseModal
        isOpen={isCreateWarehouseModalOpen}
        onSuccess={() => setRefresh((o) => !o)}
        onClose={() => setIsCreateWarehouseModalOpen(false)}
      />
    </div>
  );
};

export default Page;
