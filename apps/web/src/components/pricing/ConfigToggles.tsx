/**
 * Step 13: Configuration Toggles Component
 * Interactive controls for quantity, material, process, and lead time
 */

"use client";

import React from "react";
import { PricingRequest } from "@/lib/pricing/types";

export interface ConfigTogglesProps {
  value: PricingRequest;
  onChange: (value: PricingRequest) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Configuration toggles for pricing parameters
 * Provides instant feedback via optimistic updates
 */
export function ConfigToggles({
  value,
  onChange,
  disabled = false,
  className = "",
}: ConfigTogglesProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* Quantity */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="quantity-input"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Quantity
        </label>
        <input
          id="quantity-input"
          type="number"
          min={1}
          max={10000}
          value={value.quantity}
          onChange={(e) => {
            const quantity = Math.max(1, Number(e.target.value));
            onChange({ ...value, quantity });
          }}
          disabled={disabled}
          aria-label="Quantity"
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Material */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="material-select"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Material
        </label>
        <select
          id="material-select"
          value={value.material_code}
          onChange={(e) =>
            onChange({ ...value, material_code: e.target.value })
          }
          disabled={disabled}
          aria-label="Material"
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="AL6061">Aluminum 6061-T6</option>
          <option value="SS304">Stainless Steel 304</option>
          <option value="SS316">Stainless Steel 316</option>
          <option value="BRASS">Brass</option>
          <option value="COPPER">Copper</option>
          <option value="TITANIUM">Titanium</option>
          <option value="ABS">ABS Plastic</option>
          <option value="PLA">PLA</option>
          <option value="NYLON">Nylon</option>
        </select>
      </div>

      {/* Process */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="process-select"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Manufacturing Process
        </label>
        <select
          id="process-select"
          value={value.process}
          onChange={(e) => onChange({ ...value, process: e.target.value })}
          disabled={disabled}
          aria-label="Manufacturing Process"
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="cnc_milling">CNC Milling</option>
          <option value="turning">CNC Turning</option>
          <option value="sheet">Sheet Metal</option>
          <option value="im">Injection Molding</option>
        </select>
      </div>

      {/* Lead Time */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Lead Time
        </label>
        <div
          role="group"
          aria-label="Lead time selection"
          className="flex gap-2"
        >
          {(["econ", "std", "express"] as const).map((leadClass) => (
            <button
              key={leadClass}
              type="button"
              onClick={() => onChange({ ...value, lead_class: leadClass })}
              disabled={disabled}
              aria-pressed={value.lead_class === leadClass}
              className={`
                flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all
                ${
                  value.lead_class === leadClass
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              `}
            >
              {leadClass === "econ" && "10 days"}
              {leadClass === "std" && "7 days"}
              {leadClass === "express" && "3 days"}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>-4% discount</span>
          <span>Standard</span>
          <span>+12% surge</span>
        </div>
      </div>
    </div>
  );
}

export default ConfigToggles;
