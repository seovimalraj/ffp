"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GeometryData } from "@/lib/cad-analysis";
import { PricingBreakdown } from "@/lib/pricing-engine";
import {
  Package,
  CheckCircle,
  Clock,
  DollarSign,
  ArrowRight,
  Zap,
  TrendingUp,
  Loader2,
  Upload,
  Trash2,
  Settings,
  FileIcon,
  PencilIcon,
  Maximize2,
  Activity,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import CadViewer3D from "@/components/CadViewer3D";
import { ImageViewerModal } from "@/components/image-viewer-modal";

interface PartConfig {
  id: string;
  fileName: string;
  filePath: string;
  fileObject?: File;
  material: string;
  quantity: number;
  tolerance: string;
  finish: string;
  threads: string;
  inspection: string;
  notes: string;
  leadTimeType: "economy" | "standard" | "expedited";
  geometry?: GeometryData;
  pricing?: PricingBreakdown;
  file2d?: File;
  file2dPreview?: string;
}

type MaterialItem = {
  value: string;
  label: string;
  multiplier: number;
  icon: string;
};

type ToleranceItem = {
  value: string;
  label: string;
};

type FinishItem = {
  value: string;
  label: string;
  cost: number;
};

type InspectionItem = {
  value: string;
  label: string;
};

type ThreadItem = {
  value: string;
  label: string;
};

// --- Sub-Component: PartCardItem ---
export function PartCardItem({
  part,
  index,
  updatePart,
  handleDeletePart,
  calculatePrice,
  MATERIALS_LIST,
  TOLERANCES_LIST,
  FINISHES_LIST,
  THREAD_OPTIONS,
}: {
  part: PartConfig;
  index: number;
  updatePart: (index: number, field: keyof PartConfig, value: any) => void;
  handleDeletePart: (index: number) => void;
  calculatePrice: (
    part: PartConfig,
    tier?: "economy" | "standard" | "expedited",
  ) => number;
  MATERIALS_LIST: MaterialItem[];
  TOLERANCES_LIST: ToleranceItem[];
  FINISHES_LIST: FinishItem[];
  //   INSPECTIONS_LIST: InspectionItem[];
  THREAD_OPTIONS: ThreadItem[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const price = calculatePrice(part, "standard");

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        updatePart(index, "file2d", file);
        updatePart(index, "file2dPreview", URL.createObjectURL(file));
      }
    },
    [index, updatePart],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "model/stl": [".stl"],
      "model/step": [".step", ".stp"],
      "application/octet-stream": [".stl", ".step", ".stp"],
      "application/pdf": [".pdf"],
      "image/vnd.dxf": [".dxf"],
      "image/vnd.dwg": [".dwg"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/svg+xml": [".svg"],
      "image/webp": [".webp"],
    },
    multiple: false,
  });

  /* New Layout Design */
  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 bg-white group">
      <div className="flex flex-col md:flex-row">
        {/* LEFT SIDEBAR: Visuals, Pricing, Key Metrics */}
        <div className="w-full md:w-[340px] bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-100 p-6 flex flex-col gap-6 flex-shrink-0">
          {/* 3D Thumbnail */}
          <div className="aspect-square w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm relative hover:border-blue-400 transition-colors">
            <CadViewer3D
              fileName={part.fileName}
              file={part.fileObject}
              height="100%"
            />
            {/* Overlay Badges */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
              {part.geometry && (
                <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {(part.geometry.volume / 1000).toFixed(1)} cm³
                </span>
              )}
            </div>
          </div>

          {/* Pricing Card - "Price on the left is important" */}
          <div className="flex gap-3 flex-wrap">
            {["economy", "standard", "expedited"].map((leadTimeType) => {
              const leadTimePrice = calculatePrice(
                part,
                leadTimeType as "economy" | "standard" | "expedited",
              );
              const leadTimeLabel =
                leadTimeType === "economy"
                  ? "Economy"
                  : leadTimeType === "standard"
                    ? "Standard"
                    : "Expedited";

              const isSelected = part.leadTimeType === leadTimeType;

              return (
                <div
                  key={leadTimeType}
                  className={`flex-1 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                    isSelected
                      ? "border-blue-600 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-blue-400"
                  }`}
                  onClick={() =>
                    updatePart(
                      index,
                      "leadTimeType",
                      leadTimeType as "economy" | "standard" | "expedited",
                    )
                  }
                >
                  <div className="p-3 flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Clock
                        className={`w-3.5 h-3.5 ${isSelected ? "text-blue-600" : "text-slate-400"}`}
                      />
                      <span
                        className={`text-xs font-bold uppercase tracking-wide ${
                          isSelected ? "text-blue-700" : "text-slate-500"
                        }`}
                      >
                        {leadTimeLabel}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <span
                        className={`text-xl font-extrabold tracking-tight ${
                          isSelected ? "text-blue-700" : "text-slate-900"
                        }`}
                      >
                        ${(leadTimePrice / part.quantity).toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-medium ${
                          isSelected ? "text-blue-600" : "text-slate-400"
                        }`}
                      >
                        ea
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT MAIN CONTENT: Configuration & Details */}
        <div className="flex-1 p-6 lg:p-8 flex flex-col min-w-0">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex-shrink-0">
                  {index + 1}
                </span>
                <h3 className="text-xl font-bold text-slate-900 truncate">
                  {part.fileName}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-100 text-xs font-medium text-slate-600">
                  <Package className="w-3.5 h-3.5 text-slate-400" />
                  Custom Part
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-100 text-xs font-medium text-slate-600">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  CNC Machining
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-100 text-xs font-medium text-slate-600">
                  <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                  {part.geometry?.boundingBox.x.toFixed(2)} x{" "}
                  {part.geometry?.boundingBox.y.toFixed(2)} x{" "}
                  {part.geometry?.boundingBox.z.toFixed(2)} mm
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-100 text-xs font-medium text-slate-600">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  {part.geometry?.complexity}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:w-auto w-full sm:min-w-[240px]">
              {/* Quick Quantity Control */}
              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">
                  Quantity
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-md border-slate-200 hover:bg-slate-50"
                    onClick={() => {
                      const newQ = part.quantity - 1;
                      if (newQ >= 1) updatePart(index, "quantity", newQ);
                    }}
                  >
                    <span className="text-lg leading-none mb-0.5">-</span>
                  </Button>
                  <input
                    type="number"
                    value={part.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1) {
                        updatePart(index, "quantity", val);
                      }
                    }}
                    className="w-14 text-center font-bold text-slate-800 border border-slate-200 rounded-md h-8 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    min="1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-md border-slate-200 hover:bg-slate-50"
                    onClick={() =>
                      updatePart(index, "quantity", part.quantity + 1)
                    }
                  >
                    <span className="text-lg leading-none mb-0.5">+</span>
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex-1 ${
                    isEditing
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                      : "border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  {isEditing ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" /> Done
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4 mr-2" /> Configure
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeletePart(index)}
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-9 w-9"
                  title="Delete Part"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase">
                      Material
                    </Label>
                    <Select
                      value={part.material}
                      onValueChange={(v) => updatePart(index, "material", v)}
                    >
                      <SelectTrigger className="bg-white border-slate-200 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIALS_LIST.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.icon} {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase">
                      Finish
                    </Label>
                    <Select
                      value={part.finish}
                      onValueChange={(v) => updatePart(index, "finish", v)}
                    >
                      <SelectTrigger className="bg-white border-slate-200 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FINISHES_LIST.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label} {f.cost > 0 && `(+$${f.cost})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase">
                      Threads
                    </Label>
                    <Select
                      value={part.threads}
                      onValueChange={(v) => updatePart(index, "threads", v)}
                    >
                      <SelectTrigger className="bg-white border-slate-200 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {THREAD_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">
                      Tolerance
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {TOLERANCES_LIST.map((t) => (
                        <div
                          key={t.value}
                          className={`
                              cursor-pointer px-3 py-2 rounded-lg border text-sm font-medium transition-all
                              ${
                                part.tolerance === t.value
                                  ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                              }
                          `}
                          onClick={() =>
                            updatePart(index, "tolerance", t.value)
                          }
                        >
                          {t.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">
                      Notes
                    </Label>
                    <textarea
                      className="w-full min-h-[80px] p-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-y"
                      value={part.notes}
                      onChange={(e) =>
                        updatePart(index, "notes", e.target.value)
                      }
                      placeholder="Add special instructions..."
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 p-5 rounded-lg bg-gray-50 border border-gray-200">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-tight mb-1.5">
                      Material
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {
                        MATERIALS_LIST.find((m) => m.value === part.material)
                          ?.label
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-tight mb-1.5">
                      Quantity
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {part.quantity} pcs
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-tight mb-1.5">
                      Finish
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {
                        FINISHES_LIST.find((f) => f.value === part.finish)
                          ?.label
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-tight mb-1.5">
                      Tolerance
                    </p>
                    <p className="text-sm font-semibold text-gray-900 capitalize">
                      {part.tolerance}
                    </p>
                  </div>
                </div>

                {part.file2d ? (
                  <div
                    className="flex items-center gap-4 cursor-pointer group hover:bg-blue-50/50 p-3 rounded-lg transition-all border border-transparent hover:border-blue-200"
                    onClick={() => setIsViewerOpen(true)}
                  >
                    <div className="relative overflow-hidden rounded-md border border-slate-200 bg-white h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 flex items-center justify-center">
                      {part.file2dPreview ? (
                        <img
                          src={part.file2dPreview}
                          alt="Technical Drawing"
                          className="object-contain max-h-full max-w-full p-1"
                        />
                      ) : (
                        <FileIcon className="w-8 h-8 text-slate-300" />
                      )}
                      <div className="absolute inset-0 bg-blue-900/0 group-hover:bg-blue-900/10 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {part.file2d.name}
                      </h4>
                      <p className="text-xs text-slate-500 mb-1">
                        {(part.file2d.size / 1024).toFixed(0)} KB
                      </p>
                      <p className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                        <Maximize2 className="w-3 h-3" /> Click to preview
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        updatePart(index, "file2d", undefined);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className="border border-dashed border-slate-300 rounded-lg p-8 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer text-center group flex flex-col items-center justify-center gap-3"
                  >
                    <input {...getInputProps()} />
                    <div className="p-2 bg-white rounded-full border border-slate-200 shadow-sm group-hover:border-blue-300">
                      <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <p className="text-xs font-medium text-slate-600 group-hover:text-blue-700 transition-colors">
                      Upload 2D Drawing <br />
                      <span className="text-slate-400 font-normal">
                        (JPG, JPEG, WEBP, PNG and more)
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <ImageViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        imageSrc={part.file2dPreview || ""}
        altText={part.file2d ? part.file2d.name : "Technical Drawing"}
      />
    </Card>
  );
}
