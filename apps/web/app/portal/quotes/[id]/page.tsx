"use client";

import { useEffect, useState, useCallback } from "react";
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
  CreditCard,
  Clock,
  DollarSign,
  Download,
  ArrowLeft,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CadViewer } from "@/components/cad/cad-viewer";
import { metalTranslation } from "@cnc-quote/shared";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PartVerificationModal } from "./components/part-verification-modal";

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
  }>;
};

/* =======================
   COMPONENTS
 ======================= */

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
      <div className="w-1 h-3 rounded-full bg-indigo-500" />
      {title}
    </h2>
  );
}

function StatusPill({ status }: { status: string }) {
  const getStatusColor = (s: string) => {
    switch (s.toLowerCase()) {
      case "draft":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "submitted":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "quoted":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "accepted":
      case "paid":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "pending":
      case "pending approval":
      case "payment pending":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "rejected":
        return "bg-rose-50 text-rose-700 border-rose-100";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <span
      className={cn(
        "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border",
        getStatusColor(status),
      )}
    >
      {status === "pending approval" ? "Ready for Review" : status}
    </span>
  );
}

/* =======================
   PAGE
 ======================= */

export default function QuoteDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const [selectedPart, setSelectedPart] = useState<
    IRFQFull["parts"][number] | null
  >(null);
  const [data, setData] = useState<IRFQFull>();
  const [loading, setLoading] = useState(true);
  const { setPageTitle, resetTitle } = useMetaStore();
  const router = useRouter();
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/rfq/${id}`);
      setData(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setPageTitle("Quote Details");
    return () => {
      resetTitle();
    };
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isManual = data?.rfq.rfq_type === "manual";
  const canCheckout =
    data?.rfq.status === "pending approval" ||
    (data?.rfq.rfq_type === "manual" && data?.rfq.status === "payment pending");

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50/30">
        <CustomLoader />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 bg-slate-50/30">
        <div className="text-xl font-bold text-slate-900">Quote Not Found</div>
        <Button
          onClick={() => router.push("/portal/quotes")}
          variant="outline"
          className="rounded-xl gap-2 hover:bg-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Quotes
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/30">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/portal/quotes")}
              className="rounded-full h-10 w-10 p-0 hover:bg-white border border-transparent hover:border-slate-200"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Order Reference
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {data.rfq.rfq_code}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusPill status={data.rfq.status} />
            {canCheckout && (
              <Button
                onClick={() => setIsVerificationOpen(true)}
                className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm font-semibold"
              >
                <CreditCard className="w-4 h-4" />
                Verify and Checkout
              </Button>
            )}
          </div>
        </div>

        {/* PRICING OVERVIEW BANNER */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row gap-8 items-center shadow-sm">
          <div className="bg-indigo-50 p-4 rounded-xl">
            <Package className="w-8 h-8 text-indigo-600" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-lg font-bold text-slate-900">
              Pricing Overview
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              Review your manufacturing specifications and finalize your order.
            </p>
          </div>
          <div className="hidden md:block h-12 w-px bg-slate-100" />
          <div className="text-center md:text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Total Quote Value
            </p>
            <p className="text-3xl md:text-4xl font-bold text-indigo-600 tracking-tight">
              {data.rfq.final_price
                ? formatCurrencyGeneric(data.rfq.final_price)
                : "TBD"}
            </p>
          </div>
        </div>

        {/* MANUAL REVIEW CONTEXT */}
        {isManual && (
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start">
            <div className="bg-white p-2.5 rounded-xl text-indigo-600 shadow-sm border border-indigo-100">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <h3 className="font-bold text-indigo-950 text-base mb-1">
                  Expert Technical Review
                </h3>
                <p className="text-indigo-800/70 text-sm leading-relaxed max-w-3xl font-medium">
                  {data.rfq.status === "pending approval"
                    ? "Our engineers have finalized the technical requirements for your custom parts. Please verify the following specifications before proceeding to checkout."
                    : "Your request includes custom manufacturing specifications and is currently being reviewed by our engineering team to ensure technical feasibility."}
                </p>
              </div>

              {data.rfq.manual_quote_metadata && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-indigo-100/50">
                  {Object.entries(data.rfq.manual_quote_metadata).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="bg-white border border-indigo-200/30 rounded-lg px-3 py-1.5 flex items-center gap-2.5 shadow-sm"
                      >
                        <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                          {key.replace(/_/g, " ")}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-indigo-200" />
                        <span className="text-xs text-indigo-900 font-semibold">
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

        {/* PARTS LIST */}
        <section className="space-y-6">
          <SectionTitle title="Configured Parts" />
          <div className="grid grid-cols-1 gap-4">
            {data.parts.map((part, idx) => (
              <div
                key={part.id}
                className="group flex flex-col lg:flex-row bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-indigo-300 transition-all duration-200"
              >
                {/* Part Visual Area */}
                <div
                  onClick={() => setSelectedPart(part)}
                  className="w-full lg:w-48 bg-slate-50 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors border-b lg:border-b-0 lg:border-r relative h-[200px] lg:h-auto"
                >
                  {part.snapshot_2d_url ? (
                    <img
                      src={part.snapshot_2d_url}
                      alt={part.file_name}
                      className="max-h-[140px] max-w-full object-contain p-6 mix-blend-multiply"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400">
                      <Package className="w-6 h-6" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-slate-900/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white text-slate-900 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-md border border-slate-200">
                      <Eye className="w-4 h-4" /> View 3D
                    </div>
                  </div>
                  <div className="absolute top-4 left-4">
                    <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md border border-slate-200 shadow-sm text-[10px] font-bold text-slate-500 uppercase">
                      Part {idx + 1}
                    </div>
                  </div>
                </div>

                {/* Part Details Area */}
                <div className="p-6 flex-1 grid grid-cols-1 xl:grid-cols-12 gap-8 items-center">
                  {/* Technical Specifications */}
                  <div className="xl:col-span-4 space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 truncate text-lg tracking-tight">
                          {part.file_name}
                        </h3>
                        {part.process && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold uppercase bg-slate-50 text-slate-500 border-slate-200"
                          >
                            {part.process.replace(/-/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Quantity: {part.quantity} Units
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <DetailItem
                        label="Material"
                        value={
                          (metalTranslation as any)[part.material] ??
                          part.material
                        }
                      />
                      <DetailItem label="Finish" value={part.finish} />
                      <DetailItem
                        label={
                          part.sheet_thickness_mm ? "Thickness" : "Tolerance"
                        }
                        value={
                          part.sheet_thickness_mm
                            ? `${part.sheet_thickness_mm} mm`
                            : part.tolerance
                        }
                      />
                      <DetailItem
                        label="Inspection"
                        value={part.inspection || "Standard"}
                      />
                    </div>
                  </div>

                  {/* Commercial Details */}
                  <div className="xl:col-span-5 grid grid-cols-2 gap-8 xl:border-l xl:pl-10">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                        Unit Pricing
                      </label>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-900">
                          {part.final_price
                            ? formatCurrencyGeneric(part.final_price)
                            : "—"}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 uppercase">
                          / Unit
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-2 bg-slate-100 px-2 py-0.5 rounded inline-block">
                        Total:{" "}
                        {part.final_price
                          ? formatCurrencyGeneric(
                              part.final_price * part.quantity,
                            )
                          : "—"}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        Lead Time
                      </label>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-900">
                          {part.lead_time || "—"}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 uppercase">
                          Days
                        </span>
                      </div>
                      <div className="text-[10px] font-medium text-slate-400 italic">
                        Estimated arrival
                      </div>
                    </div>
                  </div>

                  {/* CAD Action */}
                  <div className="xl:col-span-3 xl:border-l xl:pl-10 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl border-slate-200 text-slate-600 font-semibold gap-2.5 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = part.cad_file_url;
                        link.download = part.file_name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <Download className="w-4 h-4 text-indigo-600" />
                      Download CAD
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* PART VERIFICATION MODAL */}
      <PartVerificationModal
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
        parts={data.parts}
        onVerifyAll={() => router.push(`/checkout/${id}`)}
      />

      {/* SIDE DRAWER */}
      <AnimatePresence>
        {selectedPart && (
          <RfqDetailDrawer
            part={selectedPart}
            onClose={() => setSelectedPart(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* =======================
   REUSABLE SUB-COMPONENTS
 ======================= */

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-700 break-words leading-tight">
        {value || "—"}
      </span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
        {label}
      </span>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8"
    >
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="relative w-full max-w-7xl h-full max-h-[800px] bg-white rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-200"
      >
        {/* Left Side: 3D Viewer */}
        <div className="flex-1 bg-slate-50 relative min-h-[300px]">
          <div className="absolute inset-0">
            <CadViewer
              file={part.cad_file_url}
              showControls={true}
              autoResize={true}
              zoom={0.5}
            />
          </div>
          <div className="absolute bottom-6 left-6 z-10 p-4 bg-white/80 backdrop-blur-md rounded-xl border border-slate-200 text-slate-900 shadow-sm pointer-events-none max-w-md">
            <div className="text-[10px] text-indigo-600 uppercase font-bold tracking-widest mb-1">
              Geometric Analysis
            </div>
            <div className="text-xl font-bold tracking-tight leading-tight">
              {part.file_name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-3 bg-white hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all z-20 shadow-sm border border-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Right Side: Details */}
        <div className="w-full md:w-[420px] flex flex-col h-full bg-white border-l border-slate-200">
          <div className="p-8 border-b border-slate-100">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-widest mb-3">
              <Package className="w-3.5 h-3.5" />
              Technical Report
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
              {part.file_name.split(".")[0]}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                  Batch Quantity
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-slate-900">
                    {part.quantity}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Units
                  </span>
                </div>
              </div>
              <div className="bg-indigo-600 p-5 rounded-xl shadow-lg shadow-indigo-100 flex flex-col justify-between min-h-[100px] text-white">
                <span className="text-[10px] text-indigo-200 uppercase font-bold tracking-widest">
                  Line Total
                </span>
                <span className="text-xl font-bold">
                  {part.final_price
                    ? formatCurrencyGeneric(part.final_price * part.quantity)
                    : "—"}
                </span>
              </div>
            </div>

            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-1 h-3 rounded-full bg-indigo-500" />
                Manufacturing Params
              </h3>
              <div className="bg-slate-50/50 rounded-xl p-2 border border-slate-100">
                <DetailRow
                  label="Material"
                  value={
                    (metalTranslation as any)[part.material] ?? part.material
                  }
                />
                <DetailRow label="Finish" value={part.finish} />
                <DetailRow
                  label="Tolerance"
                  value={
                    part.sheet_thickness_mm
                      ? `${part.sheet_thickness_mm} mm`
                      : part.tolerance
                  }
                />
                <DetailRow
                  label="Inspection"
                  value={part.inspection || "Standard Facility Check"}
                />
              </div>
            </section>

            {part.notes && (
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1 h-3 rounded-full bg-indigo-500" />
                  Technical Notes
                </h3>
                <div className="p-6 bg-indigo-50/30 rounded-xl text-sm text-indigo-900/70 font-medium leading-relaxed italic border border-indigo-100/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-200" />
                  "{part.notes}"
                </div>
              </section>
            )}

            <div className="pt-4 pb-8">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl border-slate-200 gap-3 font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all shadow-sm"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = part.cad_file_url;
                  link.download = part.file_name;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <Download className="w-4 h-4 text-indigo-600" />
                Download Original CAD
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
