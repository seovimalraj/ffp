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
  CheckSquare,
  Square,
  Trash2,
  ChevronRight,
  User,
  LogOut,
  Truck,
  Package2,
  LayoutDashboard,
  ChevronDown,
  Archive,
  ScrollText,
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
import { formatCurrencyFixed, LEAD_TIME_SHORT } from "@/lib/utils";
import { notify } from "@/lib/toast";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signOut, useSession } from "next-auth/react";
import UploadFileModal from "../components/upload-file-modal";
import { useFileUpload } from "@/lib/hooks/use-file-upload";

interface File2D {
  file: File;
  preview: string;
}

export interface PartConfig {
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
  files2d?: File2D[];
  certificates?: string[];
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
  return Math.round(
    baseLeadTime *
      (leadTimeType === "expedited"
        ? 1
        : leadTimeType === "standard"
          ? 2.1
          : 3),
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
  const [is3DFileUploading, setIs3DFileUploading] = useState(false);
  const [is2DFileUploading, setIs2DFileUploading] = useState(false);

  const [archivedParts, setArchivedParts] = useState<PartConfig[]>([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);

  const session = useSession();

  const { upload } = useFileUpload();

  // Dropzone callback for drag and drop
  const onDropFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const newParts: PartConfig[] = [];

      for (const file of acceptedFiles) {
        let uploadedPath = `temp/${file.name}`;
        try {
          const { url } = await upload(file);
          uploadedPath = url;
        } catch (error) {
          console.error("File upload failed:", error);
          notify.error(`Failed to upload ${file.name}`);
          // Optionally continue with local path or return
        }

        console.log(`Analyzing CAD file: ${file.name}`);
        const geometry = await analyzeCADFile(file);
        console.log(`Geometry analysis complete:`, geometry);

        const newPart: PartConfig = {
          id: `part-${parts.length + newParts.length + 1}`,
          fileName: file.name,
          filePath: uploadedPath,
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
          files2d: [],
          certificates: [],
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

  // Handle toggling part selection
  const togglePartSelection = (partId: string) => {
    setSelectedParts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(partId)) {
        newSet.delete(partId);
      } else {
        newSet.add(partId);
      }
      return newSet;
    });
  };

  // Handle select all/deselect all
  const toggleSelectAll = () => {
    if (selectedParts.size === parts.length) {
      setSelectedParts(new Set());
    } else {
      setSelectedParts(new Set(parts.map((p) => p.id)));
    }
  };

  // Handle archiving a single part
  const handleArchivePart = (partId: string) => {
    const partToArchive = parts.find((p) => p.id === partId);
    if (!partToArchive) return;

    if (parts.length === 1) {
      notify.error(
        "Cannot archive the last part. At least one part is required.",
      );
      return;
    }

    setParts((prev) => prev.filter((p) => p.id !== partId));
    setArchivedParts((prev) => [...prev, partToArchive]);
    notify.success("Part archived successfully");
  };

  // Handle bulk archive
  const handleBulkArchive = () => {
    if (selectedParts.size === 0) return;

    if (parts.length - selectedParts.size === 0) {
      notify.error("Cannot archive all parts. At least one part is required.");
      return;
    }

    const partsToArchive = parts.filter((p) => selectedParts.has(p.id));
    setParts((prev) => prev.filter((p) => !selectedParts.has(p.id)));
    setArchivedParts((prev) => [...prev, ...partsToArchive]);
    setSelectedParts(new Set());
    setIsSelectionMode(false);
    notify.success(`Archived ${partsToArchive.length} part(s)`);
  };

  // Handle unarchiving a part
  const handleUnarchivePart = (partId: string) => {
    const partToUnarchive = archivedParts.find((p) => p.id === partId);
    if (!partToUnarchive) return;

    setArchivedParts((prev) => prev.filter((p) => p.id !== partId));
    setParts((prev) => [...prev, partToUnarchive]);
    notify.success("Part restored successfully");
  };

  // Handle unarchiving all parts
  const handleUnarchiveAll = () => {
    if (archivedParts.length === 0) return;

    setParts((prev) => [...prev, ...archivedParts]);
    setArchivedParts([]);
    notify.success(`Restored ${archivedParts.length} part(s)`);
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedParts.size === 0) return;

    if (parts.length - selectedParts.size === 0) {
      notify.error("Cannot delete all parts. At least one part is required.");
      return;
    }

    setParts((prev) => prev.filter((p) => !selectedParts.has(p.id)));
    setSelectedParts(new Set());
    setIsSelectionMode(false);
    notify.success(`Deleted ${selectedParts.size} part(s)`);
  };

