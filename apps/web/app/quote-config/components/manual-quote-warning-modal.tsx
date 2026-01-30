"use client";

import React from "react";
import { AlertCircle, ArrowRight, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ManualQuoteWarningModalProps {
  isOpen: boolean;
  onRedirectToQuotes: () => void;
  onRedirectToCheckout?: () => void;
  showCheckout: boolean;
}

export function ManualQuoteWarningModal({
  isOpen,
  onRedirectToQuotes,
  onRedirectToCheckout,
  showCheckout,
}: ManualQuoteWarningModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
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
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-400/10 blur-[60px]" />
          </div>

          <div className="relative z-10">
            {/* Header Area */}
            <div className="px-8 pt-10 pb-4 text-center">
              <div className="mx-auto w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-amber-500/20">
                <AlertCircle size={28} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Manual Quote Required
              </h2>
            </div>

            {/* Content Body */}
            <div className="px-8 pb-8 text-center text-slate-600">
              <p className="text-lg leading-relaxed">
                This RFQ has been marked for manual review and cannot be
                configured here.
              </p>
              <p className="mt-2 text-sm opacity-70">
                Our engineering team is reviewing your specifications to provide
                accurate pricing.
              </p>
            </div>

            {/* Action Options */}
            <div className="px-6 pb-10 space-y-3">
              <button
                onClick={onRedirectToQuotes}
                className={cn(
                  "group w-full p-4 flex items-center gap-4 text-left transition-all duration-200",
                  "rounded-2xl border border-white/60 bg-white/40 backdrop-blur-sm",
                  "hover:bg-blue-600 hover:border-blue-500 hover:text-white hover:shadow-lg hover:shadow-blue-500/20",
                  "active:scale-[0.98]",
                )}
              >
                <div className="w-10 h-10 shrink-0 bg-blue-600/10 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-colors">
                  <ArrowRight size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold">View My Quotes</span>
                  <span className="text-[12px] opacity-70 leading-tight mt-0.5">
                    Check the status of your manual review in the portal
                  </span>
                </div>
              </button>

              {showCheckout && onRedirectToCheckout && (
                <button
                  onClick={onRedirectToCheckout}
                  className={cn(
                    "group w-full p-4 flex items-center gap-4 text-left transition-all duration-200",
                    "rounded-2xl border border-white/60 bg-white/40 backdrop-blur-sm",
                    "hover:bg-green-600 hover:border-green-500 hover:text-white hover:shadow-lg hover:shadow-green-500/20",
                    "active:scale-[0.98]",
                  )}
                >
                  <div className="w-10 h-10 shrink-0 bg-green-600/10 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-colors">
                    <ShoppingCart size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[15px] font-bold">
                      Proceed to Checkout
                    </span>
                    <span className="text-[12px] opacity-70 leading-tight mt-0.5">
                      The manual review is complete, you can now pay
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
