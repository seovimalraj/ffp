"use client";

import React from "react";
import {
  VerticalSteppedModal,
  Step,
} from "@/components/ui/modal/VerticalSteppedModal";
import { IRFQFull } from "../page";
import { CadViewer } from "@/components/cad/cad-viewer";
import { metalTranslation } from "@cnc-quote/shared";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  CheckCircle2,
  Maximize2,
  Clock,
  DollarSign,
  Settings2,
  Layers,
} from "lucide-react";
import { isSheetMetalProcess, isCNCProcess } from "@/lib/pricing-engine";
import { formatCurrencyGeneric } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PartVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: IRFQFull["parts"];
  onVerifyAll: () => void;
}

interface CustomStep extends Step {
  snapshot_2d_url?: string | null;
}

export function PartVerificationModal({
  isOpen,
  onClose,
  parts,
  onVerifyAll,
}: PartVerificationModalProps) {
  const [currentStep, setCurrentStep] = React.useState(0);

  const steps: CustomStep[] = parts.map((part, index) => ({
    id: part.id,
    title: `Part ${index + 1}`,
    description: part.file_name,
    snapshot_2d_url: part.snapshot_2d_url,
  }));

  const part = parts[currentStep];

  return (
    <VerticalSteppedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Verify Specifications"
      subtitle="Complete your technical review to proceed to checkout."
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onSubmit={onVerifyAll}
      submitLabel="Confirm & Checkout"
    >
      {part && (
        <div className="flex flex-col h-full gap-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0 px-2">
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">
                {part.file_name}
              </h3>
              <p className="text-sm text-slate-500 font-medium">
                Technical manufacturing specifications
              </p>
            </div>
            <div className="flex gap-2">
              {part.process && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600 border-slate-200"
                >
                  {part.process.replace(/-/g, " ")}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-8 flex-1">
            {/* 3D Viewer Section */}
            <div className="bg-slate-900 rounded-2xl overflow-hidden relative min-h-[300px] border border-slate-800 shadow-xl shrink-0">
              <div className="absolute inset-0">
                <CadViewer
                  file={part.cad_file_url}
                  showControls={false}
                  autoResize={true}
                  zoom={0.4}
                />
              </div>
              <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-bold text-white uppercase flex items-center gap-1.5 pointer-events-none">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Interative 3D Model
              </div>
            </div>

            {/* Specifications Section */}
            <div className="flex flex-col gap-6 px-2 mb-6">
              <div className="flex flex-col gap-1">
                <h4 className="text-lg font-bold text-slate-900 tracking-tight">
                  Manufacturing Specifications
                </h4>
                <p className="text-sm text-slate-500">
                  Verify the technical details and commercial terms for this
                  part.
                </p>
              </div>

              {/* Commercials Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-100/80 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-indigo-50/30 hover:border-indigo-100/50 group">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-500 uppercase tracking-widest transition-colors">
                      Quantity
                    </span>
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {part.quantity}{" "}
                    <span className="text-[10px] font-medium text-slate-500 uppercase">
                      Units
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100/80 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-emerald-50/30 hover:border-emerald-100/50 group">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-500 uppercase tracking-widest transition-colors">
                      Unit Price
                    </span>
                  </div>
                  <div className="text-xl font-black text-emerald-600">
                    {part.final_price
                      ? formatCurrencyGeneric(part.final_price)
                      : "TBD"}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100/80 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-amber-50/30 hover:border-amber-100/50 group">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-amber-500 uppercase tracking-widest transition-colors">
                      Lead Time
                    </span>
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {part.lead_time || "—"}{" "}
                    <span className="text-[10px] font-medium text-slate-500 uppercase">
                      Days
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  Technical Specs
                </span>
                <div className="divide-y divide-slate-100">
                  <SpecItem
                    icon={<Layers className="w-3.5 h-3.5" />}
                    label="Material"
                    value={
                      (metalTranslation as any)[part.material] ?? part.material
                    }
                  />

                  {isSheetMetalProcess(part.process) && (
                    <SpecItem
                      icon={<Maximize2 className="w-3.5 h-3.5" />}
                      label="Material Thickness"
                      value={
                        part.sheet_thickness_mm
                          ? `${part.sheet_thickness_mm} mm`
                          : "—"
                      }
                    />
                  )}

                  {isCNCProcess(part.process) && (
                    <SpecItem
                      icon={<Maximize2 className="w-3.5 h-3.5" />}
                      label="Precision Tolerance"
                      value={part.tolerance || "Standard"}
                    />
                  )}

                  <SpecItem
                    icon={<Settings2 className="w-3.5 h-3.5" />}
                    label="Machining Process"
                    value={part.process?.replace(/-/g, " ") || "—"}
                  />

                  <SpecItem
                    icon={
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    }
                    label="Inspection"
                    value={part.inspection || "Standard"}
                  />
                  <SpecItem
                    icon={<Layers className="w-3.5 h-3.5 text-slate-400" />}
                    label="Surface Finish"
                    value={part.finish}
                  />
                </div>
              </div>

              {part.notes && (
                <div className="bg-indigo-50/40 border-l-4 border-indigo-500 p-4 rounded-r-xl">
                  <span className="block text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">
                    Reviewer Engineering Notes
                  </span>
                  <p className="text-sm text-indigo-900/80 font-medium leading-relaxed italic">
                    "{part.notes}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </VerticalSteppedModal>
  );
}

function SpecItem({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 px-1 border-slate-50">
      <div className="flex items-center gap-3">
        <span className="text-slate-400">{icon}</span>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-tight">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "text-sm font-bold",
          highlight ? "text-indigo-600" : "text-slate-900",
        )}
      >
        {value}
      </span>
    </div>
  );
}
