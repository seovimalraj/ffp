"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataView, Column, CardConfig } from "@/components/ui/data-view";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Warehouse,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  Box,
  ChevronRight,
} from "lucide-react";
import CreateSupplierMaterialModal from "@/components/modals/create-supplier-material-modal";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import Link from "next/link";
import AddStockModal from "@/components/modals/add-stock-modal";

interface SupplierMaterial {
  id: string;
  supplier_id: string;
  material_id: string;
  warehouse_id: string;
  stock_unit: string;
  supplier_price: number;
  currency: string;
  status: string;
  updated_at: string;
  created_at: string;
  current_stock: number;
  max_stock: number;
  warehouses: {
    id: string;
    name: string;
  };
  material: {
    name: string;
  };
}

const StatCard = ({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: typeof Package;
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

export default function SupplierInventoryPage() {
  const [isCreateMaterialModalOpen, setIsCreateMaterialModalOpen] =
    useState(false);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<SupplierMaterial>();
  const [supplierMaterials, setSupplierMaterials] = useState<
    SupplierMaterial[]
  >([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    async function fetchSupplierMaterial() {
      try {
        setIsLoadingMaterials(true);
        const response = await apiClient.get("/supplier/material");
        console.log(response.data, "<---");
        setSupplierMaterials(response.data.materials || []);
      } catch (error) {
        console.error(error);
        notify.error("Failed to fetch supplier materials");
      } finally {
        setIsLoadingMaterials(false);
      }
    }

    fetchSupplierMaterial();
  }, [refresh]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalMaterials = supplierMaterials.length;
    const totalValue = supplierMaterials.reduce(
      (sum, m) => sum + m.current_stock * m.supplier_price,
      0,
    );
    const lowStockItems = supplierMaterials.filter((m) => {
      const stockLevel = (m.current_stock / m.max_stock) * 100;
      return stockLevel <= 20;
    }).length;
    const avgStockLevel =
      totalMaterials > 0
        ? (
            supplierMaterials.reduce(
              (sum, m) => sum + (m.current_stock / m.max_stock) * 100,
              0,
            ) / totalMaterials
          ).toFixed(1)
        : 0;

    return {
      totalMaterials,
      totalValue,
      lowStockItems,
      avgStockLevel,
    };
  }, [supplierMaterials]);

  const columns: Column<SupplierMaterial>[] = [
    {
      key: "id",
      header: "ID",
      hidden: true,
      render: (row) => row.id,
    },
    {
      key: "material",
      header: "Material",
      sortable: true,
      headerClassName:
        "py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-900",
      cellClassName:
        "whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium">{row.material.name}</span>
        </div>
      ),
    },
    {
      key: "warehouse",
      header: "Warehouse",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2 text-gray-600">
          <Warehouse className="h-4 w-4 text-gray-400" />
          <span>{row.warehouses.name}</span>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock Level",
      render: (row) => {
        const percentage = (row.current_stock / row.max_stock) * 100;
        const getColor = () => {
          if (percentage <= 20) return "bg-red-500";
          if (percentage <= 50) return "bg-amber-500";
          return "bg-emerald-500";
        };
        return (
          <div className="w-32">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">
                {row.current_stock} {row.stock_unit}
              </span>
              <span className="font-medium">{percentage.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${getColor()} rounded-full transition-all`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "max_stock",
      header: "Max Stock",
      sortable: true,
      render: (row) => (
        <span className="text-gray-700 font-medium">
          {row.max_stock} {row.stock_unit}
        </span>
      ),
    },
    {
      key: "price",
      header: "Price",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-gray-400" />
          <span className="font-medium">
            {row.supplier_price} {row.currency}
          </span>
          <span className="text-xs text-gray-500">/{row.stock_unit}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => {
        const statusColors = {
          active: "bg-green-100 text-green-700",
          inactive: "bg-gray-100 text-gray-700",
          low: "bg-yellow-100 text-yellow-700",
        };
        return (
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[row.status as keyof typeof statusColors] || statusColors.active}`}
          >
            {row.status.toUpperCase()}
          </span>
        );
      },
    },
  ];

  const cardConfig: CardConfig<SupplierMaterial> = {
    title: (row) => row.material.name,
    subtitle: (row) => row.warehouses.name,
    icon: () => <Package className="h-5 w-5 text-primary" />,
    badge: (row) => {
      const stockLevel = (row.current_stock / row.max_stock) * 100;
      if (stockLevel <= 20)
        return { label: "Low Stock", color: "bg-red-100 text-red-700" };
      if (stockLevel <= 40)
        return { label: "Medium", color: "bg-amber-100 text-amber-700" };
      return { label: "Healthy", color: "bg-emerald-100 text-emerald-700" };
    },
    stats: [
      {
        label: "Current Stock",
        value: (row) => `${row.current_stock} ${row.stock_unit}`,
        icon: <Box className="h-4 w-4" />,
      },
      {
        label: "Price",
        value: (row) =>
          `${row.supplier_price} ${row.currency}/${row.stock_unit}`,
        icon: <DollarSign className="h-4 w-4" />,
      },
    ],
    progress: {
      current: (row) => row.current_stock,
      total: (row) => row.max_stock,
      label: "Stock Level",
    },
    accentColor: (row) => {
      const stockLevel = (row.current_stock / row.max_stock) * 100;
      if (stockLevel <= 20) return "bg-red-500";
      if (stockLevel <= 40) return "bg-amber-500";
      return "bg-emerald-500";
    },
  };

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500">
        <Link
          href="/supplier/warehouse"
          className="hover:text-primary transition-colors"
        >
          Warehouse
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">Materials</span>
      </nav>

      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Supplier Materials
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your material inventory and warehouse stock.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <Button
            onClick={() => setIsCreateMaterialModalOpen(true)}
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            Add Material
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label="Total Materials"
          value={stats.totalMaterials}
          color="bg-blue-500"
        />
        <StatCard
          icon={DollarSign}
          label="Total Value"
          value={`$${(stats.totalValue / 1000).toFixed(1)}K`}
          subtext="Current inventory"
          color="bg-emerald-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg. Stock Level"
          value={`${stats.avgStockLevel}%`}
          color="bg-violet-500"
        />
        <StatCard
          icon={AlertCircle}
          label="Low Stock Items"
          value={stats.lowStockItems}
          subtext="≤20% capacity"
          color={stats.lowStockItems > 0 ? "bg-red-500" : "bg-gray-400"}
        />
      </div>

      {/* Data View with Table/Card Toggle */}
      <DataView
        columns={columns}
        data={supplierMaterials}
        keyExtractor={(m) => m.id}
        emptyMessage="No materials found. Add your first material to get started."
        isLoading={isLoadingMaterials}
        numbering={true}
        cardConfig={cardConfig}
        defaultView="cards"
        showViewToggle={true}
        searchable={true}
        searchPlaceholder="Search materials..."
        actions={[
          {
            label: "Restock",
            icon: <ShoppingCart className="size-4" />,
            onClick: (row) => {
              setIsAddStockModalOpen(true);
              setSelectedMaterial(row);
            },
          },
          {
            label: "Edit",
            icon: <Edit className="size-4" />,
            onClick: (row) => {
              console.log("Edit material:", row);
              notify.info("Edit functionality coming soon");
            },
          },
          {
            label: "Delete",
            icon: <Trash2 className="size-4" />,
            onClick: (row) => {
              console.log("Delete material:", row);
              notify.info("Delete functionality coming soon");
            },
            className: "text-red-500 hover:text-red-600",
          },
        ]}
      />

      <CreateSupplierMaterialModal
        isOpen={isCreateMaterialModalOpen}
        onClose={() => setIsCreateMaterialModalOpen(false)}
        onSuccess={() => {
          setIsCreateMaterialModalOpen(false);
          setRefresh((o) => !o);
        }}
      />

      {isAddStockModalOpen && selectedMaterial && (
        <AddStockModal
          isOpen={isAddStockModalOpen}
          onClose={() => setIsAddStockModalOpen(false)}
          materialData={{
            material_id: selectedMaterial.id,
            stock_unit: selectedMaterial.stock_unit,
            max_stock: selectedMaterial.max_stock,
            warehouse: selectedMaterial.warehouse_id,
            current_stock: selectedMaterial.current_stock,
          }}
          onSuccess={() => {
            setIsAddStockModalOpen(false);
            setRefresh((o) => !o);
          }}
        />
      )}
    </div>
  );
}
