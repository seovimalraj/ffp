"use client";

import React from "react";
import { AlertCircle, ArrowRightLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ManualExceededModalProps {
  isOpen: boolean;
  onMoveToManual: () => void;
  manualPartsCount: number;
  title?: string;
  description?: string;
}

export function ManualExceededModal({
  isOpen,
  onMoveToManual,
  manualPartsCount,
  title = "Manual Quote Limit Reached",
  description,
}: ManualExceededModalProps) {
  if (!isOpen) return null;

  const defaultDescription = (
    <>
      <p className="text-slate-600 text-lg leading-relaxed">
        You have{" "}
        <span className="font-semibold text-blue-600">
          {manualPartsCount} parts
        </span>{" "}
        that require manual review.
      </p>
      <p className="text-slate-500 mt-2 text-sm max-w-xs mx-auto">
        Our system has a threshold for instant quotes. To proceed, please select
        one of the options below.
      </p>
    </>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop - Non-clickable */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "relative w-full max-w-lg overflow-hidden",
            "rounded-[28px] border border-white/40 shadow-2xl",
            "bg-white/70 backdrop-blur-2xl",
          )}
        >
          {/* Liquid Glass Background Effects */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-400/10 blur-[60px]" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-red-400/10 blur-[60px]" />
          </div>

          <div className="relative z-10">
            {/* Header Area */}
            <div className="px-8 pt-10 pb-4 text-center">
              <div className="mx-auto w-14 h-14 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-blue-600/20">
                <AlertCircle size={28} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {title}
              </h2>
            </div>

            {/* Content Body */}
            <div className="px-8 pb-8 text-center">
              {description ? (
                <p className="text-slate-600 text-lg leading-relaxed">
                  {description}
                </p>
              ) : (
                defaultDescription
              )}
            </div>

            {/* Action Options */}
            <div className="px-6 pb-10 space-y-3">
              <button
                onClick={onMoveToManual}
                className={cn(
                  "group w-full p-4 flex items-center gap-4 text-left transition-all duration-200",
                  "rounded-2xl border border-white/60 bg-white/40 backdrop-blur-sm",
                  "hover:bg-blue-600 hover:border-blue-500 hover:text-white hover:shadow-lg hover:shadow-blue-500/20",
                  "active:scale-[0.98]",
                )}
              >
                <div className="w-10 h-10 shrink-0 bg-blue-600/10 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-colors">
                  <ArrowRightLeft size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold">
                    Create Separate Manual Quote
                  </span>
                  <span className="text-[12px] opacity-70 leading-tight mt-0.5">
                    Move parts to a dedicated RFQ for engineer review
                  </span>
                </div>
              </button>
              {/* 
              <button
                onClick={onDeleteManual}
                className={cn(
                  "group w-full p-4 flex items-center gap-4 text-left transition-all duration-200",
                  "rounded-2xl border border-white/60 bg-white/40 backdrop-blur-sm",
                  "hover:bg-red-600 hover:border-red-500 hover:text-white hover:shadow-lg hover:shadow-red-500/20",
                  "active:scale-[0.98]",
                )}
              >
                <div className="w-10 h-10 shrink-0 bg-red-600/10 text-red-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-colors">
                  <Trash2 size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold">
                    Remove Manual Parts
                  </span>
                  <span className="text-[12px] opacity-70 leading-tight mt-0.5">
                    Delete parts requiring manual review from this quote
                  </span>
                </div>
              </button> */}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
