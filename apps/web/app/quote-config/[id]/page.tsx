"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tool-tip";
import {
  Package,
  ArrowRight,
  Loader2,
  Upload,
  CheckSquare,
  Square,
  Trash2,
  ChevronRight,
  User,
  LogOut,
  Package2,
  LayoutDashboard,
  Archive,
  ScrollText,
  Save,
  Plus,
  Truck,
  X,
  ChevronDown,
} from "lucide-react";
import { FloatingActions } from "@/components/ui/floating-actions";
import { analyzeCADFile } from "../../../lib/cad-analysis";
import {
  calculatePricing,
  getMaterial,
  getFinish,
  PROCESSES,
  MATERIALS,
  FINISHES,
  CNC_MATERIALS,
  SHEET_METAL_MATERIALS,
  getProcessDisplayName,
  isCNCProcess,
  isSheetMetalProcess,
  getMaterialByValue,
  getMaterialForProcess,
  getDefaultMaterialForProcess,
  getDefaultFinishForProcess,
  getDefaultToleranceForProcess,
  // getDefaultThickness,
} from "../../../lib/pricing-engine";
import { PartCardItem, PartCardSkeleton } from "../components/part-card-item";
import { useDropzone } from "react-dropzone";
import {
  formatCurrencyFixed,
  LEAD_TIME_SHORT,
  processParts,
  cn,
} from "@/lib/utils";
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
import { signOut, useSession } from "next-auth/react";
import UploadFileModal from "../components/upload-file-modal";
import { useFileUpload } from "@/lib/hooks/use-file-upload";
import { apiClient } from "@/lib/api";

import { PartConfig } from "@/types/part-config";
import Logo from "@/components/ui/logo";
import ArchiveModal from "../components/archive-modal";
import { SuggestionSidebar } from "../components/suggestion-sidebar";
import ManualQuoteModal from "../../quote-config/components/manual-quote-modal";
import { ManualExceededModal } from "../components/manual-exceeded-modal";
import { ManualQuoteWarningModal } from "../components/manual-quote-warning-modal";
import { SuggestionProvider } from "@/components/store/suggestion-store";
import Footer from "@/components/ui/footer";
import TechnicalSupportModal from "../components/technical-support-modal";
import { CAD_MIME_MAP, RFQPartStatus } from "@cnc-quote/shared";

/**
 * Normalize process string from database/API to clean format.
 * Handles: double-encoded JSON strings, escaped quotes, extra whitespace
 * Examples: "\"sheet-metal\"" -> "sheet-metal", "sheet_metal" -> "sheet-metal"
 */
