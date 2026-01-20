"use client";

import React from "react";
import { Detail, IOrderFull } from "../page";
import { CadViewer } from "@/components/cad/cad-viewer";
import { X, Package } from "lucide-react";
import { metalTranslation } from "@cnc-quote/shared";

interface Props {
  part: IOrderFull["parts"][number];
  onClose: () => void;
}

const RfqSideDrawer = ({ part, onClose }: Props) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Contianer */}
      <div className="relative w-full max-w-[1400px] h-full max-h-[850px] bg-white rounded-[32px] shadow-2xl flex flex-col md:flex-row overflow-hidden transition-all duration-500 ease-out border border-white/20">
        {/* Left Side: 3D Viewer */}
        <div className="flex-1 bg-[#0a0a0f] relative group">
          <div className="absolute inset-0">
            <CadViewer
              file={part.rfq_part.cad_file_url}
              showControls={true}
              autoResize={true}
              zoom={0.5}
            />
          </div>

          {/* Viewer Overlay Info */}
          <div className="absolute bottom-8 left-8 z-10 p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 text-white pointer-events-none">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mb-1">
              Component Source
            </div>
            <div className="text-sm font-semibold tracking-wide">
              {part.rfq_part.file_name}
            </div>
          </div>
        </div>

        {/* Right Side: Details */}
        <div className="w-full md:w-[400px] xl:w-[480px] flex flex-col h-full bg-white border-l border-slate-100">
          {/* Header */}
          <div className="p-8 border-b border-slate-100 flex justify-between items-start">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-3">
                <Package className="w-3 h-3" />
                Manufacturing Specification
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {part.rfq_part.file_name.split(".")[0]}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-slate-50 rounded-2xl transition-all duration-200 text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
            {/* Quick Stats Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">
                  Unit Price
                </span>
                <span className="text-xl font-bold text-slate-900">
                  ${part.unit_price.toFixed(2)}
                </span>
              </div>
              <div className="bg-slate-900 p-5 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col text-white">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">
                  Total Value
                </span>
                <span className="text-xl font-bold">
                  ${part.total_price.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Specifications */}
            <section>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-500" />
                Technical Details
              </h3>
              <div className="grid gap-y-5">
                <Detail
                  label="Material"
                  value={
                    (metalTranslation as any)[part.rfq_part.material] ??
                    part.rfq_part.material
                  }
                />
                <Detail label="Finishing" value={part.rfq_part.finish} />
                <Detail label="Tolerance" value={part.rfq_part.tolerance} />
                <Detail
                  label="Quality Grade"
                  value={part.rfq_part.inspection || "Standard"}
                />
              </div>
            </section>

            {/* Fulfillment */}
            <section>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-500" />
                Logistics & Volume
              </h3>
              <div className="bg-slate-50/50 rounded-[24px] p-6 border border-slate-100 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Batch Size
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {part.quantity} units
                    </p>
                  </div>
                  <div className="h-8 w-[1px] bg-slate-200" />
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Turnaround
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {part.lead_time} days
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Shipping Mode
                  </span>
                  <span className="text-xs font-bold text-slate-900 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                    {part.lead_time_type.toUpperCase()}
                  </span>
                </div>
              </div>
            </section>

            {/* Status */}
            <section>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-500" />
                Production Status
              </h3>
              <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-[24px] flex items-center justify-between group">
                <div>
                  <div className="text-[10px] text-emerald-600 uppercase font-black tracking-widest mb-1">
                    Current Phase
                  </div>
                  <div className="text-emerald-900 font-bold text-lg capitalize">
                    {part.status.replace("-", " ")}
                  </div>
                </div>
                <div className="relative">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 animate-ping absolute inset-0" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500 relative" />
                </div>
              </div>
            </section>

            {/* Notes */}
            {part.rfq_part.notes && (
              <section className="pb-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  Manufacturer Notes
                </h3>
                <div className="p-5 bg-slate-50 rounded-[24px] text-sm text-slate-600 leading-relaxed italic border border-slate-100">
                  "{part.rfq_part.notes}"
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RfqSideDrawer;
