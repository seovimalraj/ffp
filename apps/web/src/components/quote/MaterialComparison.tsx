/**
 * Live Material Comparison Matrix Component
 *
 * Side-by-side material comparison with real-time pricing updates.
 * Shows up to 5 materials with properties, pricing, and recommendations.
 *
 * Features:
 * - Real-time price updates (<500ms target)
 * - Filterable by properties (strength, machinability, cost)
 * - Highlight best value option
 * - One-click material swap
 * - Property comparison (strength, weight, cost, machinability)
 * - Visual indicators for deltas
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

export interface MaterialComparisonProps {
  /** Current material ID */
  materialId: string;

  /** Process type */
  processType: string;

  /** Geometry for pricing */
  geometry: {
    volume_cc: number;
    surface_area_cm2: number;
    removed_material_cc?: number;
  };

  /** Features */
  features?: {
    holes?: number;
    pockets?: number;
    slots?: number;
    faces?: number;
  };

  /** Quantity */
  quantity: number;

  /** Machine ID */
  machineId: string;

  /** Region */
  region?: "US" | "EU" | "IN" | "UK" | "CA" | "AU";

  /** Callback when material is changed */
  onMaterialChange?: (materialId: string) => void;
}

interface ComparisonItem {
  material: {
    id: string;
    code: string;
    name: string;
    category: string;
  };
  properties: {
    density_kg_m3: number;
    machinability_index: number;
    hardness_hb?: number;
    tensile_mpa?: number;
  };
  pricing: {
    unit_price: number;
    material_cost: number;
    machining_cost: number;
    total_cost: number;
    lead_time_days: number;
  };
  comparison: {
    cost_delta_pct: number;
    cost_delta_usd: number;
    weight_g: number;
    weight_delta_pct: number;
    machinability_score: number;
    strength_score: number;
  };
  compatibility: {
    available: boolean;
    process_compatible: boolean;
    region_available: boolean;
    finish_compatible: boolean;
    warnings: string[];
  };
  score: number;
  is_best_value: boolean;
}

interface ComparisonResponse {
  current: ComparisonItem;
  alternatives: ComparisonItem[];
  metadata: {
    total_alternatives: number;
    best_value_id: string;
    cheapest_id: string;
    strongest_id: string;
    most_machinable_id: string;
  };
}