function normalizeProcessString(rawProcess: string | undefined | null): string {
  if (!rawProcess || typeof rawProcess !== "string") {
    return "cnc-milling";
  }

  let process = rawProcess;

  // Handle double-encoded JSON strings (e.g., "\"sheet-metal\"")
  if (process.startsWith('"') && process.endsWith('"')) {
    try {
      process = JSON.parse(process);
    } catch {
      // If parsing fails, strip quotes manually
      process = process.slice(1, -1);
    }
  }

  // Remove any remaining escaped quotes, backslashes, and whitespace
  process = process
    .replace(/\\"/g, "") // Remove \" sequences
    .replace(/"/g, "") // Remove any remaining quotes
    .replace(/\\/g, "") // Remove backslashes
    .trim();

  // Map underscore format to hyphen format
  const processMap: Record<string, string> = {
    sheet_metal: "sheet-metal",
    cnc_milling: "cnc-milling",
    cnc_turning: "cnc-turning",
    manual_quote: "manual-quote",
    assembly: "manual-quote",
  };

  return processMap[process] || process || "cnc-milling";
}

// --- Constants (Moved Outside) ---
// Helper function to get materials based on process
// Filters out materials requiring manual review (they shouldn't appear in the dropdown)
const getMaterialsForProcess = (process: string | undefined) => {
  if (isSheetMetalProcess(process)) {
    // Flatten sheet metal materials for dropdown
    const materials: {
      value: string;
      label: string;
      multiplier: number;
      icon: string;
      requiresManualQuote?: boolean;
    }[] = [];
    for (const [category, mats] of Object.entries(SHEET_METAL_MATERIALS)) {
      for (const mat of mats) {
        // Skip materials that require manual quote - they shouldn't be in the dropdown
        if ((mat as any).requiresManualQuote) continue;

        materials.push({
          value: (mat as any).value || mat.code,
          label: (mat as any).label || mat.name,
          multiplier: mat.costPerKg / 8.5,
          icon:
            category === "aluminum"
              ? "🔷"
              : category === "stainless"
                ? "⚙️"
                : category === "copper"
                  ? "🟠"
                  : category === "galvanized"
                    ? "🔩"
                    : category === "brass"
                      ? "🟤"
                      : "⚫",
        });
      }
    }
    return materials;
  }

  // CNC Machining materials - flatten from categorized structure
  const materials: {
    value: string;
    label: string;
    multiplier: number;
    icon: string;
  }[] = [];
  for (const [category, mats] of Object.entries(CNC_MATERIALS)) {
    for (const mat of mats) {
      materials.push({
        value: mat.value,
        label: mat.label,
        multiplier: mat.costPerKg / 8.5,
        icon:
          category === "aluminum"
            ? "🔷"
            : category === "steel"
              ? "⚙️"
              : category === "stainless"
                ? "⚙️"
                : category === "titanium"
                  ? "🔵"
                  : category === "brass"
                    ? "🟤"
                    : category === "plastics"
                      ? "🟢"
                      : "⚫",
      });
    }
  }
  return materials;
};

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

// Sheet metal specific tolerances
const SHEET_METAL_TOLERANCES_LIST = [
  { value: "standard", label: 'Standard (±0.010")', multiplier: 1.0 },
  { value: "precision", label: 'Precision (±0.005")', multiplier: 1.15 },
  { value: "tight", label: 'Tight (±0.002")', multiplier: 1.3 },
];

const TOLERANCES_LIST = [
  { value: "standard", label: 'Standard (±0.005")', multiplier: 1.0 },
  { value: "precision", label: 'Precision (±0.002")', multiplier: 1.15 },
  { value: "tight", label: 'Tight (±0.001")', multiplier: 1.3 },
];

// Sheet metal specific finishes
const SHEET_METAL_FINISHES_LIST = [
  { value: "as-cut", label: "As Cut (Unfinished)", cost: 0 },
  { value: "deburring", label: "Deburred Edges", cost: 8 },
  { value: "powder-coated", label: "Powder Coated", cost: 22 },
  {
    value: "powder-coated-custom",
    label: "Powder Coated (Custom Color)",
    cost: 35,
  },
  {
    value: "anodized-clear",
    label: "Anodized Clear (Aluminum only)",
    cost: 18,
  },
  {
    value: "anodized-color",
    label: "Anodized Color (Aluminum only)",
    cost: 25,
  },
  { value: "zinc-plated", label: "Zinc Plated", cost: 15 },
  { value: "electropolished", label: "Electropolished", cost: 35 },
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
  { value: "standard", label: "Standard Inspection" },
  { value: "first-article", label: "First Article Inspection" },
  { value: "full-cmm", label: "Full CMM Report" },
  { value: "material-cert", label: "Material Certification" },
];

type IRFQ = {
  id: string;
  rfq_code: string;
  status: string;
  user_id: string;
  rfq_type: "general" | "manual";
};

// --- Moved Helper Functions ---

export const calculateLeadTime = (
  part: PartConfig,
  tier?: "economy" | "standard" | "expedited",
) => {
  if (!part.geometry) return 7;

  // Get material based on process type (normalize handles malformed strings)
  const processType = normalizeProcessString(
    part.process || part.geometry?.recommendedProcess,
  );

  // Manual-quote parts (assemblies) get default lead time
  if (processType === "manual-quote") return 7;

  const material = getMaterialForProcess(part.material, processType);
  if (!material) return 7;

  // Get correct process config
  const process =
    PROCESSES[processType as keyof typeof PROCESSES] ||
    PROCESSES["cnc-milling"];
  const finish = getFinish(part.finish);

  const pricing = calculatePricing({
    geometry: part.geometry,
    material,
    process,
    finish,
    quantity: part.quantity,
    tolerance: part.tolerance as "standard" | "precision" | "tight",
    leadTimeType: tier || part.leadTimeType || "standard",
  });

  return Math.round(pricing.leadTimeDays);
};

const calculatePrice = (
  part: PartConfig,
  tier: "economy" | "standard" | "expedited" = "standard",
): number => {
  if (!part.geometry) return 0;

  // Determine process type from CAD analysis (normalize handles malformed strings)
  const processType = normalizeProcessString(
    part.process || part.geometry?.recommendedProcess,
  );

  // Short-circuit for manual-quote parts — they should always show $0
  // Assembly parts and other manual-quote parts must not go through CNC/SM pricing
  if (processType === "manual-quote") return 0;

  // Get material based on process type
  const material = getMaterialByValue(part.material, processType);
  if (!material) {
    // Fallback to legacy getMaterial for backward compatibility
    const legacyMaterial = getMaterial(part.material);
    if (!legacyMaterial) return 0;

    // Use legacy pricing
    const process =
      PROCESSES[processType as keyof typeof PROCESSES] ||
      PROCESSES["cnc-milling"];
    const finish = getFinish(part.finish);
    const pricing = calculatePricing({
      geometry: part.geometry,
      material: legacyMaterial,
      process,
      finish,
      quantity: part.quantity,
      tolerance: part.tolerance as "standard" | "precision" | "tight",
      leadTimeType: tier,
    });
    return pricing.totalPrice;
  }

  // Get correct process config
  const process =
    PROCESSES[processType as keyof typeof PROCESSES] ||
    PROCESSES["cnc-milling"];
  const finish = getFinish(part.finish);

  // Create material spec for pricing engine
  // IMPORTANT: Include thickness for sheet metal materials
  const isSheetMetal = isSheetMetalProcess(processType);

  // Helper to get valid sheet thickness (clamp unrealistic values)
  const getValidThickness = () => {
    // Priority 1: Material's thickness property (from SHEET_METAL_MATERIALS)
    if ((material as any).thickness && (material as any).thickness <= 25) {
      return (material as any).thickness;
    }
    // Priority 2: User-configured sheet_thickness_mm
    if (
      part.sheet_thickness_mm &&
      part.sheet_thickness_mm > 0 &&
      part.sheet_thickness_mm <= 25
    ) {
      return part.sheet_thickness_mm;
    }
    // Priority 3: Geometry sheetMetalFeatures (validate range - bbox values can be huge)
    const smThickness = part.geometry?.sheetMetalFeatures?.thickness;
    if (smThickness && smThickness > 0 && smThickness <= 25) {
      return smThickness;
    }
    // Default to 2.0mm (matches AL5052-2.0 default material)
    return 2.0;
  };

  const materialSpec = isSheetMetal
    ? {
        // Sheet metal material spec with thickness
        code: (
          (material as any).value ||
          (material as any).code ||
          ""
        ).toUpperCase(),
        name: (material as any).label || (material as any).name || "",
        density: material.density,
        costPerKg: material.costPerKg,
        thickness: getValidThickness(),
        category: (material as any).category || "aluminum",
        bendability: (material as any).bendability || 1.0,
        // Pass manual quote flags for exotic materials
        requiresManualQuote: (material as any).requiresManualQuote || false,
        manualQuoteReason: (material as any).manualQuoteReason,
      }
    : {
        // CNC material spec
        code: (
          (material as any).value ||
          (material as any).code ||
          ""
        ).toUpperCase(),
        name: (material as any).label || (material as any).name || "",
        density: material.density,
        costPerKg: material.costPerKg,
        machinabilityFactor:
          "machinabilityFactor" in material
            ? (material as any).machinabilityFactor
            : 1.0,
      };

  // Calculate pricing with thickness support for sheet metal
  const pricing = calculatePricing({
    geometry: part.geometry,
    material: materialSpec,
    process,
    finish,
    quantity: part.quantity,
    tolerance: isCNCProcess(processType)
      ? (part.tolerance as "standard" | "precision" | "tight")
      : "standard",
    leadTimeType: tier,
    // Pass thickness for sheet metal calculations
    ...(isSheetMetalProcess(processType) && {
      sheetThickness: getValidThickness(),
    }),
  });

  return pricing.totalPrice;
};

export default function QuoteConfigPage() {
  const router = useRouter();
  const paramsHook = useParams();
  const quoteId = paramsHook?.id as string;

  const [rfq, setRfq] = useState<IRFQ>({} as IRFQ);
  const [parts, setParts] = useState<PartConfig[]>([]);
  const [suggestionPart, setSuggestionPart] = useState<string>("");

  // currentPartIndex removed as we list all parts
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [is3DFileUploading, setIs3DFileUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);

  const [archivedParts, setArchivedParts] = useState<PartConfig[]>([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showManualQuoteModal, setShowManualQuoteModal] = useState(false);
  const [showTechnicalSupportModal, setShowTechnicalSupportModal] =
    useState(false);
  const [showIdleTooltip, setShowIdleTooltip] = useState(false);
  const [supportRequestExists, setSupportRequestExists] = useState(false);
  const [isManualQuote, setIsManualQuote] = useState(false);
  // Bulk selection state
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set()); // Track parts with pending changes
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [hasDismissedExceededModal, setHasDismissedExceededModal] =
    useState(false);
  const [showManualExceededModal, setShowManualExceededModal] = useState(false);
  const [showManualWarningModal, setShowManualWarningModal] = useState(false);
  const partsContainerRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Show the tooltip after 1 minute of no user activity
  useEffect(() => {
    const IDLE_MS = 60_000;

    const resetTimer = () => {
      setShowIdleTooltip(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        // Only show if the modal isn't already open and no request exists
        if (!supportRequestExists) {
          setShowTechnicalSupportModal((open) => {
            if (!open) setShowIdleTooltip(true);
            return open;
          });
        }
      }, IDLE_MS);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((e) =>
      window.addEventListener(e, resetTimer, { passive: true }),
    );

    resetTimer(); // kick off on mount

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [supportRequestExists]);

  const manualParts = useMemo(
    () => parts.filter((p) => p.process === "manual-quote"),
    [parts],
  );
  const manualPartIds = useMemo(
    () => manualParts.map((p) => p.id),
    [manualParts],
  );

  useEffect(() => {
    const checkScroll = () => {
      if (!partsContainerRef.current) return;

      const partsContainer = partsContainerRef.current;
      const containerRect = partsContainer.getBoundingClientRect();
      const containerBottom = containerRect.bottom;
      const windowHeight = window.innerHeight;

      // Check if there's more content to scroll in the parts section
      const hasMoreToScroll = containerBottom > windowHeight + 100;

      setShowScrollIndicator(hasMoreToScroll);
    };

    checkScroll();
    window.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      window.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [parts.length]);

  const session = useSession();

  const { upload } = useFileUpload();

  // Dropzone callback for drag and drop
  const onDropFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setIs3DFileUploading(true);
      setUploadingFiles(acceptedFiles.map((file) => file.name));

      try {
        const processFile = async (file: File) => {
          try {
            // 1. Upload file (Fallback to temp path if upload fails)
            let uploadedPath = `temp/${file.name}`;
            try {
              const { url } = await upload(file);
              uploadedPath = url;
            } catch (error) {
              console.error(`File upload failed for ${file.name}:`, error);
              notify.error(`Failed to upload ${file.name}`);
            }

            // 2. Determine and perform geometry analysis
            const extension = file.name.toLowerCase().split(".").pop();
            const useBackendAnalysisList = [
              "step",
              "stp",
              "iges",
              "igs",
              "dxf",
              "stl",
            ];
            const useBackendAnalysis = useBackendAnalysisList.includes(
              extension || "",
            );

            let geometry;
            let status: any = "queued";

            if (!useBackendAnalysis) {
              try {
                geometry = await analyzeCADFile(file);
                status = "processed";
              } catch (_error) {
                console.warn(`Client-side analysis failed for ${file.name}`);
              }
            }

            // 1. Construct part object
            const newPart: any = {
              file_name: file.name,
              cad_file_url: uploadedPath,
              cad_file_type: file.type || "application/octet-stream",
              material: "aluminum-6061",
              quantity: 1,
              status: status,
              tolerance: "standard",
              finish: "as-machined",
              sheet_thickness_mm: undefined,
              threads: "none",
              inspection: "standard",
              notes: "",
              lead_time_type: "standard",
              process: "cnc-milling",
              geometry: geometry || null,
              certificates: [],
              final_price: 0,
              lead_time: 0,
            };

            // If we have geometry, calculate initial pricing/defaults
            if (geometry) {
              const detectedProcess =
                geometry?.recommendedProcess || "cnc-milling";
              newPart.process = detectedProcess;
              newPart.material = getDefaultMaterialForProcess(detectedProcess);
              newPart.finish = getDefaultFinishForProcess(detectedProcess);
              newPart.tolerance =
                getDefaultToleranceForProcess(detectedProcess);
              newPart.final_price = calculatePrice(newPart);
              newPart.lead_time = calculateLeadTime(newPart, "standard");
            }

            return newPart;
          } catch (error) {
            console.error(
              `Error processing individual file ${file.name}:`,
              error,
            );
            notify.error(`Failed to process ${file.name}`);
            return null;
          }
        };

        // Run all file processing in parallel for massive speedup
        const results = await Promise.all(acceptedFiles.map(processFile));
        const finalNewParts = results.filter((p): p is any => p !== null);

        if (finalNewParts.length === 0) return;

        // 7. Add all parts to RFQ in one batch
        const { data } = await apiClient.post(`/rfq/${rfq.id}/add-parts`, {
          parts: finalNewParts,
        });

        if (!data) {
          notify.error("Failed to add parts to server");
          return;
        }

        const proccessedParts = processParts(data.parts);
        setParts((prev) => [...prev, ...proccessedParts]);
        startPolling(); // Ensure polling starts after adding new parts
        notify.success(`Successfully added ${finalNewParts.length} part(s)`);
      } catch (error) {
        console.error("Error in onDropFiles batch processing:", error);
        notify.error("Failed to process files");
      } finally {
        setIs3DFileUploading(false);
        setUploadingFiles([]);
      }
    },
    [parts.length, upload],
  );

  // Setup dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropFiles,
    accept: CAD_MIME_MAP,
    multiple: true,
  });

  const deleteParts = async (partIds: string[]) => {
    try {
      const data = await apiClient.delete(`/rfq/${rfq.id}/remove-parts`, {
        data: {
          partIds,
        },
      });

      if (!data) {
        notify.error("Failed to delete parts");
        return;
      }

      notify.success(`Successfully deleted ${partIds.length} part(s)`);
    } catch (error) {
      console.error(error);
      notify.error("Failed to delete parts");
    }
  };

  const handleManualParts = async (partIds: string[], metadata?: any) => {
    const isFullManual = partIds.length === parts.length;
    try {
      const { data } = await apiClient.post(`/rfq/manual`, {
        partIds,
        metadata,
        rfqId: isFullManual ? rfq.id : undefined,
      });

      if (!data) {
        notify.error("Failed to create manual quote");
        return;
      }

      if (isFullManual) {
        notify.success("Quote converted to manual review");
        router.push(`/portal/quotes/${rfq.id}`);
      } else {
        setParts((prev) => prev.filter((p) => !partIds.includes(p.id)));
        notify.success(`Successfully created manual quote`);
      }
    } catch (error) {
      console.log(error);
      notify.error("Failed to create manual quote");
    }
  };

  const hasManualPartExceededThreshold = (maxAllowed: number): boolean => {
    let count = 0;

    for (const part of parts) {
      if (part.process !== "manual-quote") continue;

      count++;
      if (count >= maxAllowed) {
        return true; // early exit
      }
    }

    if (count === parts.length) setIsManualQuote(true);
    else setIsManualQuote(false);

    return false;
  };

  // Handle deleting a part
  const handleDeletePart = async (indexToDelete: number) => {
    if (parts.length === 1) {
      notify.error(
        "Cannot delete the last part. At least one part is required.",
      );
      return;
    }

    await deleteParts([parts[indexToDelete].id]);
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
  const handleArchivePart = async (partId: string) => {
    const partToArchive = parts.find((p) => p.id === partId);
    if (!partToArchive) return;

    if (parts.length === 1) {
      notify.error(
        "Cannot archive the last part. At least one part is required.",
      );
      return;
    }

    try {
      await updatePartFields(
        parts.findIndex((p) => p.id === partId),
        { is_archived: true },
        true,
      );

      setParts((prev) => prev.filter((p) => p.id !== partId));
      setArchivedParts((prev) => [
        ...prev,
        { ...partToArchive, is_archived: true },
      ]);
      notify.success("Part archived successfully");
    } catch (error) {
      console.error("Failed to archive part:", error);
      notify.error("Failed to archive part");
    }
  };

  // Handle bulk archive
  const handleBulkArchive = async () => {
    if (selectedParts.size === 0) return;

    if (parts.length - selectedParts.size === 0) {
      notify.error("Cannot archive all parts. At least one part is required.");
      return;
    }

    const partsToArchive = parts.filter((p) => selectedParts.has(p.id));

    try {
      await Promise.all(
        partsToArchive.map((part) =>
          apiClient.patch(`/rfq/${rfq.id}/parts/${part.id}`, {
            is_archived: true,
          }),
        ),
      );

      setParts((prev) => prev.filter((p) => !selectedParts.has(p.id)));
      setArchivedParts((prev) => [
        ...prev,
        ...partsToArchive.map((p) => ({ ...p, is_archived: true })),
      ]);
      setSelectedParts(new Set());
      notify.success(`Archived ${partsToArchive.length} part(s)`);
    } catch (error) {
      console.error("Failed to archive active parts:", error);
      notify.error("Failed to archive selection");
    }
  };

  // Handle unarchiving a part
  const handleUnarchivePart = async (partId: string) => {
    const partToUnarchive = archivedParts.find((p) => p.id === partId);
    if (!partToUnarchive) return;

    try {
      await apiClient.patch(`/rfq/${rfq.id}/parts/${partId}`, {
        is_archived: false,
      });

      setArchivedParts((prev) => prev.filter((p) => p.id !== partId));
      setParts((prev) => [...prev, { ...partToUnarchive, is_archived: false }]);
      notify.success("Part restored successfully");
    } catch (error) {
      console.error("Failed to unarchive part:", error);
      notify.error("Failed to restore part");
    }
  };

  // Handle unarchiving all parts
  const handleUnarchiveAll = async () => {
    if (archivedParts.length === 0) return;

    try {
      await Promise.all(
        archivedParts.map((part) =>
          apiClient.patch(`/rfq/${rfq.id}/parts/${part.id}`, {
            is_archived: false,
          }),
        ),
      );

      setParts((prev) => [
        ...prev,
        ...archivedParts.map((p) => ({ ...p, is_archived: false })),
      ]);
      setArchivedParts([]);
      notify.success(`Restored ${archivedParts.length} part(s)`);
    } catch (error) {
      console.error("Failed to unarchive all parts:", error);
      notify.error("Failed to restore all parts");
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async (idsToDelete?: Set<string> | string[]) => {
    const ids = idsToDelete
      ? idsToDelete instanceof Set
        ? Array.from(idsToDelete)
        : idsToDelete
      : Array.from(selectedParts);

    if (ids.length === 0) return;

    if (parts.length - ids.length === 0) {
      notify.error("Cannot delete all parts. At least one part is required.");
      return;
    }
    try {
      await deleteParts(ids);
      setParts((prev) => prev.filter((p) => !ids?.includes(p.id)));
      setSelectedParts((prev) => {
        const newSet = new Set(prev);
        ids.forEach((id) => newSet.delete(id));
        return newSet;
      });
      notify.success(`Deleted ${ids.length} part(s)`);
    } catch (error) {
      console.error("Failed to delete parts:", error);
      notify.error("Failed to delete selection");
    }
  };

  // Exit selection mode when no parts are selected
  const exitSelectionMode = () => {
    setSelectedParts(new Set());
  };

  // Removed strict authentication check to allow guest access for temp quotes

  async function loadQuote(isPolling: boolean = false) {
    if (!quoteId) return;

    try {
      if (!isPolling) setLoading(true);

      try {
        const response = await apiClient.get(`/rfq/${quoteId}`);

        if (response.data && response.data.parts) {
          const apiPartsRaw = response.data.parts;
          let currentRfq = response.data.rfq;

          // Map and Calculate
          const partsToSync: {
            id: string;
            final_price: number;
            lead_time: number;
          }[] = [];
          let rfqTotalCalculated = 0;
          let syncNeeded = false;

          const processedParts: PartConfig[] = apiPartsRaw.map((p: any) => {
            // CRITICAL: Normalize process field from database using helper function
            // Handles: double-encoded JSON, escaped quotes, underscore format, etc.
            const normalizedProcess = normalizeProcessString(
              p.process || p.geometry?.recommendedProcess,
            );

            // Determine if this is a sheet metal part for proper material defaulting
            const isSheetMetalPart = isSheetMetalProcess(normalizedProcess);
            const defaultMaterial = isSheetMetalPart
              ? "AL5052-2.0"
              : "aluminum-6061";

            // Check if current material is valid for the process type
            // If sheet metal part has a CNC material (like aluminum-6061), replace with sheet metal default
            let partMaterial = p.material;
            if (isSheetMetalPart && partMaterial) {
              // Check if material is a sheet metal code (e.g., AL5052-2.0) or CNC code (e.g., aluminum-6061)
              const isSheetMetalMaterial =
                partMaterial.match(/^[A-Z]{2}\d+/i) ||
                (partMaterial.includes("-") && partMaterial.match(/\d+\.\d+$/));
              if (!isSheetMetalMaterial) {
                // CNC material on sheet metal part - replace with default
                partMaterial = defaultMaterial;
              }
            }

            const part: PartConfig = {
              id: p.id,
              rfqId: p.rfq_id,
              status: p.status || "draft",
              fileName: p.file_name,
              filePath: p.cad_file_url,
              fileObject: undefined, // URL only
              material: partMaterial || defaultMaterial,
              quantity: p.quantity || 1,
              tolerance: p.tolerance || "standard",
              finish: p.finish || "as-machined",
              threads: p.threads || "none",
              inspection: p.inspection || "standard",
              notes: p.notes || "",
              leadTimeType: (p.lead_time_type as any) || "standard",
              geometry: p.geometry,
              pricing: undefined,
              certificates: p.certificates || [],
              final_price: undefined,
              leadTime: undefined,
              is_archived: p.is_archived,
              snapshot_2d_url: p.snapshot_2d_url,
              process: normalizedProcess as PartConfig["process"],
              files2d: (p.files2d || []).map((f: any) => ({
                file: {
                  name: f.file_name || "Drawing",
                  type: f.mime_type || "application/pdf",
                  size: 0,
                  id: f.id,
                },
                preview: f.file_url,
              })),
              changeMeta: p.change_meta || {},
            };

            // Recalculate Pricing Object
            // Skip pricing for manual-quote parts (assemblies) — they must show $0
            if (
              ![RFQPartStatus.Queued, RFQPartStatus.Processing].includes(
                part.status,
              ) &&
              part.geometry &&
              normalizedProcess !== "manual-quote"
            ) {
              // CRITICAL: Use the already-normalized process, not the raw DB value
              const processType = normalizedProcess;
              const material = getMaterialForProcess(
                part.material,
                processType,
              );
              if (material) {
                const process =
                  PROCESSES[processType as keyof typeof PROCESSES] ||
                  PROCESSES["cnc-milling"];
                const finish = getFinish(part.finish);

                part.pricing = calculatePricing({
                  geometry: part.geometry,
                  material,
                  process,
                  finish,
                  quantity: part.quantity,
                  tolerance: part.tolerance as any,
                  leadTimeType: "standard",
                });
              }
            }

            // Recalculate Final Price and Lead Time
            const calculatedPrice = calculatePrice(part, part.leadTimeType);
            const calculatedLeadTime = calculateLeadTime(
              part,
              part.leadTimeType,
            );

            part.final_price = calculatedPrice;
            part.leadTime = calculatedLeadTime;

            rfqTotalCalculated += calculatedPrice;

            if (!isPolling) {
              const dbPrice = p.final_price ? Number(p.final_price) : 0;
              const dbLeadTime = p.lead_time ? Number(p.lead_time) : 0;

              if (
                Math.abs(calculatedPrice - dbPrice) > 0.01 ||
                calculatedLeadTime !== dbLeadTime
              ) {
                syncNeeded = true;
                partsToSync.push({
                  id: part.id,
                  final_price: calculatedPrice,
                  lead_time: calculatedLeadTime,
                });
              }
            }
            return part;
          });

          // Check RFQ Total Sync
          const dbRfqTotal = currentRfq.final_price
            ? Number(currentRfq.final_price)
            : 0;
          if (Math.abs(rfqTotalCalculated - dbRfqTotal) > 0.01) {
            syncNeeded = true;
          }

          if (!isPolling && syncNeeded) {
            await apiClient
              .post(`/rfq/${quoteId}/sync-pricing`, {
                rfq_final_price: rfqTotalCalculated,
                parts: partsToSync,
              })
              .then(() => {
                notify.success(
                  "Pricing updated based on recent material cost.",
                );
                currentRfq = {
                  ...currentRfq,
                  final_price: rfqTotalCalculated,
                };
              })
              .catch((err) => {
                console.error("Failed to sync pricing", err);
              });
          }

          setRfq(currentRfq);
          setParts(processedParts.filter((p) => !p.is_archived));
          setArchivedParts(processedParts.filter((p) => p.is_archived));

          // Check if technical support request exists
          try {
            const supportCheck = await apiClient.get(
              `/rfq/${quoteId}/tech-support/exist`,
            );
            setSupportRequestExists(supportCheck.data.exists);
          } catch (supportError) {
            console.error(
              "Failed to check support request existence:",
              supportError,
            );
          }

          return processedParts;
        } else {
          throw new Error("Invalid API response");
        }
      } catch (error) {
        console.error("Error loading quote from API:", error);
        notify.error("Failed to load quote. Please try again.");
        // Don't auto-redirect immediately, let user see error or use back button
        // router.push("/instant-quote");
      }
    } catch (error) {
      console.error("Error loading quote:", error);
      alert("Failed to load quote. Please try again.");
      router.push("/instant-quote");
    } finally {
      if (!isPolling) setLoading(false);
    }
  }

  const startPolling = () => {
    if (pollingRef.current) return; // already polling

    pollingRef.current = setInterval(async () => {
      const updatedParts = await loadQuote(true);
      if (!updatedParts) return;

      const stillPending = updatedParts.some((p) =>
        ["queued", "processing"].includes(p.status),
      );

      if (!stillPending) {
        stopPolling();
        // Processing just completed — run a full (non-polling) load so that
        // the sync-pricing API call fires and persists the newly calculated
        // prices (based on the fresh geometry) back to the DB.
        await loadQuote(true);
      }
    }, 5000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    if (!quoteId) return;

    (async () => {
      const parts = await loadQuote(false);
      if (!parts) return;

      const hasPending = parts.some((p) =>
        ["queued", "processing"].includes(p.status),
      );

      if (hasPending) startPolling();
    })();

    return () => stopPolling();
  }, [quoteId]);

  // useEffect(() => {
  //   loadQuote();
  // }, [quoteId, router, session.status]);

  const exceeded = useMemo(() => hasManualPartExceededThreshold(4), [parts]);

  useEffect(() => {
    if (!exceeded) {
      setHasDismissedExceededModal(false);
    }
  }, [exceeded]);

  // Handle side-effect redirects (Paid, Under Review, etc.)
  useEffect(() => {
    if (!rfq) return;

    if (rfq.status === "paid") {
      notify.info(
        "This quote has already been paid and processed. Redirecting to your orders.",
      );
      router.push("/portal/orders");
    } else if (rfq.status === "under review") {
      notify.info(
        "This quote is currently under review. We'll notify you once the review is complete.",
      );
      router.push(`/portal/quotes/${rfq.id}`);
    }
  }, [rfq, router]);

  // Handle Manual Quote Warning
  useEffect(() => {
    if (rfq?.rfq_type === "manual" && rfq.status !== "under review") {
      setShowManualWarningModal(true);
    }
  }, [rfq]);

  // Lead Time & Pricing Calculations

  const updatePartFields = async (
    index: number,
    updates: Partial<PartConfig>,
    saveToDb: boolean = true,
  ) => {
    const currentPart = parts[index];
    if (!currentPart) return;

    // Calculate new state logic
    const updatedPart = { ...currentPart, ...updates };

    // If process changed, reset material/finish/tolerance to process-appropriate defaults
    if (updates.process && updates.process !== currentPart.process) {
      updatedPart.material = getDefaultMaterialForProcess(updates.process);
      updatedPart.finish = getDefaultFinishForProcess(updates.process);
      updatedPart.tolerance = getDefaultToleranceForProcess(updates.process);
      notify.info(
        `Process changed. Material and finish reset to ${getProcessDisplayName(updates.process)} defaults.`,
      );
    }

    // Recalculate pricing if geometry exists
    // Skip pricing for manual-quote parts (assemblies) — they must show $0
    if (
      updatedPart.geometry &&
      normalizeProcessString(updatedPart.process) !== "manual-quote"
    ) {
      // CRITICAL: Normalize process to prevent underscore-format mismatches
      const processType = normalizeProcessString(
        updatedPart.process || updatedPart.geometry?.recommendedProcess,
      );
      const material = getMaterialForProcess(updatedPart.material, processType);

      if (material) {
        const process =
          PROCESSES[processType as keyof typeof PROCESSES] ||
          PROCESSES["cnc-milling"];
        const finish = getFinish(updatedPart.finish);

        // Calculate pricing
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

        // Recalculate derived fields
        updatedPart.final_price = calculatePrice(
          updatedPart,
          updatedPart.leadTimeType,
        );
        updatedPart.leadTime = calculateLeadTime(
          updatedPart,
          updatedPart.leadTimeType,
        );
      }
    }

    // Optimistic Update
    setParts((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        return updatedPart;
      }),
    );

    // Backend Update
    if (!saveToDb) {
      setUnsavedChanges((prev) => new Set(prev).add(updatedPart.id));
      return;
    }

    try {
      const payload: any = {};

      // Explicitly map fields that are changing or relevant
      if (updates.material !== undefined)
        payload.material = updatedPart.material;
      if (updates.quantity !== undefined)
        payload.quantity = updatedPart.quantity;
      if (updates.tolerance !== undefined)
        payload.tolerance = updatedPart.tolerance;
      if (updates.finish !== undefined) payload.finish = updatedPart.finish;
      if (updates.threads !== undefined) payload.threads = updatedPart.threads;
      if (updates.inspection !== undefined)
        payload.inspection = updatedPart.inspection;
      if (updates.notes !== undefined) payload.notes = updatedPart.notes;
      if (updates.leadTimeType !== undefined)
        payload.lead_time_type = updatedPart.leadTimeType;
      if (updates.certificates !== undefined)
        payload.certificates = updatedPart.certificates;
      if (updates.is_archived !== undefined)
        payload.is_archived = updatedPart.is_archived;

      // Always send price and lead time if they exist, as they might have changed due to other updates
      if (updatedPart.final_price !== undefined)
        payload.final_price = updatedPart.final_price;
      if (updatedPart.leadTime !== undefined)
        payload.lead_time = updatedPart.leadTime;

      if (Object.keys(payload).length > 0) {
        await apiClient.patch(
          `/rfq/${rfq.id}/parts/${updatedPart.id}`,
          payload,
        );
      }
    } catch (error) {
      console.error("Failed to update part in backend:", error);
      notify.error("Failed to save changes to server");
    }
  };

  const updatePart = (
    index: number,
    field: keyof PartConfig,
    value: any,
    saveToDb: boolean = true,
  ) => {
    updatePartFields(index, { [field]: value }, saveToDb);
  };

  const updatePartById = (
    partId: string,
    field: keyof PartConfig,
    value: any,
    saveToDb: boolean = true,
  ) => {
    const index = parts.findIndex((p) => p.id === partId);
    if (index !== -1) {
      updatePart(index, field, value, saveToDb);
    }
  };

  const standardPrice = parts.reduce(
    (sum, part) => sum + (part.final_price || 0),
    0,
  );

  const handleSaveDraft = async (
    message: string = "Draft saved successfully",
    status: string = "draft",
  ) => {
    if (unsavedChanges.size === 0) {
      notify.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const partsToSave = parts.filter((p) => unsavedChanges.has(p.id));

      await Promise.all([
        ...partsToSave.map(async (part) => {
          const payload = {
            quantity: part.quantity,
            lead_time_type: part.leadTimeType,
            final_price: part.final_price,
            lead_time: part.leadTime,
          };
          await apiClient.patch(`/rfq/${rfq.id}/parts/${part.id}`, payload);
        }),
        apiClient.patch(`/rfq/${rfq.id}`, {
          final_price: standardPrice,
          status: status,
        }),
      ]);

      setUnsavedChanges(new Set());
      notify.success(message);
    } catch (error) {
      console.error("Error saving draft:", error);
      notify.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const checkFor2DDiagrams = () => {
    let isValid = true;

    for (const part of parts) {
      if (!part.files2d?.length) {
        notify.info(`Part ${part.id} is missing a 2D diagram`);
        isValid = false;
      }
    }

    return isValid;
  };

  const checkIndividualPrice = () => {
    let isValid = true;

    for (const part of parts) {
      if (typeof part.final_price === "number" && part.final_price < 150) {
        notify.info(`Part ${part.fileName} has valuation below $150`);
        isValid = false;
      }
    }

    return isValid;
  };

  const handleCheckout = async () => {
    try {
      setSaving(true);

      if (standardPrice < 150) {
        notify.error(
          "Please revise the quote to a minimum value of $150 to proceed.",
        );
        return;
      }

      // Check for manual parts before checkout
      if (manualParts.length > 0) {
        setShowManualExceededModal(true);
        return;
      }

      if (!checkIndividualPrice()) {
        return;
      }

      if (!checkFor2DDiagrams()) {
        return;
      }

      // Ensure all changes are saved before checkout logic if needed
      if (unsavedChanges.size > 0) {
        await handleSaveDraft("Quote changes saved successfully", "submitted");
      }

      router.push(`/checkout/${quoteId}`);
    } catch (error) {
      console.error("Error saving configuration:", error);
      notify.error("Failed to save configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleManualQuote = async (metadata: any) => {
    await handleManualParts(manualPartIds, metadata);
  };

  // Handle applying suggestions
  const handleApplySuggestion = (suggestion: any) => {
    const partIndex = parts.findIndex((p) => p.id === suggestion.partId);
    if (partIndex === -1 && suggestion.partId !== "multi") return;

    // Handle multi-part suggestions (bundles) if needed
    if (suggestion.partId === "multi") {
      notify.info("Multi-part optimization applied");
      return;
    }

    const action = suggestion.action || {};
    const type = action.type || suggestion.type;

    switch (type) {
      case "quantity":
      case "increase-quantity":
      case "change-quantity":
      case "volume-discount": {
        const newQty = action.quantity || suggestion.suggestedValue;
        updatePart(partIndex, "quantity", newQty, true);
        notify.success(`Quantity updated to ${newQty}`);
        break;
      }
      case "material":
      case "change-material":
      case "upgrade-material":
      case "premium-upgrade": {
        const newMat = action.material || suggestion.suggestedValue;
        updatePart(partIndex, "material", newMat, true);
        notify.success(`Material updated to ${newMat}`);
        break;
      }
      case "finish":
      case "change-finish":
      case "upgrade-finish": {
        const newFinish = action.finish || suggestion.suggestedValue;
        updatePart(partIndex, "finish", newFinish, true);
        notify.success(`Finish updated to ${newFinish}`);
        break;
      }
      case "leadtime":
      case "change-lead-time":
      case "expedite-production":
      case "express-shipping": {
        const newLeadTime = action.leadTime || "standard";
        updatePart(partIndex, "leadTimeType", newLeadTime, true);
        notify.success(`Lead time updated to ${newLeadTime}`);
        break;
      }
      case "add-fai":
        updatePart(partIndex, "inspection", "first-article", true);
        notify.success("First Article Inspection added");
        break;
      case "add-cmm":
        updatePart(partIndex, "inspection", "full-cmm", true);
        notify.success("Full CMM Report added");
        break;
      case "tolerance":
      case "change-tolerance":
        updatePart(partIndex, "tolerance", suggestion.suggestedValue, true);
        notify.success(`Tolerance updated to ${suggestion.suggestedValue}`);
        break;
      default:
        console.warn("Unhandled suggestion type:", type);
        break;
    }
  };

  const getManualQuoteSnapshots = (): string[] => {
    return (
      parts
        .map((part) => part.snapshot_2d_url)
        .filter((url): url is string => !!url) || []
    );
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

  // Prevent rendering if the quote status is not allowed for configuration
  const restrictedStatuses = ["paid", "under review", "pending approval"];
  if (rfq && restrictedStatuses.includes(rfq.status)) {
    // Exception: Manual quotes in 'pending approval' should show the warning modal
    // instead of returning null, so the user can interact with the options.
    if (!(rfq.status === "pending approval" && rfq.rfq_type === "manual")) {
      return null;
    }
  }

  return (
    <SuggestionProvider>
      <div className="min-h-screen invisible-scrollbar bg-[#F0F4F8] relative font-sans text-slate-900">
        {/* Dynamic Background Elements */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-400/20 rounded-full blur-[100px] opacity-40"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-400/20 rounded-full blur-[100px] opacity-40"></div>
        </div>

        {/* HEADER - Updated to be flat and at top */}
        <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-white/80 backdrop-blur-xl shadow-sm supports-[backdrop-filter]:bg-white/60">
          <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4 py-3">
            {/* Left: Logo & Breadcrumbs */}
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-2 group transition-opacity hover:opacity-80"
              >
                <div className="h-12 w-auto relative">
                  <Logo classNames="h-full w-auto object-contain" />
                </div>
              </Link>

              <div className="hidden md:block w-px h-8 bg-slate-200"></div>

              <div className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-500">
                <Link
                  href="/instant-quote"
                  className="hover:text-blue-600 transition-colors"
                >
                  Instant Quote
                </Link>

                <ChevronRight className="w-4 h-4 text-slate-400" />
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold uppercase tracking-wider border border-blue-100">
                  Configuration
                </span>

                {rfq.rfq_type === "manual" && (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold uppercase tracking-wider border border-amber-100">
                    Manual Review
                  </span>
                )}

                <ChevronRight className="w-4 h-4 text-slate-400" />
                <span>Checkout</span>
              </div>
            </div>

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Price Display (Desktop) */}
              <div className="hidden lg:flex items-baseline gap-3 pl-4 pr-5 py-2 bg-slate-50 border border-slate-100 rounded-full shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total
                  </span>
                </div>
                <span className="font-bold text-slate-900 text-lg tabular-nums">
                  {formatCurrencyFixed(standardPrice)}
                </span>
              </div>

              <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block"></div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() =>
                    handleSaveDraft("Quote changes saved successfully")
                  }
                  disabled={saving || unsavedChanges.size === 0}
                  className="text-blue-600 bg-blue-50 hover:text-blue-700 hover:bg-blue-50 font-medium shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] rounded-lg"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden lg:inline">
                    {saving
                      ? "Saving..."
                      : unsavedChanges.size > 0
                        ? "Save Changes"
                        : "Save Quote"}
                  </span>
                </Button>

                <Button
                  // onClick={() => setShowUploadModal(true)}
                  onClick={() => router.push("/instant-quote")}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] rounded-lg"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Quote</span>
                </Button>
              </div>

              {/* User Profile */}
              {session.status === "authenticated" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full bg-slate-100 p-0 hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-200 hover:border-blue-200"
                    >
                      <User className="w-5 h-5" />
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-white"></span>
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-60 p-2 shadow-xl border-slate-100 rounded-xl"
                  >
                    <DropdownMenuLabel className="font-normal p-2">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-bold text-slate-900 leading-none">
                          {session?.data?.user?.name}
                        </p>
                        <p className="text-xs leading-none text-slate-500 truncate">
                          {session?.data?.user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-100 my-1" />
                    <DropdownMenuItem
                      onClick={() => router.push("/portal/dashboard")}
                      className="text-slate-700 cursor-pointer rounded-lg focus:bg-slate-50 focus:text-blue-600 p-2"
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push("/portal/orders")}
                      className="text-slate-700 cursor-pointer rounded-lg focus:bg-slate-50 focus:text-blue-600 p-2"
                    >
                      <Package2 className="w-4 h-4 mr-2" />
                      Orders
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-100 my-1" />
                    <DropdownMenuItem
                      onClick={() => signOut()}
                      className="text-red-600 cursor-pointer rounded-lg focus:bg-red-50 focus:text-red-700 p-2"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2 pl-2">
                  <Link href="/login">
                    <Button
                      variant="ghost"
                      className="text-slate-600 hover:text-blue-600 font-medium"
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

        <div className="flex items-center justify-between flex-wrap gap-4 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-8 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-2 md:gap-3 text-base md:text-lg">
            <Link
              href="/portal/quotes"
              className="font-medium text-blue-700 hover:text-blue-800 transition-colors"
            >
              Quotes
            </Link>

            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />

            <span className="font-bold text-slate-900 tracking-wide truncate max-w-[200px] md:max-w-none">
              {rfq.rfq_code}
            </span>
          </div>

          {/* Total Parts Count - Inline */}
          <div className="flex items-center gap-2 flex-shrink-0">
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

          <div className="flex items-center gap-x-2">
            <Tooltip
              open={showIdleTooltip ? true : undefined}
              defaultOpen={false}
            >
              <TooltipTrigger asChild>
                <div className="flex-shrink-0">
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors relative flex-shrink-0 text-sm md:text-base shadow-sm disabled:bg-indigo-400"
                    onClick={() => {
                      if (supportRequestExists) return;
                      setShowIdleTooltip(false);
                      setShowTechnicalSupportModal(true);
                    }}
                    disabled={supportRequestExists}
                  >
                    <img
                      src="\icons\costumer-service.png"
                      className="size-4 md:mr-2 invert"
                    />
                    <span className="hidden md:inline">
                      {supportRequestExists
                        ? "Support Requested"
                        : "Technical Support"}
                    </span>
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={8}
                className={cn(
                  "max-w-[220px] text-center text-xs leading-relaxed text-white rounded-xl px-3 py-2 shadow-lg",
                  supportRequestExists
                    ? "bg-slate-800 border-slate-700"
                    : "bg-indigo-700 border-indigo-600",
                )}
              >
                {supportRequestExists
                  ? "A technical support request has already been submitted for this quote."
                  : "Stuck with your quote? Click here to request technical support from our team 👋"}
              </TooltipContent>
            </Tooltip>
            <Button
              className="bg-gray-300 hover:bg-gray-400 text-black hover:text-white transition-colors relative flex-shrink-0 text-sm md:text-base"
              onClick={() => setShowArchiveModal(true)}
            >
              <Archive className="size-4 md:mr-2" />
              <span className="hidden md:inline">Archive</span>
              {archivedParts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {archivedParts.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row max-w-[1440px] mx-auto">
          {/* LEFT MAIN CONTENT (PARTS) */}
          <div
            ref={partsContainerRef}
            className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 overflow-scroll invisible-scrollbar space-y-6 md:space-y-8 pb-32"
          >
            {parts.map((part, index) => {
              // Get process-specific materials, tolerances, and finishes
              const processMaterials = getMaterialsForProcess(part.process);
              const processTolerances =
                part.process === "sheet-metal" ||
                part.process?.includes("sheet")
                  ? SHEET_METAL_TOLERANCES_LIST
                  : TOLERANCES_LIST;
              const processFinishes =
                part.process === "sheet-metal" ||
                part.process?.includes("sheet")
                  ? SHEET_METAL_FINISHES_LIST
                  : FINISHES_LIST;

              return (
                <PartCardItem
                  key={index}
                  part={part}
                  index={index}
                  updatePart={updatePart}
                  updatePartFields={updatePartFields}
                  handleDeletePart={handleDeletePart}
                  handleArchivePart={handleArchivePart}
                  calculatePrice={calculatePrice}
                  MATERIALS_LIST={processMaterials}
                  TOLERANCES_LIST={processTolerances}
                  FINISHES_LIST={processFinishes}
                  THREAD_OPTIONS={THREAD_OPTIONS}
                  INSPECTIONS_OPTIONS={INSPECTION_OPTIONS}
                  isSelected={selectedParts.has(part.id)}
                  onToggleSelection={() => togglePartSelection(part.id)}
                  suggestionPart={suggestionPart}
                  setSuggestionPart={(part: string) => setSuggestionPart(part)}
                />
              );
            })}

            {/* Part Upload Skeletons */}
            {uploadingFiles.map((fileName, index) => (
              <PartCardSkeleton key={`skeleton-${index}`} fileName={fileName} />
            ))}

            {/* Add Part Button */}
            <div className="pt-6 md:pt-8 w-full">
              <div
                {...getRootProps()}
                className={`bg-gradient-to-br from-white to-slate-50/80 rounded-xl md:rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-300 cursor-pointer ${
                  isDragActive
                    ? "border-blue-500 border-dashed bg-blue-50/50 shadow-lg scale-[1.01]"
                    : "border-slate-200 hover:border-blue-400 border-dashed hover:shadow-md"
                }`}
              >
                <input {...getInputProps()} />

                {/* Upload Area */}
                <div className="p-6 md:p-8 lg:p-12 bg-white/50 flex flex-col items-center justify-center gap-3 md:gap-4 text-center border-b border-slate-200">
                  {is3DFileUploading ? (
                    <div className="flex flex-col items-center justify-center py-6">
                      <div className="p-4 bg-blue-50 rounded-2xl mb-4 relative">
                        <div className="absolute inset-0 bg-blue-400 opacity-20 blur-xl rounded-full animate-pulse"></div>
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin relative z-10" />
                      </div>
                      <p className="font-bold text-xl mb-2 text-slate-900 animate-pulse">
                        Analyzing Geometry...
                      </p>
                      <p className="text-sm text-slate-500 max-w-xs mx-auto">
                        Please wait while we upload and process your CAD files
                        for manufacturing analysis.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`p-3 md:p-4 bg-gradient-to-br rounded-xl md:rounded-2xl transition-all shadow-sm ${
                          isDragActive
                            ? "from-blue-200 to-blue-100 scale-110"
                            : "from-blue-50 to-slate-50"
                        }`}
                      >
                        <Upload
                          className={`w-8 h-8 md:w-10 md:h-10 transition-colors ${
                            isDragActive ? "text-blue-700" : "text-blue-600"
                          }`}
                        />
                      </div>
                      <div>
                        <p
                          className={`font-bold text-lg md:text-xl mb-2 transition-colors ${
                            isDragActive ? "text-blue-700" : "text-slate-900"
                          }`}
                        >
                          {isDragActive
                            ? "Drop your files here"
                            : "Add Another Part"}
                        </p>
                        <p className="text-xs md:text-sm text-slate-500 max-w-xs mx-auto">
                          {isDragActive
                            ? "Release to upload your CAD files"
                            : "Click to upload or drag and drop your CAD files here"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center mt-2">
                        {["STEP", "STL", "IGES", "OBJ", "and More"].map(
                          (fmt) => (
                            <span
                              key={fmt}
                              className={`px-2 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-medium rounded-md transition-colors ${
                                isDragActive
                                  ? "bg-blue-200 text-blue-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {fmt}
                            </span>
                          ),
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR (FIXED) */}
          <div className="w-full lg:w-[300px] xl:w-[400px] lg:py-10 lg:flex-shrink-0 z-30">
            <div className="lg:sticky lg:top-[85px] custom-scrollbar">
              <div className="backdrop-blur-xl border bg-white border-white/60 shadow-xl rounded-2xl p-6 flex flex-col gap-6">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                  <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                    <ScrollText className="w-5 h-5" />
                  </div>
                  <h2 className="text-base md:text-lg font-bold text-slate-800">
                    Order Summary
                  </h2>
                </div>

                {/* Mini Breakdown */}
                <div className="space-y-3 max-h-[calc(100vh-85px)] overflow-y-auto custom-scrollbar pr-1">
                  {parts.map((p, i) => {
                    const isManual = p.process === "manual-quote";
                    const isProcessing = [
                      RFQPartStatus.Queued,
                      RFQPartStatus.Processing,
                    ].includes(p.status);
                    const pPrice = p.final_price || 0;
                    const calculatedLeadTime = p.leadTime || 0;
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
                          {(!isManual || !isProcessing) && (
                            <span className="text-xs text-slate-500">
                              Qty: {p.quantity} |{" "}
                              {LEAD_TIME_SHORT[p.leadTimeType]} (
                              {calculatedLeadTime} Business Days)
                            </span>
                          )}
                        </div>
                        <span className="font-semibold mt-0.5 text-slate-700">
                          {isManual || isProcessing
                            ? "-"
                            : formatCurrencyFixed(pPrice)}
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
                    <span className="text-slate-600 font-medium">
                      Shipping & Logistics
                    </span>
                    <span className="font-semibold text-green-600">
                      Complimentary
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-medium">
                      Tax & Duties
                    </span>
                    <span className="font-semibold text-green-600">
                      Included
                    </span>
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

                <div className="flex flex-col gap-4 mt-6">
                  {!isManualQuote ? (
                    <>
                      {/* Primary Checkout Button */}
                      <Button
                        size="lg"
                        onClick={handleCheckout}
                        disabled={saving}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.5)] rounded-2xl h-16 text-lg font-bold transition-all hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
                      >
                        <div className="flex items-center justify-center w-full">
                          {saving ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <>
                              Make Payment
                              <div className="ml-3 bg-white/20 p-1.5 rounded-xl group-hover:bg-white/30 transition-colors">
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                              </div>
                            </>
                          )}
                        </div>
                      </Button>
                    </>
                  ) : (
                    /* Primary Manual Quote Button (Full style when all parts are manual) */
                    <Button
                      size="lg"
                      onClick={() => setShowManualQuoteModal(true)}
                      disabled={saving}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.5)] rounded-2xl h-16 text-lg font-bold transition-all hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-center w-full">
                        {saving ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            Request Manual Quote
                            <div className="ml-3 bg-white/20 p-1.5 rounded-xl group-hover:bg-white/30 transition-colors">
                              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </>
                        )}
                      </div>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Area - Minimal */}
        <ManualExceededModal
          isOpen={
            showManualExceededModal || (exceeded && !hasDismissedExceededModal)
          }
          manualPartsCount={manualParts.length}
          onMoveToManual={async () => {
            setHasDismissedExceededModal(true);
            setShowManualExceededModal(false);
            setShowManualQuoteModal(true);
          }}
          onDeleteManual={async () => {
            // Logic to delete manual parts
            await handleBulkDelete(new Set(manualPartIds));
            setShowManualExceededModal(false);
          }}
          onClose={() => {
            setHasDismissedExceededModal(true);
            setShowManualExceededModal(false);
          }}
          metadata={{
            partSnapshots: getManualQuoteSnapshots() || [],
          }}
        />

        <UploadFileModal
          open={showUploadModal}
          setOpen={setShowUploadModal}
          parts={parts}
          saveAsDraft={handleSaveDraft}
          setParts={setParts}
        />

        {/* Archive Modal */}
        <ArchiveModal
          showArchiveModal={showArchiveModal}
          setShowArchiveModal={setShowArchiveModal}
          archivedParts={archivedParts}
          MATERIALS_LIST={MATERIALS_LIST}
          FINISHES_LIST={FINISHES_LIST}
          handleUnarchivePart={handleUnarchivePart}
          handleUnarchiveAll={handleUnarchiveAll}
        />

        <ManualQuoteModal
          showManualQuoteModal={showManualQuoteModal}
          setShowManualQuoteModal={setShowManualQuoteModal}
          isSubmitting={false}
          handleSubmit={handleManualQuote}
          submitLable="Submit Request"
          parts={parts.filter((part) => part.process === "manual-quote")}
          updatePart={updatePartById}
        />

        <ManualQuoteWarningModal
          isOpen={showManualWarningModal}
          onRedirectToQuotes={() => router.push("/portal/quotes")}
          onRedirectToCheckout={() => router.push(`/checkout/${quoteId}`)}
          showCheckout={rfq.status === "pending approval"}
        />

        <TechnicalSupportModal
          isOpen={showTechnicalSupportModal}
          onClose={() => setShowTechnicalSupportModal(false)}
          rfqId={rfq.id}
          rfqCode={rfq.rfq_code}
          onSuccess={() => setSupportRequestExists(true)}
        />

        {/* Suggestion Sidebar */}
        <SuggestionSidebar
          parts={parts}
          onApplySuggestion={handleApplySuggestion}
          filterPart={suggestionPart}
        />

        <FloatingActions
          count={selectedParts.size}
          totalCount={parts.length}
          onClear={exitSelectionMode}
          itemLabel="part"
          actions={[
            {
              label:
                selectedParts.size === parts.length
                  ? "Deselect All"
                  : "Select All",
              icon:
                selectedParts.size === parts.length ? (
                  <Square className="w-4 h-4" />
                ) : (
                  <CheckSquare className="w-4 h-4" />
                ),
              variant: "outline",
              onClick: toggleSelectAll,
            },
            {
              label: "Archive",
              icon: <Archive className="w-4 h-4" />,
              variant: "outline",
              onClick: handleBulkArchive,
              disabled: selectedParts.size === 0,
            },
            {
              label: "Delete Selected",
              icon: <Trash2 className="w-4 h-4" />,
              variant: "destructive",
              onClick: () => handleBulkDelete(selectedParts),
              disabled: selectedParts.size === 0,
            },
            {
              label: "Cancel",
              icon: <X className="w-4 h-4" />,
              variant: "ghost",
              onClick: exitSelectionMode,
            },
          ]}
        />

        {/* Scroll Indicator */}
        {showScrollIndicator && (
          <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-opacity duration-300">
            <div className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-full bg-white shadow-lg border border-gray-200 animate-bounce">
              {/* Icon */}
              <ChevronDown className="w-4 h-4 text-blue-600" />

              {/* Text */}
              <p className="text-xs font-medium text-gray-700 whitespace-nowrap">
                {parts.length > 1
                  ? "Scroll to view all parts"
                  : "Add more parts"}
              </p>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </SuggestionProvider>
  );
}
