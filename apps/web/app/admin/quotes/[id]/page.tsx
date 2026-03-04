"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { formatCurrencyGeneric } from "@/lib/format";
import CustomLoader from "@/components/ui/loader/CustomLoader";
import { useMetaStore } from "@/components/store/title-store";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  X,
  Info,
  CheckCircle2,
  Save,
  Clock,
  DollarSign,
  ArrowLeft,
  Settings2,
  Download,
  Trash2,
  Ghost,
  User2,
  Mail,
  Building2,
  Phone,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { CadViewer } from "@/components/cad/cad-viewer";
import { metalTranslation } from "@cnc-quote/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { isCNCProcess, isSheetMetalProcess } from "@/lib/pricing-engine";
import EditPartSpecsModal from "./components/edit-part-specs-modal";
import { notify } from "@/lib/toast";

/* =======================
   TYPES
======================= */

export type IRFQFull = {
  rfq: {
    id: string;
    rfq_code: string;
    status: string;
    final_price: number | null;
    rfq_type: "general" | "manual";
    created_at: string;
    manual_quote_metadata?: Record<string, any>;
    user_id: string;
    users?: {
      email: string;
      name: string;
      phone: string;
    };
    organizations?: {
      name: string;
    };
  };
  parts: Array<{
    id: string;
    file_name: string;
    material: string;
    finish: string;
    tolerance: string;
    inspection: string;
    notes: string;
    cad_file_url: string;
    snapshot_2d_url: string | null;
    quantity: number;
    final_price: number | null;
    lead_time: number | null;
    lead_time_type: string | null;
    process?: string;
    certificates?: string[];
    sheet_thickness_mm?: number;
    abandoned_reason?: string;
    abandoned_at?: string;
  }>;
  abandoned: Array<{
    id: string;
    file_name: string;
    material: string;
    finish: string;
    tolerance: string;
    inspection: string;
    notes: string;
    cad_file_url: string;
    snapshot_2d_url: string | null;
    quantity: number;
    final_price: number | null;
    lead_time: number | null;
    lead_time_type: string | null;
    process?: string;
    certificates?: string[];
    sheet_thickness_mm?: number;
    abandoned_reason?: string;
    abandoned_at?: string;
  }> | null;
};

/* =======================
   PAGE
======================= */

