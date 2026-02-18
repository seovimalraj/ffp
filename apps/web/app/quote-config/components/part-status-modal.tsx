"use client";

import { useEffect } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Check,
  Info,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { formatCurrencyFixed, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PartStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotUrl?: string;
  hasPriceIssue: boolean;
  has2DIssue: boolean;
  totalPrice: number;
}

export const PartStatusModal = ({
  isOpen,
  onClose,
  snapshotUrl,
  hasPriceIssue,
  has2DIssue,
  totalPrice,
}: PartStatusModalProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const hasAnyIssue = hasPriceIssue || has2DIssue;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-md animate-in fade-in duration-300"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl overflow-hidden rounded-[32px] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 border border-zinc-100"
      >
        {/* Decorative Background Glow */}
        <div
          className={cn(
            "absolute -top-24 -right-24 h-64 w-64 blur-[100px] opacity-20 pointer-events-none",
            hasAnyIssue ? "bg-red-500" : "bg-emerald-500",
          )}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between p-8 border-b border-zinc-50">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg",
                hasAnyIssue
                  ? "bg-red-50 text-red-600 shadow-red-100"
                  : "bg-emerald-50 text-emerald-600 shadow-emerald-100",
              )}
            >
              {hasAnyIssue ? (
                <ShieldAlert className="h-6 w-6" />
              ) : (
                <ShieldCheck className="h-6 w-6" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-zinc-900 leading-tight">
                Manufacturing Validation
              </h3>
              <p className="text-sm font-medium text-zinc-500">
                Checking design against production standards
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-900 active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Status Message */}
          <div
            className={cn(
              "p-5 rounded-2xl border flex gap-4 items-start",
              hasAnyIssue
                ? "bg-amber-50/50 border-amber-100 text-amber-900"
                : "bg-emerald-50/50 border-emerald-100 text-emerald-900",
            )}
          >
            <Info
              className={cn(
                "h-5 w-5 shrink-0 mt-0.5",
                hasAnyIssue ? "text-amber-600" : "text-emerald-600",
              )}
            />
            <div className="space-y-1">
              <p className="text-sm font-bold">
                {hasAnyIssue
                  ? "Action Required for Automated Quoting"
                  : "Validation Successful"}
              </p>
              <p className="text-xs font-medium opacity-80 leading-relaxed">
                {hasAnyIssue
                  ? "Parts must meet minimum order values and provide technical documentation to qualify for instant automated pricing."
                  : "This part satisfies all criteria for instant production and automated pricing."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Snapshot Area */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em] px-1">
                Geometry Snapshot
              </span>
              <div className="relative aspect-square w-full rounded-2xl bg-zinc-50 border border-zinc-100 overflow-hidden flex items-center justify-center group shadow-inner">
                {snapshotUrl ? (
                  <img
                    src={snapshotUrl}
                    alt="2D Snapshot"
                    className="h-full w-full object-contain p-6 transition-transform group-hover:scale-105 duration-500"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-zinc-300">
                    <AlertTriangle className="h-12 w-12 stroke-[1.5]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      No Model Preview
                    </span>
                  </div>
                )}
                {/* Visual Accent */}
                <div className="absolute inset-0 border-[8px] border-white pointer-events-none rounded-2xl" />
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em] px-1">
                Compliance Checklist
              </span>
              <div className="space-y-4">
                {/* 2D Drawing Card */}
                <div
                  className={cn(
                    "p-4 rounded-2xl border transition-all relative overflow-hidden",
                    has2DIssue
                      ? "bg-white border-zinc-200"
                      : "bg-zinc-50 border-transparent shadow-sm",
                  )}
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                        Technical Drawing
                        {!has2DIssue && (
                          <Check className="h-3 w-3 text-emerald-500" />
                        )}
                      </h4>
                      <p className="text-[11px] text-zinc-500 font-medium leading-relaxed max-w-[140px]">
                        2D technical drawing is{" "}
                        <span className="text-zinc-900 font-bold">
                          required
                        </span>{" "}
                        for all parts to verify tolerances.
                      </p>
                    </div>
                    {has2DIssue ? (
                      <div className="h-6 w-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shadow-sm">
                        <X className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Price Card */}
                <div
                  className={cn(
                    "p-4 rounded-2xl border transition-all relative overflow-hidden",
                    hasPriceIssue
                      ? "bg-white border-zinc-200"
                      : "bg-zinc-50 border-transparent shadow-sm",
                  )}
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                        Minimum Value
                        {!hasPriceIssue && (
                          <Check className="h-3 w-3 text-emerald-500" />
                        )}
                      </h4>
                      <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                        Part price must be at least{" "}
                        <span className="text-zinc-900 font-bold">$150.00</span>
                        .
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            hasPriceIssue
                              ? "bg-red-50 text-red-600 border-red-100"
                              : "bg-emerald-50 text-emerald-600 border-emerald-100",
                          )}
                        >
                          {formatCurrencyFixed(totalPrice)}
                        </span>
                        {hasPriceIssue && (
                          <span className="text-[10px] font-medium text-zinc-400 italic">
                            Missing ${(150 - totalPrice).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    {hasPriceIssue ? (
                      <div className="h-6 w-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shadow-sm">
                        <X className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-zinc-50/50 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between border-t border-zinc-100">
          <p className="text-xs text-zinc-400 font-medium max-w-[300px]">
            Unsatisfied requirements may result in manual review or delayed
            quote processing.
          </p>
          <Button
            onClick={onClose}
            className={cn(
              "h-12 px-8 rounded-2xl font-black text-sm transition-all shadow-xl active:scale-95",
              hasAnyIssue
                ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-50 shadow-zinc-200"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200",
            )}
          >
            {hasAnyIssue ? "Accept & Continue" : "Understood"}
          </Button>
        </div>
      </div>
    </div>
  );
};
