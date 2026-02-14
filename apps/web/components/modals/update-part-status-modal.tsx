"use client";

import { useState } from "react";
import SteppedModal from "../ui/modal/SteppedModal";
import Step from "../ui/modal/step";
import { FormField, Textarea } from "../ui/form-field";
import { ClipboardList } from "lucide-react";

interface UpdatePartStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => Promise<void>;
  title: string;
  subtitle?: string;
  targetStatus: string;
}

const STEPS = [{ id: 1, title: "Status Update Details" }];

export function UpdatePartStatusModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  subtitle,
  targetStatus,
}: UpdatePartStatusModalProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(notes);
      setNotes("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setNotes("");
    onClose();
  };

  return (
    <SteppedModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={subtitle || `Updating status to ${targetStatus}`}
      icon={<ClipboardList size={20} className="text-white" />}
      steps={STEPS}
      onSubmit={handleSubmit}
      submitLabel="Update Status"
      isLoading={isSubmitting}
    >
      {({ currentStep }) => (
        <Step step={1} currentStep={currentStep}>
          <div className="space-y-4">
            <FormField
              label="Status Change Notes"
              hint="Provide context for this status update. These notes will be included in the notification email to the customer."
            >
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Parts finished production, moving to QC..."
                className="h-32"
                disabled={isSubmitting}
              />
            </FormField>
          </div>
        </Step>
      )}
    </SteppedModal>
  );
}
