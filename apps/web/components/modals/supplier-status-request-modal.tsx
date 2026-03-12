"use client";

import { useState } from "react";
import SteppedModal from "../ui/modal/SteppedModal";
import Step from "../ui/modal/step";
import { FormField, Textarea, Input } from "../ui/form-field";
import { ClipboardList, ArrowRight } from "lucide-react";

interface SupplierStatusRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { fromStatus: string; toStatus: string; comments: string }) => Promise<void>;
  currentStatus: string;
  nextStatus: string;
}

const STEPS = [{ id: 1, title: "Request Details" }];

export function SupplierStatusRequestModal({
  isOpen,
  onClose,
  onSubmit,
  currentStatus,
  nextStatus,
}: SupplierStatusRequestModalProps) {
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        fromStatus: currentStatus,
        toStatus: nextStatus,
        comments,
      });
      setComments("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setComments("");
    onClose();
  };

  return (
    <SteppedModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Request Status Change"
      subtitle="Request permission to move this item to the next stage"
      icon={<ClipboardList size={20} className="text-white" />}
      steps={STEPS}
      onSubmit={handleSubmit}
      submitLabel="Send Request"
      isLoading={isSubmitting}
    >
      {({ currentStep }) => (
        <Step step={1} currentStep={currentStep}>
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Current Status
                </label>
                <div className="text-sm font-semibold text-slate-900 capitalize px-3 py-2 bg-white border border-slate-200 rounded text-center opacity-60">
                  {currentStatus.replace("-", " ")}
                </div>
              </div>
              
              <div className="flex-shrink-0 pt-4">
                <ArrowRight className="text-slate-300" size={20} />
              </div>

              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block mb-1">
                  Target Status
                </label>
                <div className="text-sm font-semibold text-indigo-700 capitalize px-3 py-2 bg-indigo-50 border border-indigo-200 rounded text-center">
                  {nextStatus.replace("-", " ")}
                </div>
              </div>
            </div>

            <FormField
              label="Comments"
              hint="Explain why you are requesting this status change. This helps administrators review your request faster."
            >
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Ex: Production is complete, ready for post-processing step..."
                className="h-28"
                disabled={isSubmitting}
              />
            </FormField>
          </div>
        </Step>
      )}
    </SteppedModal>
  );
}
