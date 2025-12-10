"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";
import {
  Warehouse,
  MapPin,
  Package,
  Box,
  DollarSign,
  ChevronLeft,
  Globe,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface WarehouseDetails {
  id: string;
  name: string;
  total_capacity: number;
  used_capacity: number;
  address?: string;
  geolocation?: string;
  unit?: string;
}

interface MaterialInWarehouse {
  id: string;
  material_id: string;
  current_stock: number;
  max_stock: number;
  stock_unit: string;
  supplier_price: number;
  currency: string;
  stock_material: string;
  material: {
    name: string;
  };
}

export default function WarehouseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const warehouseId = params?.id as string;

  const [warehouse, setWarehouse] = useState<WarehouseDetails | null>(null);
  const [materials, setMaterials] = useState<MaterialInWarehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  if (!warehouseId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">
            Warehouse not found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            The warehouse you're looking for doesn't exist.
          </p>
          <div className="mt-6">
            <Button onClick={() => router.push("/supplier/warehouse")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Warehouses
            </Button>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    async function fetchWarehouseDetails() {
      try {
        setIsLoading(true);

        // Fetch warehouse details with materials in a single call
        const response = await apiClient.get(
          `/supplier/warehouses/${warehouseId}`,
        );
        const data = response.data;

        // Extract warehouse and materials from combined response
        if (data.warehouse) {
          setWarehouse(data.warehouse.warehouse);
          setMaterials(data.warehouse.materials || []);
        } else {
          // Fallback for old API format
          setWarehouse(data);
          setMaterials([]);
        }
      } catch (error: any) {
        console.error(error);
        notify.error(
          error?.response?.data?.message || "Failed to fetch warehouse details",
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (warehouseId) {
      fetchWarehouseDetails();
    }
  }, [warehouseId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">
            Warehouse not found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            The warehouse you're looking for doesn't exist.
          </p>
          <div className="mt-6">
            <Button onClick={() => router.push("/supplier/warehouse")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Warehouses
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const capacityPercentage =
    warehouse.total_capacity > 0
      ? (warehouse.used_capacity / warehouse.total_capacity) * 100
      : 0;

  const getCapacityColor = () => {
    if (capacityPercentage >= 90) return "bg-red-500";
    if (capacityPercentage >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link
          href="/supplier/warehouse"
          className="hover:text-primary transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Warehouses
        </Link>
        <span className="text-gray-900 font-medium">{warehouse.name}</span>
      </nav>

      {/* Section 1: Warehouse Details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl">
                <Warehouse className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {warehouse.name}
                </h1>
                <p className="text-primary-foreground/80 mt-1">
                  Warehouse Details
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Capacity Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Storage Capacity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Box className="h-4 w-4" />
                  <span className="text-xs font-medium">Total Capacity</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {warehouse.total_capacity.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {warehouse.unit || "kg"}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Package className="h-4 w-4" />
                  <span className="text-xs font-medium">Used Capacity</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {warehouse.used_capacity.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {warehouse.unit || "kg"}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">Utilization</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {capacityPercentage.toFixed(1)}%
                </p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getCapacityColor()} rounded-full transition-all`}
                    style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location Section */}
          {(warehouse.address || warehouse.geolocation) && (
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Location Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {warehouse.address && (
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">
                        Address
                      </p>
                      <p className="text-sm text-gray-900">
                        {warehouse.address}
                      </p>
                    </div>
                  </div>
                )}

                {warehouse.geolocation && (
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                    <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">
                        Geolocation
                      </p>
                      <p className="text-sm text-gray-900 font-mono">
                        {warehouse.geolocation}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Materials in Warehouse */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Materials in Warehouse
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {materials.length} material{materials.length !== 1 ? "s" : ""}{" "}
            stored in this warehouse
          </p>
        </div>

        <div className="p-6">
          {materials.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                No materials
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                This warehouse doesn't have any materials yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {materials.map((material) => {
                const stockPercentage =
                  material.max_stock > 0
                    ? (material.current_stock / material.max_stock) * 100
                    : 0;

                const getStockColor = () => {
                  if (stockPercentage <= 20) return "bg-red-500";
                  if (stockPercentage <= 50) return "bg-amber-500";
                  return "bg-emerald-500";
                };

                const getStockBadge = () => {
                  if (stockPercentage <= 20)
                    return {
                      label: "Low Stock",
                      color: "bg-red-100 text-red-700",
                    };
                  if (stockPercentage <= 50)
                    return {
                      label: "Medium",
                      color: "bg-amber-100 text-amber-700",
                    };
                  return {
                    label: "Healthy",
                    color: "bg-emerald-100 text-emerald-700",
                  };
                };

                const badge = getStockBadge();

                return (
                  <div
                    key={material.id}
                    className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">
                            {material.material.name}
                          </h4>
                          <p className="text-xs text-gray-500 capitalize">
                            {material.stock_material}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Stock Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-600 font-medium">
                          Stock Level
                        </span>
                        <span className="font-semibold text-gray-900">
                          {stockPercentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getStockColor()} rounded-full transition-all`}
                          style={{
                            width: `${Math.min(stockPercentage, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-1.5 text-gray-500">
                        <span>
                          {material.current_stock} {material.stock_unit}
                        </span>
                        <span>
                          Max: {material.max_stock} {material.stock_unit}
                        </span>
                      </div>
                    </div>

                    {/* Price Information */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-1 text-gray-600">
                        <DollarSign className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">
                          Price per {material.stock_unit}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {material.supplier_price} {material.currency}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
