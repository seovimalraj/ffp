import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CadViewer } from "@/components/cad/cad-viewer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  PartConfig,
  MaterialItem,
  ToleranceItem,
  FinishItem,
  InspectionItem,
  ThreadItem,
} from "@/types/part-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import DFMAnalysis from "./dfm-analysis";
import {
  getDefaultThickness,
  isCNCProcess,
  isSheetMetalProcess,
  CNC_MATERIALS,
  SHEET_METAL_MATERIALS,
  CNC_FINISHES,
  SHEET_METAL_FINISHES,
  CNC_TOLERANCES,
  SHEET_METAL_THICKNESSES,
} from "@/lib/pricing-engine";

interface EditPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculatePrice: (
    part: PartConfig,
    leadTimeType: PartConfig["leadTimeType"],
  ) => number;
  part: PartConfig;
  index: number;
  updatePart: (
    index: number,
    field: keyof PartConfig,
    value: any,
    saveToDb?: boolean,
  ) => void;
  updatePartFields?: (
    index: number,
    updates: Partial<PartConfig>,
    saveToDb?: boolean,
  ) => void;
  MATERIALS_LIST: MaterialItem[];
  TOLERANCES_LIST: ToleranceItem[];
  FINISHES_LIST: FinishItem[];
  THREAD_OPTIONS: ThreadItem[];
  INSPECTIONS_OPTIONS: InspectionItem[];
}

export const CERTIFICATES_LIST = [
  {
    value: "itar_ear",
    label: "ITAR / EAR Registration",
    description:
      "U.S. export control compliance for defense-related manufacturing.",
    category: "Compliance",
  },
  // {
  //   value: "cmm",
  //   label: "CMM",
  //   description:
  //     "Cybersecurity Maturity Model Certification required for DoD programs.",
  //   category: "Cybersecurity",
  // },
  {
    value: "iso_9001",
    label: "ISO 9001",
    description: "Quality management system certification.",
    category: "Quality",
  },
  {
    value: "as9100",
    label: "AS9100",
    description: "Aerospace quality management standard.",
    category: "Aerospace",
  },
  {
    value: "hardware_cert",
    label: "Hardware Certification",
    description: "Certification for regulated or safety-critical hardware.",
    category: "Quality",
  },
  {
    value: "coc",
    label: "Certificate of Conformance",
    description: "Confirms parts meet specified requirements.",
    category: "Documentation",
  },
  {
    value: "material_traceability",
    label: "Material Traceability",
    description: "Full traceability of raw materials to source.",
    category: "Materials",
  },
  {
    value: "jcp_ejcp",
    label: "JCP / eJCP",
    description: "U.S. DoD Joint Certification Program compliance.",
    category: "Defense",
  },
  {
    value: "material_cert",
    label: "Material Certification",
    description: "Mill certificates verifying material composition.",
    category: "Materials",
  },
] as const;

