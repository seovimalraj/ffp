"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  PlusCircle,
  Copy,
  ListRestart,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateWorkflowTemplateModal } from "./create-workflow-template-modal";
import { SelectExistingWorkflowModal } from "./select-existing-workflow-modal";

interface ModifyWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  currentPhases: any[];
  onSuccess: () => void;
}

export const ModifyWorkflowModal = ({
  isOpen,
  onClose,
  orderId,
  currentPhases,
  onSuccess,
}: ModifyWorkflowModalProps) => {
  const [activeSubModal, setActiveSubModal] = useState<
    "none" | "new" | "existing" | "clone"
  >("none");

  const handleCloseSubModal = () => setActiveSubModal("none");

  const handleOptionSelect = (option: "new" | "existing" | "clone") => {
    setActiveSubModal(option);
  };

  const options = [
    {
      id: "new",
      title: "Create New Template",
      description: "Design a completely fresh workflow pattern from scratch.",
      icon: PlusCircle,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      id: "existing",
      title: "Assign Existing Template",
      description: "Apply a pre-defined standard workflow to this order.",
      icon: ClipboardList,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      id: "clone",
      title: "Modify Current Workflow",
      description: "Tweaking this order's flow? Use current as base.",
      icon: ListRestart,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && activeSubModal === "none" && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <Copy className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Modify Workflow
                    </h2>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-0.5">
                      Select how you want to adjust the order pipeline
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white text-slate-400 transition-all border border-transparent hover:border-slate-100 shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Options Body */}
              <div className="p-8 grid gap-4">
                {options.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() =>
                        handleOptionSelect(
                          opt.id as "new" | "existing" | "clone",
                        )
                      }
                      className={cn(
                        "group relative p-6 w-full text-left rounded-[1.5rem] border transition-all duration-300",
                        "hover:shadow-xl hover:-translate-y-1 bg-white",
                        opt.border,
                        "hover:border-indigo-200",
                      )}
                    >
                      <div className="flex items-start gap-5">
                        <div
                          className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-500",
                            opt.bg,
                            opt.color,
                          )}
                        >
                          <Icon className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                          <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                            {opt.title}
                          </h3>
                          <p className="text-sm text-slate-500 leading-relaxed">
                            {opt.description}
                          </p>
                        </div>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer hint */}
              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Select an option to proceed
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUB MODALS */}
      <CreateWorkflowTemplateModal
        isOpen={activeSubModal === "new"}
        onClose={handleCloseSubModal}
        onSuccess={() => {
          onSuccess();
          onClose();
          handleCloseSubModal();
        }}
      />

      <SelectExistingWorkflowModal
        isOpen={activeSubModal === "existing"}
        onClose={handleCloseSubModal}
        orderId={orderId}
        onSuccess={() => {
          onSuccess();
          handleCloseSubModal();
          onClose(); // Close the main modal too
        }}
      />

      <CreateWorkflowTemplateModal
        isOpen={activeSubModal === "clone"}
        onClose={handleCloseSubModal}
        initialPhases={currentPhases}
        initialFormData={{
          name: "",
          description: "Customized from current order workflow",
          is_active: false,
        }}
        onSuccess={() => {
          onSuccess();
          onClose();
        }}
        orderIdForDirectAssignment={orderId}
      />
    </>
  );
};
