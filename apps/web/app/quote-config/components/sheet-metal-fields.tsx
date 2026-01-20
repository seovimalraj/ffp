"use client";

import { PartConfig } from "@/types/part-config";
import { SHEET_METAL_MATERIALS } from "@/lib/pricing-engine";
import { 
  Scissors, 
  Layers, 
  Drill, 
  Wrench, 
  Zap,
  Settings,
  Ruler,
  Package
} from "lucide-react";

interface SheetMetalFieldsProps {
  part: PartConfig;
  index: number;
  updatePart: (
    index: number,
    field: keyof PartConfig,
    value: any,
    saveToDb?: boolean
  ) => void;
  className?: string;
}

const CUTTING_METHODS = [
  { value: "laser", label: "Laser Cutting", icon: "⚡", description: "High precision, clean edges" },
  { value: "plasma", label: "Plasma Cutting", icon: "🔥", description: "Thick materials, fast" },
  { value: "waterjet", label: "Waterjet", icon: "💧", description: "No heat, all materials" },
  { value: "turret-punch", label: "Turret Punch", icon: "🔨", description: "Fast for holes, simple shapes" },
];

// Build material options from SHEET_METAL_MATERIALS
const SHEET_MATERIALS = Object.entries(SHEET_METAL_MATERIALS)
  .filter(([key]) => !key.includes("titanium") && !key.includes("inconel") && !key.includes("hastelloy")) // Filter exotic materials
  .flatMap(([, materials]) => 
    (materials as any[])
      .filter((m: any) => !m.requiresManualQuote) // Only include auto-quotable materials
      .map((m: any) => ({
        value: m.code,
        label: m.name,
        thickness: m.thickness,
        category: m.category,
      }))
  );

const POWDER_COATING_COLORS = [
  { value: "black", label: "Black (RAL 9005)", color: "#0A0A0A" },
  { value: "white", label: "White (RAL 9016)", color: "#F1F0EA" },
  { value: "gray", label: "Gray (RAL 7035)", color: "#CBD0CC" },
  { value: "red", label: "Red (RAL 3000)", color: "#A72920" },
  { value: "blue", label: "Blue (RAL 5005)", color: "#005387" },
  { value: "green", label: "Green (RAL 6005)", color: "#0E4C3D" },
  { value: "yellow", label: "Yellow (RAL 1003)", color: "#F9A800" },
  { value: "custom", label: "Custom Color", color: "#gradient" },
];

const HARDWARE_OPTIONS = [
  { type: "rivet-nut", label: "Rivet Nuts (PEM)", cost: 0.25 },
  { type: "pem-stud", label: "PEM Studs", cost: 0.30 },
  { type: "standoff", label: "Standoffs", cost: 0.40 },
  { type: "captive-screw", label: "Captive Screws", cost: 0.35 },
  { type: "clinch-nut", label: "Clinch Nuts", cost: 0.20 },
];

