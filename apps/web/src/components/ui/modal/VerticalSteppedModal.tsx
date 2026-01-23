"use client";

import React from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface Step {
  id: string;
  title: string;
  description?: string;
}

interface VerticalSteppedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  steps: Step[];
  currentStep: number;
  onStepChange: (stepIndex: number) => void;
  onSubmit: () => void;
  children: React.ReactNode;
  isSubmitting?: boolean;
  submitLabel?: string;
  sidebarPosition?: "left" | "right";
  hideFooter?: boolean;
  hideSidebar?: boolean;
}

/**
 * A reusable modal component with a vertical step indicator sidebar.
 * Highly customizable and premium looking.
 */
export function VerticalSteppedModal({
  isOpen,
  onClose,
  title,
  subtitle,
  steps,
  currentStep,
  onStepChange,
  onSubmit,
  children,
  isSubmitting = false,
  submitLabel = "Submit",
  sidebarPosition = "left", // Defaulted to left as requested
  hideFooter = false,
  hideSidebar = false,
}: VerticalSteppedModalProps) {
  if (!isOpen) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onSubmit();
    } else {
      onStepChange(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      onStepChange(currentStep - 1);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "relative w-full max-w-5xl rounded-[32px] border border-white/20 bg-white/95 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[750px] max-h-[92vh]",
            sidebarPosition === "right" ? "md:flex-row-reverse" : "md:flex-row",
          )}
        >
          {!hideSidebar && (
            <div
              className={cn(
                "relative w-full md:w-85 bg-white/10 backdrop-blur-2xl p-12 flex flex-col z-10 overflow-hidden shadow-[inset_-20px_0_40px_rgba(255,255,255,0.2)]",
                sidebarPosition === "left"
                  ? "border-b border-white/10 md:border-b-0 md:border-r"
                  : "border-t border-white/10 md:border-t-0 md:border-l",
              )}
            >
              {/* Liquid Background Blobs - Restricted to Sidebar */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
                <motion.div
                  animate={{
                    x: [0, 30, 0],
                    y: [0, 40, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute -top-[10%] -left-[10%] w-[120%] h-[60%] bg-blue-300/30 rounded-full blur-[60px]"
                />
                <motion.div
                  animate={{
                    x: [0, -20, 0],
                    y: [0, -30, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute -bottom-[10%] -right-[10%] w-[100%] h-[50%] bg-purple-300/30 rounded-full blur-[60px]"
                />
              </div>

              {/* Glass Overlay for Sidebar */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

              <div className="relative z-10 mb-12">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-sm text-slate-500 mt-3 font-medium leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>

              <nav className="flex-1 space-y-10 relative z-10">
                {steps.map((step, index) => {
                  const isActive = currentStep === index;
                  const isCompleted = currentStep > index;

                  return (
                    <button
                      key={step.id}
                      onClick={() => isCompleted && onStepChange(index)}
                      disabled={!isCompleted}
                      className={cn(
                        "group relative flex items-start gap-6 w-full text-left transition-all outline-none",
                        isCompleted ? "cursor-pointer" : "cursor-default",
                      )}
                    >
                      {/* Progress Line */}
                      {index !== steps.length - 1 && (
                        <div
                          className={cn(
                            "absolute left-[17px] top-9 w-0.5 h-13 -ml-px transition-all duration-500",
                            isCompleted
                              ? "bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                              : "bg-slate-200/50",
                          )}
                        />
                      )}

                      <div
                        className={cn(
                          "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border-2 transition-all duration-500",
                          isActive
                            ? "border-blue-600 bg-blue-600/10 text-blue-600 shadow-lg shadow-blue-600/20 scale-110"
                            : isCompleted
                              ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20"
                              : "border-slate-300/60 text-slate-400",
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-4 w-4 stroke-[3px]" />
                        ) : (
                          <span className="text-xs font-black tracking-tighter">
                            0{index + 1}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col pt-1">
                        <span
                          className={cn(
                            "text-sm font-bold tracking-tight transition-all duration-300",
                            isActive
                              ? "text-slate-900 scale-105 origin-left"
                              : isCompleted
                                ? "text-slate-700"
                                : "text-slate-400",
                          )}
                        >
                          {step.title}
                        </span>
                        {step.description && (
                          <span
                            className={cn(
                              "text-[11px] mt-1.5 font-medium transition-colors duration-300 max-w-[180px]",
                              isActive ? "text-slate-500" : "text-slate-400",
                            )}
                          >
                            {step.description}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-white/50 backdrop-blur-sm relative z-10">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute right-8 top-8 z-20 p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100/50 rounded-2xl transition-all border border-transparent hover:border-slate-200/50"
            >
              <X size={20} />
            </button>

            {/* Scrollable Content */}
            <div className="flex-1 p-10 md:p-20 overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  initial={{
                    opacity: 0,
                    y: 10,
                  }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    y: -10,
                  }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  className="h-full"
                >
                  <div className="max-w-2xl mx-auto h-full">{children}</div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer Buttons */}
            {!hideFooter && (
              <div className="px-12 py-10 border-t border-slate-100/50 flex items-center justify-between bg-white/40 backdrop-blur-md">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isFirstStep || isSubmitting}
                  className={cn(
                    "rounded-2xl px-8 h-14 font-bold border-2 bg-white/50 hover:bg-white transition-all",
                    isFirstStep && "invisible shadow-none",
                  )}
                >
                  <ChevronLeft className="mr-2 h-5 w-5" />
                  Previous Step
                </Button>

                <div className="flex items-center gap-6">
                  <Button
                    variant="ghost"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="font-bold text-slate-500 hover:text-slate-900 transition-colors hidden sm:flex"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleNext}
                    loading={isSubmitting}
                    className={cn(
                      "rounded-2xl px-10 h-14 font-black min-w-[160px] text-white transition-all shadow-xl scale-100 hover:scale-[1.02] active:scale-[0.98]",
                      isLastStep
                        ? "bg-teal-600 hover:bg-teal-700 shadow-teal-500/20"
                        : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isLastStep ? submitLabel : "Continue"}
                      {!isLastStep && <ChevronRight className="h-5 w-5" />}
                    </div>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export const StepContainer = ({
  children,
  stepActive,
}: {
  children: React.ReactNode;
  stepActive: boolean;
}) => {
  return <>{stepActive ? children : null}</>;
};
