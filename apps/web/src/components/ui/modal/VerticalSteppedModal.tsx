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
  [key: string]: any; // Allow for custom properties like snapshot_2d_url
}

interface ElementStyle {
  submitButtonColor?: string;
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
  elementStyle?: ElementStyle;
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
  elementStyle,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 text-slate-900">
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
            "relative w-full max-w-5xl rounded-[32px] border border-white/20 bg-white shadow-2xl overflow-hidden flex flex-col md:flex-row h-[800px] max-h-[95vh]",
            sidebarPosition === "right" ? "md:flex-row-reverse" : "md:flex-row",
          )}
        >
          {!hideSidebar && (
            <div
              className={cn(
                "relative w-full md:w-85 bg-slate-50 border-r border-slate-100 p-8 flex flex-col z-10 overflow-hidden",
                sidebarPosition === "left"
                  ? "border-b md:border-b-0 md:border-r"
                  : "border-t md:border-t-0 md:border-l",
              )}
            >
              <div className="relative z-10 mb-8">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed uppercase tracking-wider">
                    {subtitle}
                  </p>
                )}
              </div>

              <nav className="flex-1 space-y-4 relative z-10 overflow-y-auto custom-scrollbar pr-2">
                {steps.map((step, index) => {
                  const isActive = currentStep === index;
                  const isCompleted = currentStep > index;

                  return (
                    <button
                      key={step.id}
                      onClick={() => onStepChange(index)}
                      className={cn(
                        "group relative flex items-center gap-4 w-full p-3 rounded-2xl transition-all outline-none border text-left",
                        isActive
                          ? "bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-100"
                          : "bg-transparent border-transparent hover:bg-white/50 hover:border-slate-200",
                      )}
                    >
                      <div
                        className={cn(
                          "relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-white overflow-hidden transition-all duration-300",
                          isActive
                            ? "border-indigo-200 shadow-md"
                            : "border-slate-200",
                        )}
                      >
                        {step.snapshot_2d_url ? (
                          <img
                            src={step.snapshot_2d_url}
                            alt=""
                            className={cn(
                              "w-full h-full object-contain p-1 mix-blend-multiply transition-transform duration-500",
                              isActive ? "scale-110" : "scale-100 opacity-60",
                            )}
                          />
                        ) : (
                          <span
                            className={cn(
                              "text-xs font-bold",
                              isActive ? "text-indigo-600" : "text-slate-400",
                            )}
                          >
                            0{index + 1}
                          </span>
                        )}

                        {isCompleted && !isActive && (
                          <div className="absolute inset-0 bg-indigo-600/10 flex items-center justify-center">
                            <Check className="w-4 h-4 text-indigo-600" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span
                          className={cn(
                            "text-sm font-bold tracking-tight truncate transition-all duration-300",
                            isActive ? "text-slate-900" : "text-slate-500",
                          )}
                        >
                          {step.title}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] mt-0.5 font-medium truncate transition-colors duration-300",
                            isActive ? "text-indigo-500" : "text-slate-400",
                          )}
                        >
                          {step.description}
                        </span>
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
                      elementStyle?.submitButtonColor
                        ? elementStyle.submitButtonColor
                        : isLastStep
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
