"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Package,
  DollarSign,
  ArrowRight,
  Zap,
  TrendingUp,
  Loader2,
  Upload,
  Clock,
  CheckCircle,
} from "lucide-react";
import {
  getQuote,
  getQuoteConfig,
  saveQuoteConfig,
} from "../../../lib/database";
import { GeometryData, analyzeCADFile } from "../../../lib/cad-analysis";
import {
  calculatePricing,
  getMaterial,
  getFinish,
  PROCESSES,
  MATERIALS,
  FINISHES,
  PricingBreakdown,
} from "../../../lib/pricing-engine";
import { getItem } from "@/lib/item-storage";
import { PartCardItem } from "../components/part-card-item";
import { useDropzone } from "react-dropzone";
import { LEAD_TIME_SHORT } from "@/lib/utils";
import { notify } from "@/lib/toast";

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

// --- Constants (Moved Outside) ---
const MATERIALS_LIST = Object.entries(MATERIALS).map(([key, mat]) => ({
  value: key,
  label: mat.name,
  multiplier: mat.costPerKg / 8.5,
  icon: key.includes("aluminum")
    ? "🔷"
    : key.includes("stainless")
      ? "⚙️"
      : key.includes("titanium")
        ? "🔵"
        : key.includes("plastic")
          ? "🟢"
          : "",
}));

const TOLERANCES_LIST = [
  { value: "standard", label: 'Standard (±0.005")', multiplier: 1.0 },
  { value: "precision", label: 'Precision (±0.002")', multiplier: 1.15 },
  { value: "tight", label: 'Tight (±0.001")', multiplier: 1.3 },
];

const FINISHES_LIST = Object.entries(FINISHES).map(([key, fin]) => ({
  value: key,
  label: fin.name,
  cost: fin.baseCost,
}));

const THREAD_OPTIONS = [
  { value: "none", label: "No Threads" },
  { value: "tapped", label: "Tapped Holes" },
  { value: "threaded-studs", label: "Threaded Studs" },
  { value: "helicoils", label: "Helicoil Inserts" },
];

const INSPECTION_OPTIONS = [
  { value: "standard", label: "Standard Inspection (Included)" },
  { value: "first-article", label: "First Article Inspection (+$75)" },
  { value: "full-cmm", label: "Full CMM Report (+$150)" },
  { value: "material-cert", label: "Material Certification (+$25)" },
];

function calcLeadTime(
  leadTimeType: "economy" | "standard" | "expedited",
  baseLeadTime: number,
) {
  return (
    baseLeadTime *
    (leadTimeType === "expedited" ? 1 : leadTimeType === "standard" ? 3 : 2.1)
  );
}

