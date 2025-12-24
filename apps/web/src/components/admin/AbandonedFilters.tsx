"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAbandonedQuotes } from "@/components/providers/AbandonedQuotesProvider";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

export function AbandonedFilters() {
  const { filters, setFilters } = useAbandonedQuotes();
  const [localFilters, setLocalFilters] = useState(filters);

  const handleApplyFilters = () => {
    setFilters(localFilters);
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/admin/abandoned/export.csv");
      if (!response.ok) {
        throw new Error("Failed to export");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "abandoned-quotes.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  // Calculate SLO badge (abandonment rate last 7 days)
  const abandonmentRate = 23.5; // Mock data - would be calculated from actual data

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Age Filter */}
            <div className="min-w-[200px]">
              <Select
                value={localFilters.age || ""}
                onValueChange={(value) =>
                  setLocalFilters((prev) => ({ ...prev, age: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Value Band Filter */}
            <div className="min-w-[200px]">
              <Select
                value={localFilters.value_band || ""}
                onValueChange={(value) =>
                  setLocalFilters((prev) => ({ ...prev, value_band: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Quote Value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="<$100">Under $100</SelectItem>
                  <SelectItem value="$100–$1k">$100–$1,000</SelectItem>
                  <SelectItem value="$1k–$10k">$1,000–$10,000</SelectItem>
                  <SelectItem value=">$10k">Over $10,000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dropoff Stage Filter */}
            <div className="min-w-[200px]">
              <Select
                value={localFilters.dropoff_stage || ""}
                onValueChange={(value) =>
                  setLocalFilters((prev) => ({ ...prev, dropoff_stage: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Dropoff Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Before Upload">Before Upload</SelectItem>
                  <SelectItem value="After Upload">After Upload</SelectItem>
                  <SelectItem value="After CAD">After CAD Analysis</SelectItem>
                  <SelectItem value="After First Price">
                    After First Price
                  </SelectItem>
                  <SelectItem value="After Lead Select">
                    After Lead Time Select
                  </SelectItem>
                  <SelectItem value="Checkout Abandon">
                    Checkout Abandon
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="min-w-[250px]">
              <Input
                placeholder="Search buyer, quote ID, email..."
                value={localFilters.search || ""}
                onChange={(e) =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    search: e.target.value,
                  }))
                }
              />
            </div>

            {/* Apply Button */}
            <Button onClick={handleApplyFilters} className="whitespace-nowrap">
              Apply Filters
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* SLO Badge */}
            <Badge
              variant={abandonmentRate > 20 ? "destructive" : "secondary"}
              className="px-3 py-1"
            >
              {abandonmentRate}% abandonment (7d)
            </Badge>

            {/* Export Button */}
            <Button
              variant="outline"
              onClick={handleExport}
              className="whitespace-nowrap"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Active Filters Summary */}
        {(localFilters.age ||
          localFilters.value_band ||
          localFilters.dropoff_stage ||
          localFilters.search) && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-wrap gap-2">
              {localFilters.age && (
                <Badge variant="outline" className="text-xs">
                  Age: {localFilters.age}
                </Badge>
              )}
              {localFilters.value_band && (
                <Badge variant="outline" className="text-xs">
                  Value: {localFilters.value_band}
                </Badge>
              )}
              {localFilters.dropoff_stage && (
                <Badge variant="outline" className="text-xs">
                  Stage: {localFilters.dropoff_stage}
                </Badge>
              )}
              {localFilters.search && (
                <Badge variant="outline" className="text-xs">
                  Search: {localFilters.search}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
