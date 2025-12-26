"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { analyzeCADFile } from "../../../lib/cad-analysis";
import {
  calculatePricing,
  getMaterial,
  getFinish,
  PROCESSES,
  MATERIALS,
  FINISHES,
} from "../../../lib/pricing-engine";
import { PartCardItem } from "../components/part-card-item";
import { useDropzone } from "react-dropzone";
import {
  formatCurrencyFixed,
  LEAD_TIME_SHORT,
  processParts,
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

type IRFQ = {
  id: string;
  rfq_code: string;
  status: string;
  user_id: string;
};

// --- Moved Helper Functions ---

export const calculateLeadTime = (
  part: PartConfig,
  tier?: "economy" | "standard" | "expedited",
) => {
  if (!part.geometry) return 7;

  const material = getMaterial(part.material);
  if (!material) return 7;

  const process = PROCESSES["cnc-milling"];
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
  tier: "economy" | "standard" | "expedited" = "economy",
): number => {
  if (!part.geometry) return 0;

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
    leadTimeType: tier,
  });

  return pricing.totalPrice;
};

export default function QuoteConfigPage() {
  const router = useRouter();
  const paramsHook = useParams();
  const quoteId = paramsHook?.id as string;

  const [rfq, setRfq] = useState<IRFQ>({} as IRFQ);
  const [parts, setParts] = useState<PartConfig[]>([]);
  // currentPartIndex removed as we list all parts
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [is3DFileUploading, setIs3DFileUploading] = useState(false);

  const [archivedParts, setArchivedParts] = useState<PartConfig[]>([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Bulk selection state
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set()); // Track parts with pending changes
  const [showUploadModal, setShowUploadModal] = useState(false);

  const session = useSession();

  const { upload } = useFileUpload();

  // Dropzone callback for drag and drop
  const onDropFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setIs3DFileUploading(true);

      try {
        const newParts = [];

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

          const newPart: any = {
            file_name: file.name,
            cad_file_url: uploadedPath,
            cad_file_type: file.type,
            material: "aluminum-6061",
            quantity: 1,
            status: "active",
            tolerance: "standard",
            finish: "as-machined",
            threads: "none",
            inspection: "standard",
            notes: "",
            lead_time_type: "standard",
            lead_time: 0,
            geometry,
            pricing: undefined,
            final_price: 0,
            certificates: [],
          };
          newPart.final_price = calculatePrice(newPart);
          newPart.lead_time = calculateLeadTime(newPart, "standard");
          newParts.push(newPart);
        }
        const { data } = await apiClient.post(`/rfq/${rfq.id}/add-parts`, {
          parts: newParts,
        });

        if (!data) {
          notify.error("Failed to add parts");
          return;
        }

        const proccessedParts = processParts(data.parts);

        setParts((prev) => [...prev, ...proccessedParts]);
        notify.success(`Successfully added ${newParts.length} part(s)`);
      } catch (error) {
        console.error("Error processing files:", error);
        notify.error("Failed to process files");
      } finally {
        setIs3DFileUploading(false);
      }
    },
    [parts.length, upload],
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
  const handleBulkDelete = async () => {
    if (selectedParts.size === 0) return;

    if (parts.length - selectedParts.size === 0) {
      notify.error("Cannot delete all parts. At least one part is required.");
      return;
    }

    await deleteParts(Array.from(selectedParts));
    setSelectedParts(new Set());
    notify.success(`Deleted ${selectedParts.size} part(s)`);
  };

  // Exit selection mode when no parts are selected
  const exitSelectionMode = () => {
    setSelectedParts(new Set());
  };

  // Removed strict authentication check to allow guest access for temp quotes

  useEffect(() => {
    async function loadQuote() {
      if (!quoteId) return;

      try {
        setLoading(true);

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

            const processedParts: PartConfig[] = apiPartsRaw.map(
              (p: any, index: number) => {
                const part: PartConfig = {
                  id: p.id || `part-${index + 1}`,
                  rfqId: p.rfq_id,
                  status: p.status || "active",
                  fileName: p.file_name,
                  filePath: p.cad_file_url,
                  fileObject: undefined, // URL only
                  material: p.material || "aluminum-6061",
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
                  files2d: (p.files2d || []).map((f: any) => ({
                    file: {
                      name: f.file_name || "Drawing",
                      type: f.mime_type || "application/pdf",
                      size: 0,
                      id: f.id,
                    },
                    preview: f.file_url,
                  })),
                };

                // Recalculate Pricing Object
                if (part.geometry) {
                  const material = getMaterial(part.material);
                  if (material) {
                    const process = PROCESSES["cnc-milling"];
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

                // Check for discrepancies
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

                return part;
              },
            );

            // Check RFQ Total Sync
            const dbRfqTotal = currentRfq.final_price
              ? Number(currentRfq.final_price)
              : 0;
            if (Math.abs(rfqTotalCalculated - dbRfqTotal) > 0.01) {
              syncNeeded = true;
            }

            if (syncNeeded) {
              console.log("Syncing pricing with backend...", {
                partsToSync,
                rfqTotalCalculated,
              });
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
        setLoading(false);
      }
    }

    loadQuote();
  }, [quoteId, router, session.status]);

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

  const standardPrice = parts.reduce(
    (sum, part) => sum + (part.final_price || 0),
    0,
  );

  const handleSaveDraft = async (
    message: string = "Draft saved successfully",
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
        apiClient.patch(`/rfq/${rfq.id}`, { final_price: standardPrice }),
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

  const handleCheckout = async () => {
    try {
      setSaving(true);
      // Ensure all changes are saved before checkout logic if needed
      if (unsavedChanges.size > 0) {
        await handleSaveDraft("Quote changes saved successfully");
      }

      if (standardPrice < 150) {
        notify.error(
          "Please revise the quote to a minimum value of $150 to proceed.",
        );
        return;
      }

      router.push(`/checkout/${quoteId}`);
    } catch (error) {
      console.error("Error saving configuration:", error);
      notify.error("Failed to save configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Handle applying suggestions
  const handleApplySuggestion = (suggestion: any) => {
    const partIndex = parts.findIndex((p) => p.id === suggestion.partId);
    if (partIndex === -1) return;

    switch (suggestion.type) {
      case "quantity":
        updatePart(partIndex, "quantity", suggestion.suggestedValue, true);
        notify.success(`Quantity updated to ${suggestion.suggestedValue}`);
        break;
      case "material":
        updatePart(partIndex, "material", suggestion.suggestedValue, true);
        notify.success(`Material updated to ${suggestion.suggestedValue}`);
        break;
      case "finish":
        updatePart(partIndex, "finish", suggestion.suggestedValue, true);
        notify.success(`Finish updated to ${suggestion.suggestedValue}`);
        break;
      case "leadtime":
        updatePart(partIndex, "leadTimeType", "standard", true);
        notify.success("Lead time updated to Standard");
        break;
      default:
        break;
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
                onClick={() => setShowUploadModal(true)}
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
                    onClick={() => signOut()}
                    className="text-slate-700 cursor-pointer rounded-lg focus:bg-slate-50 focus:text-blue-600 p-2"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => signOut()}
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
            {rfq.rfq_code}
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
          className="bg-gray-300 hover:bg-gray-400 text-black hover:text-white transition-colors relative"
          onClick={() => setShowArchiveModal(true)}
        >
          <Archive className="size-4 mr-2" />
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
              updatePart={updatePart}
              updatePartFields={updatePartFields}
              handleDeletePart={handleDeletePart}
              handleArchivePart={handleArchivePart}
              calculatePrice={calculatePrice}
              MATERIALS_LIST={MATERIALS_LIST}
              TOLERANCES_LIST={TOLERANCES_LIST}
              FINISHES_LIST={FINISHES_LIST}
              THREAD_OPTIONS={THREAD_OPTIONS}
              INSPECTIONS_OPTIONS={INSPECTION_OPTIONS}
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
                      Please wait while we upload and process your CAD files for
                      manufacturing analysis.
                    </p>
                  </div>
                ) : (
                  <>
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
                        {isDragActive
                          ? "Drop your files here"
                          : "Add Another Part"}
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
                  </>
                )}
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

      {/* Suggestion Sidebar */}
      <SuggestionSidebar
        parts={parts}
        onApplySuggestion={handleApplySuggestion}
      />

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