export default function QuoteConfigPage() {
  const router = useRouter();
  const paramsHook = useParams();
  const quoteId = paramsHook?.id as string;

  const [email, setEmail] = useState("");
  const [parts, setParts] = useState<PartConfig[]>([]);
  // currentPartIndex removed as we list all parts
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fileUrls, setFileUrls] = useState<Map<string, string>>(new Map());

  // Handle adding more files
  // const handleAddMoreFiles = async (
  //   event: React.ChangeEvent<HTMLInputElement>,
  // ) => {
  //   const newFiles = event.target.files;
  //   if (!newFiles || newFiles.length === 0) return;

  //   const filesArray = Array.from(newFiles);
  //   const newParts: PartConfig[] = [];

  //   for (const file of filesArray) {
  //     // Analyze CAD geometry (same as instant-quote page)
  //     console.log(`Analyzing CAD file: ${file.name}`);
  //     const geometry = await analyzeCADFile(file);
  //     console.log(`Geometry analysis complete:`, geometry);

  //     const newPart: PartConfig = {
  //       id: `part-${parts.length + newParts.length + 1}`,
  //       fileName: file.name,
  //       filePath: `temp/${file.name}`,
  //       fileObject: file,
  //       material: "aluminum-6061",
  //       quantity: 1,
  //       tolerance: "standard",
  //       finish: "as-machined",
  //       threads: "none",
  //       inspection: "standard",
  //       notes: "",
  //       leadTimeType: "standard",
  //       geometry, // Add the analyzed geometry
  //       pricing: undefined,
  //       file2d: undefined,
  //     };
  //     newParts.push(newPart);
  //   }

  //   setParts((prev) => [...prev, ...newParts]);
  //   // Clear the input
  //   event.target.value = "";
  // };

  // Dropzone callback for drag and drop
  const onDropFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const newParts: PartConfig[] = [];

      for (const file of acceptedFiles) {
        console.log(`Analyzing CAD file: ${file.name}`);
        const geometry = await analyzeCADFile(file);
        console.log(`Geometry analysis complete:`, geometry);

        const newPart: PartConfig = {
          id: `part-${parts.length + newParts.length + 1}`,
          fileName: file.name,
          filePath: `temp/${file.name}`,
          fileObject: file,
          material: "aluminum-6061",
          quantity: 1,
          tolerance: "standard",
          finish: "as-machined",
          threads: "none",
          inspection: "standard",
          notes: "",
          leadTimeType: "standard",
          geometry,
          pricing: undefined,
          file2d: undefined,
        };
        newParts.push(newPart);
      }

      setParts((prev) => [...prev, ...newParts]);
    },
    [parts.length],
  );

  // Setup dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropFiles,
    accept: {
      "model/stl": [".stl"],
      "model/step": [".step", ".stp"],
      "application/octet-stream": [".stl", ".step", ".stp"],
      "application/sla": [".stl"],
      "application/vnd.ms-pki.stl": [".stl"],
      "application/iges": [".iges", ".igs"],
      "image/vnd.dxf": [".dxf"],
      "image/vnd.dwg": [".dwg"],
      "model/x.stl-binary": [".stl"],
      "application/x-navistyle": [".x_t", ".x_b"],
      "model/obj": [".obj"],
    },
    multiple: true,
  });

  // Handle deleting a part
  const handleDeletePart = (indexToDelete: number) => {
    if (parts.length === 1) {
      notify.error(
        "Cannot delete the last part. At least one part is required.",
      );
      return;
    }

    setParts((prev) => prev.filter((_, index) => index !== indexToDelete));
  };

  useEffect(() => {
    async function loadQuote() {
      if (!quoteId) return;

      try {
        setLoading(true);

        // Check if this is a temporary quote ID (starts with 'temp-')
        const isTempQuote = quoteId.startsWith("temp-");

        if (isTempQuote) {
          // Load from IndexedDB (item-storage)
          // const filesDataStr = sessionStorage.getItem(`quote-${quoteId}-files`);
          // const emailStr = sessionStorage.getItem(`quote-${quoteId}-email`);
          const [filesDataStr, emailStr] = await Promise.all([
            getItem<string>(`quote-${quoteId}-files`),
            getItem<string>(`quote-${quoteId}-email`),
          ]);

          if (!filesDataStr) {
            console.error("Storage data not found for quote:", quoteId);
            notify.error(
              "Quote session expired. Please upload your files again.",
            );
            router.push("/instant-quote");
            return;
          }

          const filesData = JSON.parse(filesDataStr);
          setEmail(emailStr || `guest-${Date.now()}@temp.quote`);

          // Initialize parts from storage
          const initialParts: PartConfig[] = await Promise.all(
            filesData.map(async (file: any, index: number) => {
              // Retrieve file data from IndexedDB
              const fileObject = await getItem<File>(
                `quote-${quoteId}-file-${index}`,
              );

              // No need to reconstruct from base64, IndexedDB stores File objects directly
              return {
                id: `part-${index + 1}`,
                fileName: file.name,
                filePath: file.path || `temp/${file.name}`,
                fileObject: fileObject || undefined,
                material: "aluminum-6061",
                quantity: 1,
                tolerance: "standard",
                finish: "as-machined",
                threads: "none",
                inspection: "standard",
                notes: "",
                leadTimeType: "standard",
                geometry: file.geometry,
                pricing: undefined,
                file2d: file.file2d,
              };
            }),
          );

          setParts(initialParts);
        } else {
          // Load quote from database (original flow)
          const quote = await getQuote(quoteId);
          if (!quote) {
            console.error("Quote not found in database:", quoteId);
            alert("Quote not found");
            router.push("/instant-quote");
            return;
          }

          setEmail(quote.email);

          // Check if configuration already exists
          try {
            const existingConfig = await getQuoteConfig(quoteId);
            if (existingConfig) {
              setParts(existingConfig.parts);
            } else {
              throw new Error("No config found");
            }
          } catch (error) {
            // Initialize new configuration
            const filesDataStr = await getItem<string>(
              `quote-${quoteId}-files`,
            );
            const filesData = filesDataStr ? JSON.parse(filesDataStr) : [];

            // Initialize parts from uploaded files with real geometry data
            const initialParts: PartConfig[] = await Promise.all(
              quote.files.map(async (file: any, index: number) => {
                // Retrieve file data from storage if available
                const fileObject = await getItem<File>(
                  `quote-${quoteId}-file-${index}`,
                );

                return {
                  id: `part-${index + 1}`,
                  fileName: file.name,
                  filePath: file.path,
                  fileObject: fileObject || undefined,
                  material: "aluminum-6061",
                  quantity: 1,
                  tolerance: "standard",
                  finish: "as-machined",
                  threads: "none",
                  inspection: "standard",
                  notes: "",
                  leadTimeType: "standard",
                  geometry: file.geometry,
                  pricing: file.pricing,
                };
              }),
            );

            setParts(initialParts);
          }
        }
      } catch (error) {
        console.error("Error loading quote:", error);
        alert("Failed to load quote. Please try again.");
        router.push("/instant-quote");
      } finally {
        setLoading(false);
      }
    }

    loadQuote();
  }, [quoteId, router]);

  // Lead Time & Pricing Calculations
  const calculateLeadTime = (part: PartConfig) => {
    if (!part.pricing) return 7;
    return part.pricing.leadTimeDays;
  };

  const calculatePrice = (
    part: PartConfig,
    tier: "economy" | "standard" | "expedited" = "economy",
  ): number => {
    // If no geometry data, return 0
    if (!part.geometry) {
      return 0;
    }

    // Calculate base pricing
    const material = getMaterial(part.material);
    if (!material) return 0;

    const process = PROCESSES["cnc-milling"];
    const finish = getFinish(part.finish);

    const pricing = calculatePricing({
      geometry: part.geometry,
      material,
      process,
      finish,
      quantity: part.quantity,
      tolerance: part.tolerance as "standard" | "precision" | "tight",
      leadTimeType: "standard", // Always use standard as base
    });

    // Apply tier multipliers
    const multipliers = {
      economy: 1.0,
      standard: 2.1,
      expedited: 3.5,
    };

    return pricing.totalPrice * multipliers[tier];
  };

  const updatePart = (index: number, field: keyof PartConfig, value: any) => {
    setParts((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;

        const updatedPart = { ...p, [field]: value };

        // Recalculate pricing if geometry exists
        if (updatedPart.geometry) {
          const material = getMaterial(updatedPart.material);
          if (material) {
            const process = PROCESSES["cnc-milling"];
            const finish = getFinish(updatedPart.finish);

            updatedPart.pricing = calculatePricing({
              geometry: updatedPart.geometry,
              material,
              process,
              finish,
              quantity: updatedPart.quantity,
              tolerance: updatedPart.tolerance as
                | "standard"
                | "precision"
                | "tight",
              leadTimeType: "standard", // Always use standard as base
            });
          }
        }

        return updatedPart;
      }),
    );
  };

  const standardPrice = parts.reduce(
    (sum, part) => sum + calculatePrice(part, part.leadTimeType || "standard"),
    0,
  );

  const baseLeadTime = Math.max(...parts.map((p) => calculateLeadTime(p)));

  const handleCheckout = async () => {
    try {
      setSaving(true);

      // Save configuration to database (use standardPrice as default total)
      await saveQuoteConfig(quoteId, parts, standardPrice, baseLeadTime);

      // Navigate to checkout
      router.push(`/checkout/${quoteId}`);
    } catch (error) {
      console.error("Error saving configuration:", error);
      alert("Failed to save configuration. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-blue-50 to-white flex items-center justify-center relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-200"></div>

        <div className="backdrop-blur-xl bg-white/30 border border-white/50 shadow-2xl p-8 rounded-3xl flex flex-col items-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="text-blue-900 font-medium">Loading your design...</p>
        </div>
      </div>
    );
  }

  if (parts.length === 0 && !loading) return <div>No parts loaded</div>;

  return (
    <div className="min-h-screen bg-[#F0F4F8] relative font-sans text-slate-900">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
        }
      `}</style>

      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-400/20 rounded-full blur-[100px] opacity-40"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-400/20 rounded-full blur-[100px] opacity-40"></div>
      </div>

      {/* HEADER - Updated to be flat and at top */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-white/60 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
              Configure Quote
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Customize your parts specifically for manufacturing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100 flex items-center">
              <Package className="w-3.5 h-3.5 mr-2" />
              Quote ID: {quoteId.substring(0, 8)}...
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row max-w-[1440px] mx-auto">
        {/* LEFT MAIN CONTENT (PARTS) */}
        <div className="flex-1 p-4 sm:p-6 lg:p-10 overflow-scroll invisible-scrollbar space-y-8 pb-32">
          {parts.map((part, index) => (
            <PartCardItem
              key={part.id}
              part={part}
              index={index}
              updatePart={updatePart}
              handleDeletePart={handleDeletePart}
              calculatePrice={calculatePrice}
              MATERIALS_LIST={MATERIALS_LIST}
              TOLERANCES_LIST={TOLERANCES_LIST}
              FINISHES_LIST={FINISHES_LIST}
              THREAD_OPTIONS={THREAD_OPTIONS}
            />
          ))}

          {/* Add Part Button */}
          <div className="pt-8 w-full">
            <div
              {...getRootProps()}
              className={`bg-gradient-to-br from-white to-slate-50/80 rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-300 cursor-pointer ${
                isDragActive
                  ? "border-blue-500 border-dashed bg-blue-50/50 shadow-lg scale-[1.01]"
                  : "border-slate-200 hover:border-blue-400 border-dashed hover:shadow-md"
              }`}
            >
              <input {...getInputProps()} />

              {/* Upload Area */}
              <div className="p-8 lg:p-12 bg-white/50 flex flex-col items-center justify-center gap-4 text-center border-b border-slate-200">
                <div
                  className={`p-4 bg-gradient-to-br rounded-2xl transition-all shadow-sm ${
                    isDragActive
                      ? "from-blue-200 to-blue-100 scale-110"
                      : "from-blue-50 to-slate-50"
                  }`}
                >
                  <Upload
                    className={`w-10 h-10 transition-colors ${
                      isDragActive ? "text-blue-700" : "text-blue-600"
                    }`}
                  />
                </div>
                <div>
                  <p
                    className={`font-bold text-xl mb-2 transition-colors ${
                      isDragActive ? "text-blue-700" : "text-slate-900"
                    }`}
                  >
                    {isDragActive ? "Drop your files here" : "Add Another Part"}
                  </p>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    {isDragActive
                      ? "Release to upload your CAD files"
                      : "Click to upload or drag and drop your CAD files here"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      isDragActive
                        ? "bg-blue-200 text-blue-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    STEP
                  </span>
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      isDragActive
                        ? "bg-blue-200 text-blue-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    STL
                  </span>
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      isDragActive
                        ? "bg-blue-200 text-blue-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    IGES
                  </span>
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      isDragActive
                        ? "bg-blue-200 text-blue-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    OBJ
                  </span>
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      isDragActive
                        ? "bg-blue-200 text-blue-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    and more
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR (FIXED) */}
        <div className="w-full lg:w-[400px] lg:flex-shrink-0 lg:border-r border-slate-200 lg:bg-white/40 z-30">
          <div className="lg:sticky lg:top-[85px] p-6 custom-scrollbar">
            <div className="backdrop-blur-xl border border-white/60 shadow-xl rounded-2xl p-6 flex flex-col gap-6">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">
                  Order Summary
                </h2>
              </div>

              {/* Mini Breakdown */}
              <div className="space-y-3 max-h-[calc(100vh-85px)]   overflow-y-auto custom-scrollbar pr-1">
                {parts.map((p, i) => {
                  const pPrice = calculatePrice(p, p.leadTimeType);
                  const calculatedLeadTime = calcLeadTime(
                    p.leadTimeType,
                    baseLeadTime,
                  );
                  return (
                    <div
                      key={p.id}
                      className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-800">
                            <span className="truncate max-w-[120px] inline-block">
                              {i + 1}. {p.fileName}
                            </span>
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          Qty: {p.quantity}
                        </span>
                        <span className="text-xs text-slate-500">
                          {LEAD_TIME_SHORT[p.leadTimeType]} (
                          {calculatedLeadTime.toFixed(2)} Business Days)
                        </span>
                      </div>
                      <span className="font-semibold mt-0.5 text-slate-700">
                        ${pPrice.toFixed(3)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-lg font-semibold text-slate-800">
                  Total:
                </span>
                <span className="text-lg font-semibold text-slate-800">
                  ${standardPrice.toFixed(3)}
                </span>
              </div>

              <Button
                size="lg"
                onClick={handleCheckout}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 rounded-xl h-14 text-lg font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  </>
                ) : (
                  <div className="flex items-center justify-center w-full">
                    Checkout
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