export default function AdminQuoteDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const [data, setData] = useState<IRFQFull>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPart, setSelectedPart] = useState<
    IRFQFull["parts"][number] | null
  >(null);
  const [activeTab, setActiveTab] = useState<"active" | "abandoned">("active");

  // Admin Editing State
  const [partPrices, setPartPrices] = useState<Record<string, number>>({});
  const [partLeadTimes, setPartLeadTimes] = useState<Record<string, number>>(
    {},
  );
  const [editingPart, setEditingPart] = useState<
    IRFQFull["parts"][number] | null
  >(null);

  const { setPageTitle, resetTitle } = useMetaStore();
  const router = useRouter();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/rfq/${id}`);
      const rfqData = response.data as IRFQFull;
      setData(rfqData);

      // Initialize editing state
      const prices: Record<string, number> = {};
      const leadTimes: Record<string, number> = {};
      rfqData.parts.forEach((part) => {
        prices[part.id] = part.final_price || 0;
        leadTimes[part.id] = part.lead_time || 0;
      });
      setPartPrices(prices);
      setPartLeadTimes(leadTimes);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error fetching quote",
        description: "Could not load quote details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    setPageTitle("Quote");
    return () => {
      resetTitle();
    };
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalCalculated = useMemo(() => {
    if (!data) return 0;
    return data.parts.reduce((acc, part) => {
      const price = partPrices[part.id] || 0;
      return acc + price * part.quantity;
    }, 0);
  }, [data, partPrices]);

  const handleDownload = (part: IRFQFull["parts"][number]) => {
    const link = document.createElement("a");
    link.href = part.cad_file_url;
    link.download = part.file_name ?? "cad-file";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncPricing = async (shouldApprove = false) => {
    if (!data) return;
    setSaving(true);
    try {
      // 1. Sync Pricing
      await apiClient.post(`/rfq/${data.rfq.id}/sync-pricing`, {
        rfq_final_price: totalCalculated,
        parts: data.parts.map((p) => ({
          id: p.id,
          final_price: partPrices[p.id] || 0,
          lead_time: partLeadTimes[p.id] || 0,
        })),
      });

      // 2. If shouldApprove, update RFQ status to 'quoted'
      if (shouldApprove) {
        await apiClient.patch(`/rfq/${data.rfq.id}`, {
          status: "quoted",
        });
      }

      toast({
        title: shouldApprove ? "Quote Published" : "Changes Saved",
        description: `Successfully updated pricing for ${data.rfq.rfq_code}`,
      });

      fetchData();
    } catch (error) {
      console.error(error);
      toast({
        title: "Update failed",
        description: "An error occurred while saving pricing.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePartSpecs = async (updatedFields: any) => {
    if (!editingPart || !data) return;
    setSaving(true);
    try {
      await apiClient.patch(
        `/rfq/${data.rfq.id}/parts/${editingPart.id}`,
        updatedFields,
      );

      toast({
        title: "Specifications Updated",
        description: `Successfully updated details for ${editingPart.file_name}`,
      });

      setEditingPart(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast({
        title: "Update failed",
        description: "An error occurred while saving specifications.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const processValidators: Record<string, (part: any) => boolean> = {
    "sheet-metal": (part) => Boolean(part.sheet_thickness_mm),
    "cnc-machining": (part) => Boolean(part.tolerance),
  };

  const validateParts = () => {
    return (data?.parts ?? []).every((part) => {
      const hasBasicSpecs =
        part.quantity > 0 && part.material && part.finish && part.inspection;

      const price = partPrices[part.id] || 0;
      const leadTime = partLeadTimes[part.id] || 0;
      const hasPricing = price > 0 && leadTime > 0;

      if (!hasBasicSpecs || !hasPricing) {
        return false;
      }

      // Determine which validator to use
      let processKey = "cnc-machining"; // default
      if (isSheetMetalProcess(part.process)) {
        processKey = "sheet-metal";
      } else if (isCNCProcess(part.process)) {
        processKey = "cnc-machining";
      }

      const validator = processValidators[processKey];
      return validator ? validator(part) : false;
    });
  };

  const handleSendQuote = async () => {
    // Prevent double-clicks
    if (saving || !data?.rfq.id) return;

    if (!validateParts()) {
      notify.error("Part are incomplete please check all the values");
      return;
    }

    setSaving(true);

    try {
      // 1. Save pricing first to ensure totals are updated
      await apiClient.post(`/rfq/${data.rfq.id}/sync-pricing`, {
        rfq_final_price: totalCalculated,
        parts: data.parts.map((p) => ({
          id: p.id,
          final_price: partPrices[p.id] || 0,
          lead_time: partLeadTimes[p.id] || 0,
        })),
      });

      // 2. Send the quote
      const res = await apiClient.post(`/rfq/send-quote/${data.rfq.id}`, {
        userId: data.rfq.user_id,
      });

      if (res.status === 200 || res.status === 201 || res.data) {
        notify.success("Quote sent successfully");
        fetchData(); // Refresh data to show updated status/totals
      } else {
        throw new Error("Unexpected response");
      }
    } catch (error) {
      console.error("Quote Sending Error:", error);
      notify.error("Failed to send quote. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <CustomLoader />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4">
        <div className="text-xl font-semibold text-slate-600">
          Quote not found
        </div>
        <button
          onClick={() => router.push("/admin/quotes")}
          className="text-indigo-600 hover:underline"
        >
          Back to Admin Quotes
        </button>
      </div>
    );
  }

  const isManual = data.rfq.rfq_type === "manual";

  return (
    <div className="relative max-w-7xl h-full mx-auto px-4 py-4 space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="rounded-full h-10 w-10 p-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Quote Administration
          </span>
          <h1 className="text-2xl font-bold text-slate-900">
            {data.rfq.rfq_code}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <StatusPill status={data.rfq.status} />
          {isManual && (
            <>
              <Button
                variant="outline"
                onClick={() => handleSyncPricing(false)}
                disabled={saving}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </Button>
              <Button
                onClick={() => handleSendQuote()}
                disabled={saving}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                Submit Quote
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Admin Information Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex gap-6 items-center shadow-xl shadow-slate-200">
        <div className="bg-white/10 p-3 rounded-2xl">
          <Package className="w-8 h-8 text-indigo-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Pricing Overview</h2>
          <p className="text-slate-400 text-sm">
            Review parts, set unit prices, and lead times for this request.
          </p>
        </div>
        <div className="h-12 w-px bg-white/10" />
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Total Quote Value
          </p>
          <p className="text-3xl font-black text-white">
            {formatCurrencyGeneric(totalCalculated)}
          </p>
        </div>
      </div>

      {/* User & Organization Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
              <User2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Customer
              </p>
              <p className="text-base font-bold text-slate-900 truncate">
                {data.rfq.users?.name || "Unknown User"}
              </p>
            </div>
          </div>

          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Email Address
            </p>
            <p className="text-sm font-medium text-slate-600 truncate">
              {data.rfq.users?.email || "N/A"}
            </p>
          </div>

          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Phone Number
            </p>
            <p className="text-sm font-medium text-slate-600">
              {data.rfq.users?.phone || "N/A"}
            </p>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
            <div className="bg-amber-50 p-2.5 rounded-xl text-amber-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Organization
              </p>
              <p className="text-base font-bold text-slate-900 truncate">
                {data.rfq.organizations?.name || "Individual"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Banner (Similar to Portal) */}
      {isManual && (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex gap-3 items-start">
          <div className="bg-indigo-100/50 p-1.5 rounded-lg text-indigo-600">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-indigo-900 text-sm">
              Manual Review Mode
            </h3>
            <p className="text-indigo-800/70 text-sm">
              This quote was flagged for manual review by the customer for
              custom engineering specifications.
            </p>
            {data.rfq.manual_quote_metadata && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(data.rfq.manual_quote_metadata).map(
                  ([key, value]) => (
                    <div
                      key={key}
                      className="bg-white/60 border border-indigo-200/30 rounded-lg px-3 py-1.5 flex items-center gap-2"
                    >
                      <span className="text-[9px] uppercase font-bold text-indigo-600/60 tracking-wider">
                        {key.replace(/_/g, " ")}:
                      </span>
                      <span className="text-xs text-indigo-900 font-medium">
                        {String(value)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABS SECTION */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl relative border border-slate-200 w-fit">
        {[
          { id: "active", label: "Active Parts", icon: Package },
          { id: "abandoned", label: "Abandoned", icon: Ghost },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "relative px-6 py-2 rounded-lg text-sm font-bold transition-colors duration-200 flex items-center gap-2",
              activeTab === tab.id
                ? "text-white"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-tab-admin"
                className="absolute inset-0 bg-slate-900 rounded-[8px] shadow-sm"
                transition={{
                  type: "spring",
                  bounce: 0.15,
                  duration: 0.5,
                }}
              />
            )}
            <tab.icon className="w-4 h-4 relative z-10" />
            <span className="relative z-10">
              {tab.label} (
              {tab.id === "active"
                ? data.parts.length
                : data.abandoned?.length || 0}
              )
            </span>
          </button>
        ))}
      </div>

      {/* PARTS LIST WITH EDITING */}
      <section className="space-y-4 mb-4">
        <SectionTitle
          title={
            activeTab === "active"
              ? "Parts & Quotation Details"
              : "Abandoned Parts"
          }
        />
        <div className="grid grid-cols-1 gap-6">
          {(activeTab === "active" ? data.parts : data.abandoned || []).map(
            (part) => (
              <div
                key={part.id}
                className={cn(
                  "group flex bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-indigo-400/50 transition-all duration-300",
                  activeTab === "abandoned" && "opacity-80 grayscale-[0.5]",
                )}
              >
                {/* Part Visual */}
                <div
                  onClick={() => setSelectedPart(part)}
                  className="w-48 bg-slate-50 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors border-r"
                >
                  {part.snapshot_2d_url ? (
                    <img
                      src={part.snapshot_2d_url}
                      alt={part.file_name}
                      className="max-h-full max-w-full object-contain p-4 mix-blend-multiply"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-400">
                      <Package className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Part Details */}
                <div className="p-6 flex-1 grid grid-cols-1 xl:grid-cols-12 gap-8 items-center">
                  {/* Technical Specs - Cols 1-5 */}
                  <div className="xl:col-span-5 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-slate-900 truncate text-lg">
                          {part.file_name}
                        </h3>
                        {part.process && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600 border-slate-200"
                          >
                            {part.process.replace(/-/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span>Qty: {part.quantity} units</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-6 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Material
                        </span>
                        <span className="text-sm font-semibold text-slate-700">
                          {(metalTranslation as any)[part.material] ??
                            part.material}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Finish
                        </span>
                        <span className="text-sm font-semibold text-slate-700">
                          {part.finish}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {part.sheet_thickness_mm ? "Thickness" : "Tolerance"}
                        </span>
                        <span className="text-sm font-semibold text-slate-700">
                          {part.sheet_thickness_mm
                            ? `${part.sheet_thickness_mm} mm`
                            : part.tolerance}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Inspection
                        </span>
                        <span className="text-sm font-semibold text-slate-700">
                          {part.inspection || "Standard"}
                        </span>
                      </div>
                      {part.certificates && part.certificates.length > 0 && (
                        <div className="col-span-2 border-t border-slate-100 pt-2 mt-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Certifications
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {part.certificates.map((cert) => (
                              <span
                                key={cert}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 shadow-sm"
                              >
                                {cert.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Commercials - Cols 6-9 */}
                  <div className="xl:col-span-4 flex flex-col justify-center space-y-4 border-t border-slate-100 pt-6 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-8">
                    {activeTab === "active" ? (
                      isManual ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <DollarSign className="w-3 h-3 text-indigo-500" />
                              Unit Price (USD)
                            </label>
                            <Input
                              type="number"
                              value={partPrices[part.id] || ""}
                              onChange={(e) =>
                                setPartPrices((prev) => ({
                                  ...prev,
                                  [part.id]: parseFloat(e.target.value) || 0,
                                }))
                              }
                              placeholder="0.00"
                              className="h-11 rounded-xl border-slate-200 focus:ring-indigo-500 font-semibold text-base"
                            />
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500">Total:</span>
                              <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                {formatCurrencyGeneric(
                                  (partPrices[part.id] || 0) * part.quantity,
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              Lead Time (Days)
                            </label>
                            <Input
                              type="number"
                              value={partLeadTimes[part.id] || ""}
                              onChange={(e) =>
                                setPartLeadTimes((prev) => ({
                                  ...prev,
                                  [part.id]: parseInt(e.target.value) || 0,
                                }))
                              }
                              placeholder="0"
                              className="h-11 rounded-xl border-slate-200 focus:ring-indigo-500 font-semibold"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <DollarSign className="w-3 h-3 text-slate-400" />
                              Quote Price
                            </label>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold text-slate-900">
                                {formatCurrencyGeneric(part.final_price || 0)}
                              </span>
                              <span className="text-xs font-medium text-slate-500">
                                / unit
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              Total:{" "}
                              {formatCurrencyGeneric(
                                (part.final_price || 0) * part.quantity,
                              )}
                            </div>
                          </div>

                          <div className="space-y-1 mt-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Lead Time
                            </label>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-bold text-slate-900">
                                {part.lead_time || "-"}
                              </span>
                              <span className="text-sm font-medium text-slate-500">
                                days
                              </span>
                            </div>
                          </div>
                        </>
                      )
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                          <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">
                            <Trash2 className="w-3 h-3" />
                            Abandonment Reason
                          </span>
                          <p className="text-sm text-rose-900 font-medium leading-relaxed">
                            {part.abandoned_reason || "No reason provided"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">
                          <Clock className="w-3 h-3" />
                          Abandoned{" "}
                          {part.abandoned_at
                            ? formatDate(part.abandoned_at)
                            : "N/A"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions - Cols 10-12 */}
                  <div className="xl:col-span-3 flex flex-col justify-center gap-3 border-t border-slate-100 pt-6 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-8">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-10 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 text-xs font-bold uppercase tracking-widest border-indigo-100"
                        onClick={() => setSelectedPart(part)}
                      >
                        View 3D
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 p-0 text-slate-400 hover:text-indigo-600 border-slate-200 hover:border-indigo-200"
                        onClick={() => handleDownload(part)}
                        title="Download CAD File"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                    {isManual && activeTab === "active" && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest w-full gap-2 shadow-lg shadow-slate-200"
                        onClick={() => setEditingPart(part)}
                      >
                        <Settings2 className="w-3 h-3" />
                        Edit Specs
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {/* SIDE DRAWER (Same as Portal) */}
      {selectedPart && (
        <RfqDetailDrawer
          part={selectedPart}
          onClose={() => setSelectedPart(null)}
        />
      )}

      {/* SPECS EDIT MODAL */}
      {editingPart && (
        <EditPartSpecsModal
          isOpen={!!editingPart}
          onClose={() => setEditingPart(null)}
          part={editingPart}
          onSave={handleSavePartSpecs}
          isSaving={saving}
        />
      )}
    </div>
  );
}

/* =======================
   REUSABLE COMPONENTS
======================= */

function StatusPill({ status }: { status: string }) {
  const getStatusColor = (s: string) => {
    switch (s.toLowerCase()) {
      case "draft":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "submitted":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "quoted":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      case "accepted":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "paid":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "pending":
      case "pending approval":
      case "payment pending":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "rejected":
        return "bg-rose-100 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <span
      className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(status)}`}
    >
      {status}
    </span>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
      {title}
    </h2>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function RfqDetailDrawer({
  part,
  onClose,
}: {
  part: IRFQFull["parts"][number];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[1400px] h-full max-h-[850px] bg-white rounded-[32px] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-white/20">
        <div className="flex-1 bg-[#0a0a0f] relative min-h-[300px]">
          <div className="absolute inset-0">
            <CadViewer
              file={part.cad_file_url}
              showControls={true}
              autoResize={true}
              zoom={0.5}
            />
          </div>
          <div className="absolute top-6 right-6 z-10">
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md gap-2 h-9 px-4 text-xs font-bold uppercase tracking-wider"
              onClick={() => window.open(part.cad_file_url, "_blank")}
            >
              <Download className="w-3.5 h-3.5" />
              Download Source
            </Button>
          </div>
        </div>
        <div className="w-full md:w-[450px] flex flex-col h-full bg-white border-l border-slate-100">
          <div className="p-8 border-b border-slate-100 flex justify-between items-start">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-3">
                <Package className="w-3 h-3" /> Technical Specification
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {part.file_name.split(".")[0]}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-slate-50 rounded-2xl transition-all duration-200 text-slate-400 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
            <section>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-500" /> Technical
                Details
              </h3>
              <div className="grid gap-y-1">
                <Detail
                  label="Material"
                  value={
                    (metalTranslation as any)[part.material] ?? part.material
                  }
                />
                <Detail label="Finishing" value={part.finish} />
                <Detail label="Tolerance" value={part.tolerance} />
                <Detail
                  label="Inspection"
                  value={part.inspection || "Standard"}
                />
              </div>
            </section>
            {part.notes && (
              <section>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />{" "}
                  Additional Notes
                </h3>
                <div className="p-6 bg-slate-50 rounded-[28px] text-sm text-slate-600 leading-relaxed italic border border-slate-100">
                  "{part.notes}"
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
