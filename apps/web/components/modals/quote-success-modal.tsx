"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, ArrowRight, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export type CreatedRFQ = {
  out_rfq_id: string;
  out_rfq_code: string;
};

interface QuoteSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfqs: CreatedRFQ[];
}

export const QuoteSuccessModal = ({
  isOpen,
  onClose,
  rfqs,
}: QuoteSuccessModalProps) => {
  const router = useRouter();

  const handleNavigate = (id: string) => {
    router.push(`/quote-config/${id}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-neutral-800"
          >
            <div className="flex items-center justify-end p-4">
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-8 pb-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-6 ring-8 ring-green-50/50 dark:ring-green-900/10">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>

              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Quotes Created Successfully!
              </h2>
              <p className="text-slate-500 dark:text-neutral-400 mb-8 max-w-xs mx-auto">
                You have successfully created {rfqs.length} quote
                {rfqs.length !== 1 ? "s" : ""}. Select a quote below to view its
                details.
              </p>

              <div className="w-full space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {rfqs.map((rfq) => (
                  <button
                    key={rfq.out_rfq_id}
                    onClick={() => handleNavigate(rfq.out_rfq_id)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-neutral-800/50 rounded-xl border border-slate-200 dark:border-neutral-800 hover:border-primary dark:hover:border-primary hover:bg-white dark:hover:bg-neutral-800 hover:shadow-md transition-all group group/btn"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-white dark:bg-neutral-800 flex items-center justify-center border border-slate-100 dark:border-neutral-700 group-hover/btn:border-primary/20 transition-colors">
                        <FileText className="w-5 h-5 text-slate-400 group-hover/btn:text-primary transition-colors" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          RFQ Code
                        </span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white group-hover/btn:text-primary transition-colors">
                          {rfq.out_rfq_code}
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-neutral-700 flex items-center justify-center text-slate-500 dark:text-neutral-400 group-hover:bg-primary group-hover:text-white transition-all transform group-hover:translate-x-1">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 flex justify-center">
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