export function MaterialComparison({
  materialId,
  processType,
  geometry,
  features,
  quantity,
  machineId,
  region,
  onMaterialChange,
}: MaterialComparisonProps) {
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "cost" | "strength" | "machinability"
  >("all");
  const [sortBy, setSortBy] = useState<
    "score" | "cost" | "strength" | "machinability"
  >("score");

  // Fetch material comparison
  const fetchComparison = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/pricing/material-comparison", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          materialId,
          processType,
          geometry,
          features,
          quantity,
          machineId,
          region,
          limit: 5,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch material comparison");
      }

      const data: ComparisonResponse = await response.json();
      setComparison(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load comparison",
      );
      console.error("Material comparison error:", err);
    } finally {
      setLoading(false);
    }
  }, [
    materialId,
    processType,
    geometry,
    features,
    quantity,
    machineId,
    region,
  ]);

  // Load comparison on mount and when params change
  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  // Handle material swap
  const handleMaterialSwap = (newMaterialId: string) => {
    onMaterialChange?.(newMaterialId);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Format delta percentage
  const formatDelta = (delta: number) => {
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}%`;
  };

  // Filter and sort alternatives
  const filteredAlternatives =
    comparison?.alternatives.filter((alt) => {
      if (filter === "all") return true;
      if (filter === "cost") return alt.comparison.cost_delta_pct < 0; // Cheaper
      if (filter === "strength")
        return (
          (alt.properties.tensile_mpa || 0) >
          (comparison.current.properties.tensile_mpa || 0)
        );
      if (filter === "machinability")
        return (
          alt.properties.machinability_index >
          comparison.current.properties.machinability_index
        );
      return true;
    }) || [];

  const sortedAlternatives = [...filteredAlternatives].sort((a, b) => {
    if (sortBy === "score") return b.score - a.score;
    if (sortBy === "cost") return a.pricing.total_cost - b.pricing.total_cost;
    if (sortBy === "strength")
      return (b.properties.tensile_mpa || 0) - (a.properties.tensile_mpa || 0);
    if (sortBy === "machinability")
      return (
        b.properties.machinability_index - a.properties.machinability_index
      );
    return 0;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Comparing materials...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
          <Button onClick={fetchComparison} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!comparison) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Material Comparison</CardTitle>
            <Button onClick={fetchComparison} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {/* Filters */}
            <div className="flex items-center space-x-4">
              <div>
                <Label className="text-sm">Filter</Label>
                <Select
                  value={filter}
                  onValueChange={(value: any) => setFilter(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Materials</SelectItem>
                    <SelectItem value="cost">Cheaper Only</SelectItem>
                    <SelectItem value="strength">Stronger Only</SelectItem>
                    <SelectItem value="machinability">
                      More Machinable
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Sort By</Label>
                <Select
                  value={sortBy}
                  onValueChange={(value: any) => setSortBy(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Best Value</SelectItem>
                    <SelectItem value="cost">Lowest Cost</SelectItem>
                    <SelectItem value="strength">Highest Strength</SelectItem>
                    <SelectItem value="machinability">
                      Most Machinable
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick stats */}
            <div className="text-right">
              <div className="text-sm text-gray-600">
                {sortedAlternatives.length} alternatives found
              </div>
              <div className="text-xs text-gray-500">
                Best value:{" "}
                {
                  comparison.alternatives.find((a) => a.is_best_value)?.material
                    .name
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Material */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Badge variant="default">Current Selection</Badge>
              <CardTitle className="mt-2">
                {comparison.current.material.name}
              </CardTitle>
              <p className="text-sm text-gray-600">
                {comparison.current.material.code}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {formatCurrency(comparison.current.pricing.unit_price)}
              </div>
              <div className="text-sm text-gray-600">per part</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Density</div>
              <div className="font-semibold">
                {comparison.current.properties.density_kg_m3} kg/m³
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Machinability</div>
              <div className="font-semibold">
                {comparison.current.properties.machinability_index}/100
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Tensile Strength</div>
              <div className="font-semibold">
                {comparison.current.properties.tensile_mpa
                  ? `${comparison.current.properties.tensile_mpa} MPa`
                  : "N/A"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Lead Time</div>
              <div className="font-semibold">
                {comparison.current.pricing.lead_time_days} days
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alternatives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedAlternatives.map((alt) => (
          <Card
            key={alt.material.id}
            className={`${alt.is_best_value ? "border-2 border-green-500" : ""} hover:shadow-lg transition-shadow`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  {alt.is_best_value && (
                    <Badge variant="default" className="bg-green-500 mb-2">
                      <SparklesIcon className="h-3 w-3 mr-1 inline" />
                      Best Value
                    </Badge>
                  )}
                  <CardTitle className="text-lg">{alt.material.name}</CardTitle>
                  <p className="text-xs text-gray-600">{alt.material.code}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">
                    {formatCurrency(alt.pricing.unit_price)}
                  </div>
                  <div className="text-sm flex items-center justify-end">
                    {alt.comparison.cost_delta_pct < 0 ? (
                      <span className="text-green-600 flex items-center">
                        <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                        {formatDelta(alt.comparison.cost_delta_pct)}
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center">
                        <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                        {formatDelta(alt.comparison.cost_delta_pct)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Properties */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="text-xs text-gray-600">Machinability</div>
                  <div className="font-semibold">
                    {alt.properties.machinability_index}/100
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Strength</div>
                  <div className="font-semibold">
                    {alt.properties.tensile_mpa
                      ? `${alt.properties.tensile_mpa} MPa`
                      : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Weight</div>
                  <div className="font-semibold">
                    {alt.comparison.weight_g.toFixed(0)}g
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Lead Time</div>
                  <div className="font-semibold">
                    {alt.pricing.lead_time_days} days
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {alt.compatibility.warnings.length > 0 && (
                <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  {alt.compatibility.warnings.map((warning, i) => (
                    <div
                      key={i}
                      className="text-xs text-yellow-800 flex items-center"
                    >
                      <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <Button
                onClick={() => handleMaterialSwap(alt.material.id)}
                className="w-full"
                variant={alt.is_best_value ? "default" : "outline"}
              >
                {alt.is_best_value && (
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                )}
                Switch to {alt.material.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      {comparison.metadata && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600">Best Value</div>
                <div className="font-semibold text-green-700">
                  {
                    comparison.alternatives.find(
                      (a) =>
                        a.material.id === comparison.metadata.best_value_id,
                    )?.material.name
                  }
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">Cheapest</div>
                <div className="font-semibold text-blue-700">
                  {
                    comparison.alternatives.find(
                      (a) => a.material.id === comparison.metadata.cheapest_id,
                    )?.material.name
                  }
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-sm text-gray-600">Strongest</div>
                <div className="font-semibold text-purple-700">
                  {
                    comparison.alternatives.find(
                      (a) => a.material.id === comparison.metadata.strongest_id,
                    )?.material.name
                  }
                </div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="text-sm text-gray-600">Most Machinable</div>
                <div className="font-semibold text-orange-700">
                  {
                    comparison.alternatives.find(
                      (a) =>
                        a.material.id ===
                        comparison.metadata.most_machinable_id,
                    )?.material.name
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