export function SheetMetalFields({ part, index, updatePart, className = "" }: SheetMetalFieldsProps) {
  const features = part.geometry?.sheetMetalFeatures;
  
  // Auto-populate from detected features
  const detectedThickness = features?.thickness || 1.5;
  const detectedBendCount = features?.bendCount || 0;
  const detectedHoleCount = features?.holeCount || 0;
  const recommendedCuttingMethod = features?.recommendedCuttingMethod || "laser";
  const partType = features?.partType || "bracket";
  const complexity = features?.complexity || "moderate";

  return (
    <div className={`space-y-4 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Scissors className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">Sheet Metal Configuration</h3>
        {features && (
          <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
            {partType.replace(/-/g, ' ').toUpperCase()} • {complexity.toUpperCase()}
          </span>
        )}
      </div>

      {/* Detected Features Summary */}
      {features && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-white/80 p-2 rounded border border-blue-100">
            <div className="text-xs text-gray-500">Thickness</div>
            <div className="font-bold text-blue-700">{detectedThickness.toFixed(1)}mm</div>
          </div>
          <div className="bg-white/80 p-2 rounded border border-blue-100">
            <div className="text-xs text-gray-500">Bends</div>
            <div className="font-bold text-blue-700">{detectedBendCount}</div>
          </div>
          <div className="bg-white/80 p-2 rounded border border-blue-100">
            <div className="text-xs text-gray-500">Holes</div>
            <div className="font-bold text-blue-700">{detectedHoleCount}</div>
          </div>
          <div className="bg-white/80 p-2 rounded border border-blue-100">
            <div className="text-xs text-gray-500">Area</div>
            <div className="font-bold text-blue-700">{((features.flatArea || 0) / 1000).toFixed(0)}cm²</div>
          </div>
        </div>
      )}

      {/* Material Thickness */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Ruler className="w-4 h-4" />
          Material Thickness (mm)
        </label>
        <input
          type="number"
          step="0.1"
          min="0.5"
          max="25"
          value={part.sheet_thickness_mm || detectedThickness}
          onChange={(e) => updatePart(index, "sheet_thickness_mm", parseFloat(e.target.value), true)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., 1.5"
        />
        <p className="text-xs text-gray-500">
          Auto-detected: {detectedThickness.toFixed(1)}mm • Common: 0.5, 0.8, 1.0, 1.5, 2.0, 3.0mm
        </p>
      </div>

      {/* Material Grade */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Package className="w-4 h-4" />
          Material & Thickness
        </label>
        <select
          value={part.material || "AL5052-2.0"}
          onChange={(e) => {
            const selectedMat = SHEET_MATERIALS.find(m => m.value === e.target.value);
            updatePart(index, "material", e.target.value, true);
            // Also update thickness from material
            if (selectedMat?.thickness) {
              updatePart(index, "sheet_thickness_mm", selectedMat.thickness, true);
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          {/* Group materials by category */}
          {Object.entries(
            SHEET_MATERIALS.reduce((acc, mat) => {
              const category = mat.category || "other";
              if (!acc[category]) acc[category] = [];
              acc[category].push(mat);
              return acc;
            }, {} as Record<string, typeof SHEET_MATERIALS>)
          ).map(([category, materials]) => (
            <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
              {materials.map((mat) => (
                <option key={mat.value} value={mat.value}>
                  {mat.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Cutting Method */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Zap className="w-4 h-4" />
          Cutting Method
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CUTTING_METHODS.map((method) => (
            <button
              key={method.value}
              type="button"
              onClick={() => updatePart(index, "cutting_method", method.value, true)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                (part.cutting_method || recommendedCuttingMethod) === method.value
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{method.icon}</span>
                <span className="font-medium text-sm">{method.label}</span>
              </div>
              <p className="text-xs text-gray-500">{method.description}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-blue-600">
          ✓ Recommended: {CUTTING_METHODS.find(m => m.value === recommendedCuttingMethod)?.label}
        </p>
      </div>

      {/* Bend Count */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Layers className="w-4 h-4" />
          Number of Bends
        </label>
        <input
          type="number"
          min="0"
          max="50"
          value={part.bend_count ?? detectedBendCount}
          onChange={(e) => updatePart(index, "bend_count", parseInt(e.target.value), true)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="0"
        />
        <p className="text-xs text-gray-500">
          Auto-detected: {detectedBendCount} bends
        </p>
      </div>

      {/* Forming Operations */}
      {detectedBendCount > 0 && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Settings className="w-4 h-4" />
            Additional Forming
          </label>
          <div className="space-y-2">
            {["Hemming", "Countersinking", "Louvers", "Embossing"].map((op) => (
              <label key={op} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={part.forming_operations?.includes(op.toLowerCase()) || false}
                  onChange={(e) => {
                    const current = part.forming_operations || [];
                    const updated = e.target.checked
                      ? [...current, op.toLowerCase()]
                      : current.filter(o => o !== op.toLowerCase());
                    updatePart(index, "forming_operations", updated, true);
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                {op}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Hardware Inserts */}
      {detectedHoleCount > 0 && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Wrench className="w-4 h-4" />
            Hardware Inserts
          </label>
          <div className="space-y-2">
            {HARDWARE_OPTIONS.map((hw) => (
              <div key={hw.type} className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Qty"
                  value={
                    part.hardware_inserts?.find(h => h.type === hw.type)?.quantity || ""
                  }
                  onChange={(e) => {
                    const qty = parseInt(e.target.value) || 0;
                    const current = part.hardware_inserts || [];
                    const updated = qty > 0
                      ? [...current.filter(h => h.type !== hw.type), { type: hw.type, quantity: qty }]
                      : current.filter(h => h.type !== hw.type);
                    updatePart(index, "hardware_inserts", updated, true);
                  }}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-sm flex-1">{hw.label}</span>
                <span className="text-xs text-gray-500">${hw.cost}/pc</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Welding */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={part.welding_required || false}
            onChange={(e) => updatePart(index, "welding_required", e.target.checked, true)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Welding Required</span>
        </label>
        <p className="text-xs text-gray-500 ml-6">
          For multi-part assemblies or reinforcements
        </p>
      </div>

      {/* Powder Coating */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Drill className="w-4 h-4" />
          Powder Coating Color
        </label>
        <select
          value={part.powder_coating_color || ""}
          onChange={(e) => updatePart(index, "powder_coating_color", e.target.value || undefined, true)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No Powder Coating</option>
          {POWDER_COATING_COLORS.map((color) => (
            <option key={color.value} value={color.value}>
              {color.label}
            </option>
          ))}
        </select>
        {part.powder_coating_color && (
          <div className="flex items-center gap-2 mt-2">
            <div
              className="w-6 h-6 rounded border border-gray-300"
              style={{
                backgroundColor: POWDER_COATING_COLORS.find(c => c.value === part.powder_coating_color)?.color
              }}
            />
            <span className="text-xs text-gray-600">
              Selected: {POWDER_COATING_COLORS.find(c => c.value === part.powder_coating_color)?.label}
            </span>
          </div>
        )}
      </div>

      {/* Manufacturing Info */}
      {features && (
        <div className="mt-4 p-3 bg-blue-100/50 rounded-lg border border-blue-200">
          <h4 className="text-xs font-semibold text-blue-900 mb-2">Estimated Manufacturing Time</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-600">Cutting:</span>
              <span className="ml-2 font-medium">{features.estimatedCuttingTime?.toFixed(1) || 0} min</span>
            </div>
            <div>
              <span className="text-gray-600">Forming:</span>
              <span className="ml-2 font-medium">{features.estimatedFormingTime?.toFixed(1) || 0} min</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Nesting Efficiency:</span>
              <span className="ml-2 font-medium">{((features.nestingEfficiency || 0) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
