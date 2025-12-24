/**
 * Step 12: Capacity Management Page
 * Ops UI for managing daily capacity ledger and lead time overrides
 */

"use client";

import React, { useState } from "react";
import type { CapacityDay } from "@cnc-quote/shared";

const MACHINE_GROUPS = [
  { id: "cnc-3axis", label: "CNC 3-Axis" },
  { id: "cnc-5axis", label: "CNC 5-Axis" },
  { id: "lathe", label: "Lathe" },
  { id: "press-brake", label: "Press Brake" },
  { id: "laser-cutter", label: "Laser Cutter" },
];

const PROCESSES = [
  { id: "cnc_milling", label: "CNC Milling" },
  { id: "turning", label: "Turning" },
  { id: "sheet", label: "Sheet Metal" },
  { id: "im", label: "Injection Molding" },
];

export default function CapacityManagementPage() {
  const [orgId, setOrgId] = useState<string>("");
  const [process, setProcess] = useState<string>("cnc_milling");
  const [machineGroup, setMachineGroup] = useState<string>("cnc-3axis");
  const [dateFrom, setDateFrom] = useState<string>(getTodayStr());
  const [dateTo, setDateTo] = useState<string>(getDateStr(30));
  const [capacityData, setCapacityData] = useState<CapacityDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch capacity data
  const fetchCapacity = async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        orgId,
        process,
        machineGroup,
        from: dateFrom,
        to: dateTo,
      });

      const res = await fetch(`/api/leadtime/capacity/window?${params}`);
      if (!res.ok) throw new Error("Failed to fetch capacity");

      const data = await res.json();
      setCapacityData(data);
    } catch (err: any) {
      console.error("Error fetching capacity:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update capacity value
  const updateCapacity = (
    day: string,
    field: "capacityMinutes" | "bookedMinutes",
    value: number,
  ) => {
    setCapacityData((prev) => {
      const existing = prev.find((d) => d.day === day);
      if (existing) {
        return prev.map((d) => (d.day === day ? { ...d, [field]: value } : d));
      } else {
        // Add new entry
        return [
          ...prev,
          {
            day,
            [field]: value,
            capacityMinutes: field === "capacityMinutes" ? value : 0,
            bookedMinutes: field === "bookedMinutes" ? value : 0,
            utilization: 0,
            machineGroup,
            process,
          },
        ];
      }
    });
  };

  // Save all changes
  const saveChanges = async () => {
    if (!orgId) return;

    setSaving(true);
    try {
      const entries = capacityData.map((d) => ({
        orgId,
        process,
        machineGroup,
        day: d.day,
        capacityMinutes: d.capacityMinutes,
        bookedMinutes: d.bookedMinutes,
      }));

      const res = await fetch("/api/leadtime/capacity/bulk-upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });

      if (!res.ok) throw new Error("Failed to save capacity");

      alert("Capacity saved successfully!");
      fetchCapacity(); // Refresh
    } catch (err: any) {
      console.error("Error saving capacity:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Generate date range
  const dateRange = generateDateRange(dateFrom, dateTo);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">
          Capacity Management
        </h1>

        {/* Filters */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Org ID
              </label>
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Enter org UUID"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Process
              </label>
              <select
                value={process}
                onChange={(e) => setProcess(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {PROCESSES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Machine Group
              </label>
              <select
                value={machineGroup}
                onChange={(e) => setMachineGroup(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {MACHINE_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={fetchCapacity}
              disabled={loading || !orgId}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load Capacity"}
            </button>

            <button
              onClick={saveChanges}
              disabled={saving || capacityData.length === 0}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Capacity Table */}
        {capacityData.length > 0 && (
          <div className="rounded-lg bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Capacity (min)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Booked (min)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Utilization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {dateRange.map((day) => {
                    const data = capacityData.find((d) => d.day === day);
                    const utilization = data
                      ? data.capacityMinutes > 0
                        ? (data.bookedMinutes / data.capacityMinutes) * 100
                        : 0
                      : 0;

                    return (
                      <tr key={day} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {formatDate(day)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <input
                            type="number"
                            value={data?.capacityMinutes || 0}
                            onChange={(e) =>
                              updateCapacity(
                                day,
                                "capacityMinutes",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <input
                            type="number"
                            value={data?.bookedMinutes || 0}
                            onChange={(e) =>
                              updateCapacity(
                                day,
                                "bookedMinutes",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className={`h-full ${getUtilizationColor(utilization)}`}
                                style={{
                                  width: `${Math.min(100, utilization)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {utilization.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(utilization)}`}
                          >
                            {getStatusLabel(utilization)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && capacityData.length === 0 && orgId && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-gray-500">
              No capacity data found. Enter values above and save.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility functions
function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateStr(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
}

function generateDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(from);
  const end = new Date(to);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getUtilizationColor(utilization: number): string {
  if (utilization >= 95) return "bg-red-500";
  if (utilization >= 85) return "bg-orange-500";
  if (utilization >= 70) return "bg-yellow-500";
  return "bg-green-500";
}

function getStatusBadge(utilization: number): string {
  if (utilization >= 95) return "bg-red-100 text-red-800";
  if (utilization >= 85) return "bg-orange-100 text-orange-800";
  if (utilization >= 70) return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
}

function getStatusLabel(utilization: number): string {
  if (utilization >= 95) return "Critical";
  if (utilization >= 85) return "High";
  if (utilization >= 70) return "Moderate";
  return "Available";
}