  // Exit selection mode when no parts are selected
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedParts(new Set());
  };

  // Removed strict authentication check to allow guest access for temp quotes

  useEffect(() => {
    async function loadQuote() {
      if (!quoteId) return;

      try {
        setLoading(true);

        // Check if this is a temporary quote ID (starts with 'temp-')
        const isTempQuote = quoteId.startsWith("FRI_");

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
                files2d: file.files2d || [],
                certificates: file.certificates || [],
              };
            }),
          );

          setParts(initialParts);
        } else {
          // Load quote from database (original flow)
          // If user is guest accessing a permanent quote, they might be blocked by the API, but we handle it here
          if (session.status === "unauthenticated") {
            // Optional: could redirect here if we strictly know it's a private DB quote
            // But for now let's let getQuote fail if it must
            router.push("/signin");
            return;
          }

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
                  certificates: file.certificates,
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
  }, [quoteId, router, session.status]);

  // Lead Time & Pricing Calculations
  const calculateLeadTime = (part: PartConfig) => {
    if (!part.pricing) return 7;
    return Math.round(part.pricing.leadTimeDays);
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

  if (session.status === "unauthenticated") {
    router.push("/signin");
    return null;
  }

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
          <div className="flex items-center gap-6">
            {/* Logo Section */}
            <div className="flex items-center h-16">
              <img
                src="https://frigate.ai/wp-content/uploads/2025/03/FastParts-logo-1024x351.png"
                className="aspect-video w-full h-full object-contain"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-between gap-x-1 text-sm text-gray-700">
              <span>Current Total: </span>
              <span className="font-semibold text-lg text-gray-900">
                {formatCurrencyFixed(standardPrice)}
              </span>
            </div>

            <Button
              onClick={() => setShowUploadModal(true)}
              className="bg-blue-600"
            >
              New Quote
            </Button>

            {session.status === "authenticated" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="font-medium text-sm transition-all duration-300 bg-slate-100"
                  >
                    <User className="w-4 h-4 mr-2" />
                    {session?.data?.user?.name}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session?.data?.user?.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session?.data?.user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="text-black cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="text-black cursor-pointer"
                  >
                    <Package2 className="w-4 h-4 mr-2" />
                    Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="text-red-600 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-4">
                <Link href="/login">
                  <Button
                    variant="ghost"
                    className="text-blue-600 hover:bg-blue-50"
                  >
                    Sign In
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Quote ID / Status - Refactored for better aesthetics and integration */}

      <div className="flex items-center justify-between flex-wrap px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-8 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-3 text-lg">
          <Link
            href="/portal/quotes"
            className="font-medium text-blue-700 hover:text-blue-800 transition-colors"
          >
            Quotes
          </Link>

          <ChevronRight className="w-5 h-5 text-slate-400" />

          <span className="font-bold text-slate-900 tracking-wide">
            {quoteId}
          </span>
        </div>

        {/* Total Parts Count - Inline */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded-lg">
            <Package className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">
              {parts.length}{" "}
              {parts.length === 1 ? "Part Uploaded" : "Parts Uploaded"}
            </span>
          </div>

          {archivedParts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 rounded-lg">
              <Archive className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">
                {archivedParts.length}{" "}
                {archivedParts.length === 1
                  ? "Part Archived"
                  : "Parts Archived"}
              </span>
            </div>
          )}
        </div>

        <Button
          className="bg-gray-300 text-black relative"
          onClick={() => setShowArchiveModal(true)}
        >
          <Archive className="size-4 text-black mr-2" />
          Archive
          {archivedParts.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {archivedParts.length}
            </span>
          )}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row max-w-[1440px] mx-auto">
        {/* LEFT MAIN CONTENT (PARTS) */}
        <div className="flex-1 p-4 sm:p-6 lg:p-10 overflow-scroll invisible-scrollbar space-y-8 pb-32">
          {parts.map((part, index) => (
            <PartCardItem
              key={index}
              part={part}
              index={index}
              updatePart={(index, field: keyof PartConfig, value) => {
                updatePart(index, field, value);
              }}
              handleDeletePart={handleDeletePart}
              handleArchivePart={handleArchivePart}
              calculatePrice={calculatePrice}
              MATERIALS_LIST={MATERIALS_LIST}
              TOLERANCES_LIST={TOLERANCES_LIST}
              FINISHES_LIST={FINISHES_LIST}
              THREAD_OPTIONS={THREAD_OPTIONS}
              INSPECTIONS_OPTIONS={INSPECTION_OPTIONS}
              isSelectionMode={isSelectionMode}
              isSelected={selectedParts.has(part.id)}
              onToggleSelection={() => togglePartSelection(part.id)}
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
                  {["STEP", "STL", "IGES", "OBJ", "and More"].map((fmt) => (
                    <span
                      key={fmt}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        isDragActive
                          ? "bg-blue-200 text-blue-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR (FIXED) */}
        <div className="w-full lg:w-[400px] lg:py-10 lg:flex-shrink-0 z-30">
          <div className="lg:sticky lg:top-[85px] custom-scrollbar">
            <div className="backdrop-blur-xl border bg-white border-white/60 shadow-xl rounded-2xl p-6 flex flex-col gap-6">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                  <ScrollText className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">
                  Order Summary
                </h2>
              </div>

              {/* Mini Breakdown */}
              <div className="space-y-3 max-h-[calc(100vh-85px)] overflow-y-auto custom-scrollbar pr-1">
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
                          Qty: {p.quantity} | {LEAD_TIME_SHORT[p.leadTimeType]}{" "}
                          ({calculatedLeadTime} Business Days)
                        </span>
                      </div>
                      <span className="font-semibold mt-0.5 text-slate-700">
                        {formatCurrencyFixed(pPrice)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Free Delivery Section */}
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/60 border border-green-200 flex items-center gap-3">
                <div className="p-2 bg-green-600 text-white rounded-lg">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-green-800 text-sm">
                    Free Delivery
                  </span>
                  <span className="text-xs text-green-700">
                    Available on all RFQ orders
                  </span>
                </div>
              </div>

              {/* Total Section */}
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrencyFixed(standardPrice)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">Shipping</span>
                  <span className="font-semibold text-green-600">Free</span>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-slate-900">
                      Total
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      {formatCurrencyFixed(standardPrice)}
                    </span>
                  </div>
                </div>
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

      {/* Footer Area - Minimal */}
      <footer className="border-t pb-10 border-slate-100 pt-8 mt-12 text-center text-slate-400 text-sm">
        <div className="flex justify-center gap-6 mb-4">
          <Link href="#" className="hover:text-blue-600 transition-colors">
            Privacy
          </Link>
          <Link href="#" className="hover:text-blue-600 transition-colors">
            Terms
          </Link>
          <Link href="#" className="hover:text-blue-600 transition-colors">
            Support
          </Link>
        </div>
        <p>© 2025 Frigate Engineering Services. Secure & Confidential.</p>
      </footer>

      <UploadFileModal
        open={showUploadModal}
        setOpen={setShowUploadModal}
        parts={parts}
        setParts={setParts}
      />

      {/* Archive Modal */}
      <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
        <DialogContent
          showClose={true}
          className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Archive className="w-6 h-6 text-slate-600" />
              Archived Parts
            </DialogTitle>
            <DialogDescription>
              View and restore archived parts. Archived parts are not included
              in your quote.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
            {archivedParts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Archive className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No Archived Parts
                </h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Parts you archive will appear here. You can restore them at
                  any time.
                </p>
              </div>
            ) : (
              <div className="space-y-4 w-full">
                {archivedParts.map((part, index) => (
                  <div
                    key={part.id}
                    className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-4">
                      {/* Part Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex-shrink-0">
                            {index + 1}
                          </span>
                          <h4 className="text-base font-bold text-slate-900 truncate">
                            {part.fileName}
                          </h4>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">
                              Material
                            </p>
                            <p className="text-sm font-medium text-slate-900">
                              {
                                MATERIALS_LIST.find(
                                  (m) => m.value === part.material,
                                )?.label
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">
                              Quantity
                            </p>
                            <p className="text-sm font-medium text-slate-900">
                              {part.quantity} pcs
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">
                              Finish
                            </p>
                            <p className="text-sm font-medium text-slate-900">
                              {
                                FINISHES_LIST.find(
                                  (f) => f.value === part.finish,
                                )?.label
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">
                              Lead Time
                            </p>
                            <p className="text-sm font-medium text-slate-900 capitalize">
                              {part.leadTimeType}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUnarchivePart(part.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-7">
              {archivedParts.length > 0 && (
                <Button
                  onClick={handleUnarchiveAll}
                  className="bg-blue-600 ml-auto w-full max-w-xs hover:bg-blue-700 text-white"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Restore All
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Action Bar for Selection Mode */}
      {selectedParts.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="backdrop-blur-xl bg-white border border-slate-200 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-sm font-bold text-blue-700">
                  {selectedParts.size}
                </span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">
                  {selectedParts.size} part{selectedParts.size !== 1 ? "s" : ""}{" "}
                  selected
                </p>
                <p className="text-xs text-slate-500">{parts.length} total</p>
              </div>
            </div>

            <div className="h-10 w-px bg-slate-200"></div>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              {selectedParts.size === parts.length ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Deselect All
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Select All
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkArchive}
              disabled={selectedParts.size === 0}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedParts.size === 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={exitSelectionMode}
              className="text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
