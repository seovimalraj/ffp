"use client";
import React, { useCallback, useEffect, useState } from "react";
import { ContractsV1 } from "@cnc-quote/shared";

export interface PartConfigFormProps {
  quoteId: string;
  partId: string;
  config: any; // existing config_json
  baseUrl?: string;
  authToken?: string;
  onChange?: (next: any) => void;
  onRecalc?: (config?: ContractsV1.PartConfigV1) => void;
}

// Simple debounce helper
function useDebounce<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export const PartConfigForm: React.FC<PartConfigFormProps> = ({
  quoteId,
  partId,
  config,
  baseUrl = "",
  authToken,
  onChange,
  onRecalc,
}) => {
  const [local, setLocal] = useState<any>(config || {});
  const debounced = useDebounce(local, 600);

  useEffect(() => {
    setLocal(config || {});
  }, [config?.audit?.updated_at]);

  const update = useCallback((patch: Record<string, any>) => {
    setLocal((prev: any) => ({
      ...prev,
      ...patch,
      audit: { ...(prev.audit || {}), updated_at: new Date().toISOString() },
    }));
  }, []);

  // Persist + trigger recalc after debounce
  useEffect(() => {
    if (!debounced || !debounced.id) return;
    const run = async () => {
      try {
        await fetch(`${baseUrl}/api/quotes/${quoteId}/parts/${partId}/config`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify(debounced),
        });
        onChange?.(debounced);
        onRecalc?.(debounced);
      } catch (e) {
        console.warn("config persist failed", e);
      }
    };
    run();
  }, [debounced]);

  const processOptions = [
    { v: "cnc_milling", label: "CNC Milling" },
    { v: "cnc_turning", label: "CNC Turning" },
    { v: "sheet_metal", label: "Sheet Metal" },
  ];
  const complexityOptions = [
    { v: "low", label: "Low Complexity" },
    { v: "medium", label: "Medium Complexity" },
    { v: "high", label: "High Complexity" },
  ];
  const gaugeOptions = ["10", "12", "14", "16", "18", "20", "22", "24"];
  const leadOptions = [
    { v: "standard", label: "Standard" },
    { v: "expedite", label: "Expedite" },
  ];
  const toleranceOptions = [
    { v: "standard", label: "General" },
    { v: "fine", label: "Fine" },
  ];

  const qtyString = (local.quantities || []).join(",");
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      <label className="flex flex-col gap-1">
        <span>Process</span>
        <select
          value={local.process_type || ""}
          onChange={(e) => update({ process_type: e.target.value })}
          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
        >
          {processOptions.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span>Material</span>
        <select
          value={local.material_id || ""}
          onChange={(e) => update({ material_id: e.target.value })}
          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
        >
          <option value="best_available">Best Available</option>
          <option value="al_6061">6061 Aluminum</option>
          <option value="ss_304">304 Stainless</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span>Finish</span>
        <select
          value={(local.finish_ids && local.finish_ids[0]) || ""}
          onChange={(e) =>
            update({ finish_ids: e.target.value ? [e.target.value] : [] })
          }
          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
        >
          <option value="">As-Machined</option>
          <option value="anodized_clear">Anodized Clear</option>
          <option value="anodized_black">Anodized Black</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span>Quantities</span>
        <input
          value={qtyString}
          onChange={(e) => {
            const nums = e.target.value
              .split(",")
              .map((v) => parseInt(v.trim(), 10))
              .filter((v) => !isNaN(v));
            update({ quantities: nums, selected_quantity: nums[0] });
          }}
          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Lead Time</span>
        <select
          value={local.lead_time_option || ""}
          onChange={(e) => update({ lead_time_option: e.target.value })}
          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
        >
          {leadOptions.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span>Tolerance</span>
        <select
          value={local.tolerance_class || ""}
          onChange={(e) => update({ tolerance_class: e.target.value })}
          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
        >
          {toleranceOptions.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {/* CNC specific sample field */}
      {local.process_type?.startsWith("cnc") && (
        <label className="flex flex-col gap-1 col-span-2">
          <span>Surface Finish (Ra µin)</span>
          <select
            value={local.surface_finish || ""}
            onChange={(e) => update({ surface_finish: e.target.value })}
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
          >
            <option value="standard">Standard ~125</option>
            <option value="improved">Improved ~63</option>
            <option value="fine">Fine ~32</option>
          </select>
        </label>
      )}
      {local.process_type?.startsWith("cnc") && (
        <label className="flex flex-col gap-1 col-span-2">
          <span>Machining Complexity</span>
          <select
            value={local.machining_complexity || "medium"}
            onChange={(e) => update({ machining_complexity: e.target.value })}
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
          >
            {complexityOptions.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* Sheet metal sample fields */}
      {local.process_type === "sheet_metal" && (
        <>
          <label className="flex flex-col gap-1">
            <span>Thickness (mm)</span>
            <input
              type="number"
              value={local.sheet_thickness_mm || ""}
              onChange={(e) =>
                update({ sheet_thickness_mm: parseFloat(e.target.value) })
              }
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Bends</span>
            <input
              type="number"
              value={local.bend_count || ""}
              onChange={(e) =>
                update({ bend_count: parseInt(e.target.value, 10) })
              }
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 col-span-2">
            <span>Material Gauge</span>
            <select
              value={local.material_gauge || ""}
              onChange={(e) => update({ material_gauge: e.target.value })}
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
            >
              <option value="">—</option>
              {gaugeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
};

export default PartConfigForm;