export function EditPartModal({
  isOpen,
  onClose,
  part,
  index,
  updatePart,
  MATERIALS_LIST,
  TOLERANCES_LIST,
  FINISHES_LIST,
  THREAD_OPTIONS,
  INSPECTIONS_OPTIONS,
  calculatePrice,
  updatePartFields,
}: EditPartModalProps) {
  const [activeTab, setActiveTab] = useState("config");
  const [localPart, setLocalPart] = useState<PartConfig>(part);
  const [selectedHighlight, setSelectedHighlight] = useState<{
    checkId: string;
    selectionHint?: {
      type: "feature" | "surface" | "edge" | "dimension";
      featureType?: string;
      location?: { x: number; y: number; z: number };
      triangles?: number[];
      description?: string;
    };
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalPart(part);
      setActiveTab("config"); // Reset to config tab when modal opens
      setSelectedHighlight(null); // Clear highlight when modal opens
    }
  }, [isOpen, part]);

  const updateLocalPart = (field: keyof PartConfig, value: any) => {
    setLocalPart((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (updatePartFields) {
      const updates: Partial<PartConfig> = {};
      const keys = Object.keys(localPart) as (keyof PartConfig)[];
      keys.forEach((key) => {
        if (localPart[key] !== part[key]) {
          // @ts-expect-error dynamic key assignment not safely typed
          updates[key] = localPart[key];
        }
      });
      if (Object.keys(updates).length > 0) {
        updatePartFields(index, updates);
      }
    } else {
      const keys = Object.keys(localPart) as (keyof PartConfig)[];
      keys.forEach((key) => {
        if (localPart[key] !== part[key]) {
          updatePart(index, key, localPart[key]);
        }
      });
    }
    onClose();
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setLocalPart((prev) => ({
        ...prev,
        fileObject: acceptedFiles[0],
        fileName: acceptedFiles[0].name,
      }));
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "model/stl": [".stl"],
      "model/step": [".step", ".stp"],
      "application/octet-stream": [".stl", ".step", ".stp"],
    },
    multiple: false,
  });

  console.log(localPart, isCNCProcess(localPart.process));

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 flex flex-col bg-white overflow-hidden shadow-2xl rounded-xl">
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Visualizer (40%) */}
          <div className="w-[40%] bg-gray-50/50 border-r p-2 border-gray-100 flex flex-col group">
            <div className="flex-1 p-4 overflow-auto">
              <CadViewer
                file={localPart.fileObject || localPart.filePath}
                className="w-full rounded-2xl"
                showControls={false}
                zoom={0.8}
                selectedHighlight={selectedHighlight?.selectionHint}
              />
            </div>

            {/* Overlay Dropzone */}
            <div
              {...getRootProps()}
              className="border h-[86px] border-dashed border-slate-200 rounded-lg p-8 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer text-center group flex flex-col items-center justify-center gap-3"
            >
              <input {...getInputProps()} />
              <div className="p-2 bg-white rounded-full border border-slate-200 shadow-sm group-hover:border-blue-300">
                <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
              </div>
              <p className="text-xs font-medium text-slate-600 group-hover:text-blue-700 transition-colors">
                Revise CAD Model <br />
                <span className="text-slate-400 font-normal">
                  (STL, STEP, STP, IGS, OBJ and More - Single file supported)
                </span>
              </p>
            </div>
            {activeTab === "config" && (
              <div
                key={`pricing-table-${activeTab}`}
                className="border hidden md:block col-span-2 mt-2 border-gray-200 rounded-xl overflow-hidden shadow-sm"
              >
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Qty</th>
                      <th className="px-4 py-3 font-semibold">Unit Price</th>
                      <th className="px-4 py-3 font-semibold">Subtotal</th>
                      <th className="px-4 py-3 font-semibold text-green-600">
                        You Save
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {[1, 5, 10, 25, 50].map((qty) => {
                      const total = calculatePrice(
                        { ...localPart, quantity: qty },
                        localPart.leadTimeType,
                      );
                      const unit = total / qty;
                      const baseTotal = calculatePrice(
                        { ...localPart, quantity: 1 },
                        localPart.leadTimeType,
                      );
                      const baseUnit = baseTotal / 1;
                      const savings = baseUnit * qty - total;
                      const isCurrent = localPart.quantity === qty;

                      return (
                        <tr
                          key={qty}
                          className={`
                                      transition-colors cursor-pointer 
                                      ${isCurrent ? "bg-green-50 ring-1 ring-inset ring-green-500/20" : "hover:bg-gray-50"}
                                    `}
                          onClick={() => updateLocalPart("quantity", qty)}
                        >
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {qty}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatCurrency(unit)}
                          </td>
                          <td className="px-4 py-3 text-gray-900 font-semibold">
                            {formatCurrency(total)}
                          </td>
                          <td className="px-4 py-3 text-green-600 font-medium">
                            {savings > 0.01 ? formatCurrency(savings) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Panel: Configuration (60%) */}
          <div className="flex-1 flex flex-col bg-white">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col h-full"
            >
              <div className="px-8 pt-6 border-b border-gray-100">
                <TabsList className="bg-transparent p-0 gap-6 h-auto">
                  <TabsTrigger
                    value="config"
                    className="
                      px-0 py-2 rounded-none border-b-2 border-transparent 
                      data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 
                      data-[state=active]:bg-transparent data-[state=active]:shadow-none
                      text-gray-500 hover:text-gray-800 transition-all font-medium text-sm
                    "
                  >
                    Specifications
                  </TabsTrigger>
                  <TabsTrigger
                    value="analysis"
                    className="
                      px-0 py-2 rounded-none border-b-2 border-transparent 
                      data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 
                      data-[state=active]:bg-transparent data-[state=active]:shadow-none
                      text-gray-500 hover:text-gray-800 transition-all font-medium text-sm
                    "
                  >
                    DFM Analysis
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Specifications Tab */}
              <TabsContent
                value="config"
                className="flex-1 overflow-y-auto outline-none"
              >
                <div className="px-8 py-8 max-w-4xl">
                  {/* Quantity & Pricing with Smart Breakpoints */}
                  <div className="space-y-10 mb-10">
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Quantity Breakdown
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          Adjust quantity and view volume discounts.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {/* Quantity row */}
                        <div className="flex items-center gap-3">
                          <label className="w-20 text-sm font-medium text-gray-700">
                            Quantity
                          </label>

                          <Input
                            type="number"
                            min={1}
                            value={localPart.quantity}
                            onChange={(e) =>
                              updateLocalPart(
                                "quantity",
                                Math.max(1, parseInt(e.target.value) || 1),
                              )
                            }
                            className="w-28 h-10 border-gray-200 bg-white rounded-lg shadow-sm text-sm"
                          />
                        </div>

                        {/* Savings row */}
                        {localPart.quantity > 1 && (
                          <div className="pl-20">
                            <p className="text-sm font-medium text-green-600">
                              You save{" "}
                              {formatCurrency(
                                calculatePrice(
                                  { ...localPart, quantity: 1 },
                                  localPart.leadTimeType,
                                ) *
                                  localPart.quantity -
                                  calculatePrice(
                                    localPart,
                                    localPart.leadTimeType,
                                  ),
                              )}
                            </p>
                          </div>
                        )}

                        {/* Smart Quantity Breakpoints */}
                        {/* {(() => {
                          try {
                            const basePrice =
                              localPart.pricing?.subtotal || 100;
                            const setupCost =
                              localPart.pricing?.setupCost || 75;
                            const materialCostPerUnit =
                              (localPart.pricing?.materialCost || 20) /
                              (localPart.quantity || 1);

                            const quantityAnalysis = analyzeQuantityBreakpoints(
                              basePrice,
                              setupCost,
                              materialCostPerUnit,
                              localPart.quantity || 1,
                            );

                            const bestValue =
                              quantityAnalysis.breakpoints.reduce(
                                (best, curr) =>
                                  curr.savingsPercent > best.savingsPercent
                                    ? curr
                                    : best,
                              );

                            if (quantityAnalysis.breakpoints.length > 0) {
                              return (
                                <div className="pl-20 mt-4">
                                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs font-bold text-blue-700">
                                        BEST VALUE:
                                      </span>
                                      <span className="text-xs text-blue-600">
                                        Order {bestValue.quantity} units
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-sm font-bold text-blue-900">
                                        ${bestValue.unitPrice.toFixed(2)}/unit
                                      </div>
                                      <div className="text-xs text-blue-600">
                                        Save{" "}
                                        {bestValue.savingsPercent.toFixed(0)}%
                                        vs single unit
                                      </div>
                                      <button
                                        onClick={() =>
                                          updateLocalPart(
                                            "quantity",
                                            bestValue.quantity,
                                          )
                                        }
                                        className="ml-auto px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-blue-700 transition-colors"
                                      >
                                        Apply
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          } catch (error) {
                            console.error(
                              "Error rendering quantity analysis:",
                              error,
                            );
                            return null;
                          }
                        })()} */}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gray-100 w-full mb-10" />

                  {/* General Config Section */}
                  <div className="space-y-10">
                    {/* Material - Categorized Dropdown */}
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Material
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          {isSheetMetalProcess(localPart.process)
                            ? "Select sheet metal material for fabrication."
                            : "Select the specific material grade for CNC machining."}
                        </p>
                      </div>
                      <Select
                        value={localPart.material}
                        onValueChange={(v) => updateLocalPart("material", v)}
                      >
                        <SelectTrigger className="h-12 border-gray-200 bg-white hover:border-gray-300 transition-colors rounded-xl shadow-sm text-base">
                          <SelectValue placeholder="Select Material" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[400px]">
                          {isSheetMetalProcess(localPart.process) ? (
                            // Sheet Metal Materials - Categorized (filter out manual review materials)
                            <>
                              {Object.entries(SHEET_METAL_MATERIALS)
                                .filter(([category, materials]) => 
                                  // Only show categories that have at least one non-manual material
                                  materials.some((m: any) => !m.requiresManualQuote)
                                )
                                .map(([category, materials]) => (
                                  <SelectGroup key={category}>
                                    <SelectLabel className="text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 px-2 py-1.5">
                                      {category.replace(/-/g, " ")}
                                    </SelectLabel>
                                    {materials
                                      .filter((m: any) => !m.requiresManualQuote)
                                      .map((m: any) => (
                                        <SelectItem key={m.code || m.value} value={m.code || m.value}>
                                          {m.name || m.label}
                                        </SelectItem>
                                      ))}
                                  </SelectGroup>
                                ))}
                            </>
                          ) : (
                            // CNC Materials - Categorized
                            <>
                              {Object.entries(CNC_MATERIALS).map(
                                ([category, materials]) => (
                                  <SelectGroup key={category}>
                                    <SelectLabel className="text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 px-2 py-1.5">
                                      {category.charAt(0).toUpperCase() +
                                        category.slice(1)}
                                    </SelectLabel>
                                    {materials.map((m) => (
                                      <SelectItem key={m.value} value={m.value}>
                                        {m.label}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ),
                              )}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Surface Finish - Process Aware with AI Recommendations */}
                    {(() => {
                      try {
                        const finishRecs = recommendFinish(
                          localPart.material ||
                            (isSheetMetalProcess(localPart.process)
                              ? "sm-aluminum-5052"
                              : "AL5052-1.5"),
                          "general",
                        );

                        return (
                          <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                            <div>
                              <Label className="text-base font-semibold text-gray-900">
                                Surface Finish
                              </Label>
                              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                                {isSheetMetalProcess(localPart.process)
                                  ? "Select post-fabrication finish or coating."
                                  : "Choose the post-machining surface treatment."}
                              </p>
                              {finishRecs.length > 0 && (
                                <div className="mt-2 text-xs bg-green-50 border border-green-200 rounded-lg p-2">
                                  <span className="font-semibold text-green-700">
                                    Top Pick:
                                  </span>
                                  <span className="text-green-600">
                                    {" "}
                                    {finishRecs[0].reason}
                                  </span>
                                </div>
                              )}
                            </div>
                            <Select
                              value={localPart.finish}
                              onValueChange={(v) =>
                                updateLocalPart("finish", v)
                              }
                            >
                              <SelectTrigger className="h-12 border-gray-200 bg-white hover:border-gray-300 transition-colors rounded-xl shadow-sm text-base">
                                <SelectValue placeholder="Select Finish" />
                              </SelectTrigger>
                              <SelectContent>
                                {(isSheetMetalProcess(localPart.process)
                                  ? Object.entries(SHEET_METAL_FINISHES).map(
                                      ([value, f]) => ({
                                        value,
                                        label: f.name,
                                      }),
                                    )
                                  : (CNC_FINISHES as any as {
                                      value: string;
                                      label: string;
                                    }[])
                                ).map((f) => {
                                  const isRecommended = finishRecs.some(
                                    (rec) => rec.finish === f.value,
                                  );
                                  return (
                                    <SelectItem key={f.value} value={f.value}>
                                      <div className="flex items-center gap-2">
                                        <span>{f.label}</span>
                                        {isRecommended && (
                                          <span className="px-1.5 py-0.5 bg-green-500 text-white text-xs font-bold rounded">
                                            AI ✓
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      } catch (error) {
                        console.error(
                          "Error rendering finish recommendations:",
                          error,
                        );
                        return (
                          <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                            <div>
                              <Label className="text-base font-semibold text-gray-900">
                                Surface Finish
                              </Label>
                            </div>
                            <Select
                              value={localPart.finish}
                              onValueChange={(v) =>
                                updateLocalPart("finish", v)
                              }
                            >
                              <SelectTrigger className="h-12 border-gray-200 bg-white hover:border-gray-300 transition-colors rounded-xl shadow-sm text-base">
                                <SelectValue placeholder="Select Finish" />
                              </SelectTrigger>
                              <SelectContent>
                                {(isSheetMetalProcess(localPart.process)
                                  ? Object.entries(SHEET_METAL_FINISHES).map(
                                      ([value, f]) => ({
                                        value,
                                        label: f.name,
                                      }),
                                    )
                                  : (CNC_FINISHES as any as {
                                      value: string;
                                      label: string;
                                    }[])
                                ).map((f) => (
                                  <SelectItem key={f.value} value={f.value}>
                                    <span>{f.label}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      }
                    })()}

                    <div className="h-px bg-gray-100 w-full" />

                    {/* CNC ONLY: Threads & Inserts - Auto-calculated info display */}
                    {isCNCProcess(localPart.process) && (
                      <>
                        <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                          <div>
                            <Label className="text-base font-semibold text-gray-900">
                              Threads & Inserts
                            </Label>
                            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                              Auto-detected from CAD geometry. Included in
                              pricing.
                            </p>
                          </div>
                          <div className="h-12 border border-gray-200 bg-gray-50 rounded-xl flex items-center px-4">
                            <span className="text-sm text-gray-600">
                              {localPart.geometry?.holes &&
                              localPart.geometry?.holes?.length > 0
                                ? `${localPart.geometry.holes.length} holes detected (threads auto-calculated)`
                                : "No threaded holes detected"}
                            </span>
                          </div>
                        </div>
                        <div className="h-px bg-gray-100 w-full" />
                      </>
                    )}

                    {/* CNC ONLY: Tolerances with AI Recommendation */}
                    {isCNCProcess(localPart.process) &&
                      (() => {
                        try {
                          const geometry =
                            localPart.geometry ||
                            ({
                              volume: 1000,
                              surfaceArea: 5000,
                              complexity: "moderate",
                              advancedFeatures: {},
                            } as any);
                          const recommendedTolerance =
                            recommendTolerance(geometry);

                          return (
                            <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                              <div>
                                <Label className="text-base font-semibold text-gray-900">
                                  Tolerance Standard
                                </Label>
                                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                                  Define the required dimensional accuracy for
                                  CNC machining.
                                </p>
                                {recommendedTolerance.tolerance !==
                                  "standard" && (
                                  <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded-lg p-2">
                                    <span className="font-semibold text-blue-700">
                                      AI Suggestion:
                                    </span>
                                    <span className="text-blue-600">
                                      {" "}
                                      {recommendedTolerance.reason}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="grid lg:grid-cols-3 gap-3">
                                {CNC_TOLERANCES.map((t) => {
                                  const isRecommended =
                                    t.value ===
                                    (recommendedTolerance?.tolerance ?? "");
                                  return (
                                    <div
                                      key={t.value}
                                      onClick={() =>
                                        updateLocalPart("tolerance", t.value)
                                      }
                                      className={`
                                    cursor-pointer rounded-xl p-4 border transition-all text-center relative
                                    ${
                                      localPart.tolerance === t.value
                                        ? "border-blue-600 bg-blue-600 text-white shadow-lg"
                                        : isRecommended
                                          ? "border-green-400 bg-green-50 text-green-700 hover:bg-green-100 ring-2 ring-green-200"
                                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                                    }
                                  `}
                                    >
                                      <span className="font-semibold text-sm">
                                        {t.label}
                                      </span>
                                      {isRecommended &&
                                        localPart.tolerance !== t.value && (
                                          <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg">
                                            AI ✓
                                          </span>
                                        )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        } catch (error) {
                          console.error(
                            "Error rendering tolerance recommendations:",
                            error,
                          );
                          return null;
                        }
                      })()}

                    {/* SHEET METAL ONLY: Thickness */}
                    {isSheetMetalProcess(localPart.process) && (
                      <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                        <div>
                          <Label className="text-base font-semibold text-gray-900">
                            Material Thickness
                          </Label>
                          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                            Select the sheet metal thickness for fabrication.
                          </p>
                        </div>
                        <Select
                          value={localPart.thickness || getDefaultThickness()}
                          onValueChange={(v) => updateLocalPart("thickness", v)}
                        >
                          <SelectTrigger className="h-12 border-gray-200 bg-white hover:border-gray-300 transition-colors rounded-xl shadow-sm text-base">
                            <SelectValue placeholder="Select Thickness" />
                          </SelectTrigger>
                          <SelectContent>
                            {SHEET_METAL_THICKNESSES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Inspection */}
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Inspection Report
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          Select the level of quality control and reporting
                          needed.
                        </p>
                      </div>
                      <Select
                        value={localPart.inspection}
                        onValueChange={(v) => updateLocalPart("inspection", v)}
                      >
                        <SelectTrigger className="h-12 border-gray-200 bg-white hover:border-gray-300 transition-colors rounded-xl shadow-sm text-base">
                          <SelectValue placeholder="Standard" />
                        </SelectTrigger>
                        <SelectContent>
                          {INSPECTIONS_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Notes */}
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Engineering Notes
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          Add specific instructions, critical dimensions, or
                          request technical review.
                        </p>
                      </div>
                      <textarea
                        className="
                          w-full min-h-[160px] p-4 text-sm rounded-xl border border-gray-200 
                          bg-white focus:border-black focus:ring-1 focus:ring-black outline-none 
                          resize-none placeholder:text-gray-400 shadow-sm transition-all
                        "
                        value={localPart.notes}
                        onChange={(e) =>
                          updateLocalPart("notes", e.target.value)
                        }
                        placeholder="e.g. Critical dimension at X axis, please mask threads before coating..."
                      />
                    </div>

                    {/* Certification */}
                    <div className="grid lg:grid-cols-[260px_1fr] gap-10 items-start">
                      {/* Left description */}
                      <div className="space-y-2">
                        <Label className="text-base font-semibold text-gray-900">
                          Certification
                        </Label>
                        <p className="text-sm text-gray-500 leading-relaxed max-w-[220px]">
                          Select the certifications required for this part.
                        </p>
                      </div>

                      {/* Right options */}
                      <div className="grid lg:grid-cols-2 gap-4">
                        {CERTIFICATES_LIST.map((c) => {
                          const isChecked = localPart?.certificates?.includes(
                            c.value,
                          );

                          return (
                            <div
                              key={c.value}
                              onClick={() =>
                                updateLocalPart(
                                  "certificates",
                                  isChecked
                                    ? localPart?.certificates?.filter(
                                        (v) => v !== c.value,
                                      )
                                    : [
                                        ...(localPart?.certificates || []),
                                        c.value,
                                      ],
                                )
                              }
                              className={`
                                group flex items-start gap-3 rounded-xl border p-4 text-left transition-all
                                focus:outline-none focus:ring-2 focus:ring-blue-500/30
                                ${
                                  isChecked
                                    ? "border-blue-600 bg-blue-50"
                                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                                } 
                              `}
                            >
                              <Checkbox
                                checked={isChecked}
                                className={`
                                mt-0.5
                                ${
                                  isChecked
                                    ? "border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                                    : "border-gray-300"
                                }
                              `}
                              />

                              <div className="space-y-0.5">
                                <span
                                  className={`
                                    text-sm font-semibold
                                    ${isChecked ? "text-blue-700" : "text-gray-800"}
                                  `}
                                >
                                  {c.label}
                                </span>
                                {c.description && (
                                  <p className="text-xs text-gray-500 leading-snug">
                                    {c.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />
                  </div>
                </div>
              </TabsContent>

              {/* Analysis Tab */}
              <TabsContent
                value="analysis"
                className="flex-1 overflow-hidden outline-none bg-gray-50/50 h-full"
              >
                <div className="h-full w-full">
                  <DFMAnalysis
                    part={localPart}
                    selectedHighlight={selectedHighlight?.checkId || null}
                    onHighlightChange={(checkId, selectionHint) => {
                      if (checkId) {
                        setSelectedHighlight({ checkId, selectionHint });
                      } else {
                        setSelectedHighlight(null);
                      }
                    }}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Clean Header */}
        <div className="flex items-center justify-between px-8 py-6 border-t border-gray-100 bg-white z-20">
          <div>
            <DialogTitle className="text-xl font-bold text-gray-900">
              {localPart.fileName}
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              Configure part specifications and requirements
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm text-gray-500">Current Price</span>
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(
                  calculatePrice(localPart, localPart.leadTimeType),
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 text-white hover:bg-gray-800 rounded-lg px-6"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
