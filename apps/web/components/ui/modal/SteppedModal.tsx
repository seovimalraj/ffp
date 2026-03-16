"use client";

import type React from "react";
import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface StepConfig {
  id: number;
  title: string;
  description?: string;
}

export interface SteppedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  steps: StepConfig[];
  onSubmit: (data: any) => void | Promise<void>;
  onValidateStep?: (step: number) => boolean | Promise<boolean>;
  submitLabel?: string;
  children: React.ReactNode | ((props: { currentStep: number; isSubmitting: boolean; isLoading: boolean }) => React.ReactNode);
  isLoading?: boolean;
}

export default function SteppedModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  steps,
  onSubmit,
  onValidateStep,
  submitLabel = "Create",
  children,
  isLoading = false,
}: SteppedModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = async () => {
    if (isLoading || isSubmitting) return;
    if (onValidateStep) {
      const isValid = await onValidateStep(currentStep);
      if (!isValid) return;
    }
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (isLoading || isSubmitting) return;
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    if (isLoading || isSubmitting) return;
    setCurrentStep(1);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSubmitting) return;
    if (onValidateStep) {
      const isValid = await onValidateStep(currentStep);
      if (!isValid) return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({});
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isDisabled = isLoading || isSubmitting;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center rounded justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-900 rounded-xl shadow-md">
                {icon}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h2>
                {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isDisabled}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={20} />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <div className="flex items-center">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isDisabled && step.id < currentStep) setCurrentStep(step.id);
                    }}
                    disabled={step.id > currentStep || isDisabled}
                    className="flex items-center gap-2.5 group disabled:cursor-not-allowed"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm transition-all shadow-sm",
                        currentStep === step.id
                          ? "bg-violet-900 text-white"
                          : currentStep > step.id
                            ? "bg-violet-700 text-white"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
                        isDisabled && "opacity-50"
                      )}
                    >
                      {currentStep > step.id ? <Check size={14} strokeWidth={3} /> : step.id}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium hidden sm:block",
                        currentStep >= step.id
                          ? "text-slate-800 dark:text-white"
                          : "text-slate-400 dark:text-slate-500",
                        isDisabled && "opacity-50"
                      )}
                    >
                      {step.title}
                    </span>
                  </button>
                  {index < steps.length - 1 && (
                    <div className="flex-1 mx-3">
                      <div
                        className={cn(
                          "h-0.5 rounded-full transition-colors",
                          currentStep > step.id
                            ? "bg-violet-900"
                            : "bg-slate-200 dark:bg-slate-700",
                          isDisabled && "opacity-50"
                        )}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto overflow-x-visible px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-violet-900 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="overflow-visible">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-visible"
                  >
                    {typeof children === "function" ? children({ currentStep, isSubmitting, isLoading }) : children}
                  </motion.div>
                </AnimatePresence>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 rounded-b-2xl border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDisabled}
              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>

            <div className="flex gap-2">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={isDisabled}
                  className="px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
              )}

              {currentStep < steps.length ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isDisabled}
                  className="px-5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all bg-violet-900 text-white hover:bg-violet-800 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isDisabled}
                  className="px-5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all bg-violet-900 text-white hover:bg-violet-800 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    submitLabel
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
