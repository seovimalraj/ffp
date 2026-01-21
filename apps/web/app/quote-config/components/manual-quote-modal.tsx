"use client";

import {
  VerticalSteppedModal,
  Step,
  StepContainer,
} from "@/components/ui/modal/VerticalSteppedModal";
import React, { useState } from "react";

interface ManualQuoteModalProps {
  showManualQuoteModal: boolean;
  setShowManualQuoteModal: (show: boolean) => void;
  isSubmitting: boolean;
  handleSubmit: () => void;
  submitLable: string;
}

const ManualQuoteModal = ({
  showManualQuoteModal,
  setShowManualQuoteModal,
  isSubmitting,
  handleSubmit,
  submitLable,
}: ManualQuoteModalProps) => {
  const [currentStep, setCurrentStep] = useState(1);

  const steps: Step[] = [
    {
      id: "production-details",
      title: "Production Details",
      description: "Enter production details",
    },
    {
      id: "production-details",
      title: "Production Details",
      description: "Enter production details",
    },
    {
      id: "production-details",
      title: "Production Details",
      description: "Enter production details",
    },
  ];
  return (
    <VerticalSteppedModal
      isOpen={showManualQuoteModal}
      onClose={() => setShowManualQuoteModal(false)}
      title="Manual Quote"
      steps={steps}
      currentStep={currentStep}
      onStepChange={(step) => setCurrentStep(step)}
      onSubmit={handleSubmit}
      submitLabel={submitLable}
      isSubmitting={isSubmitting}
    >
      <StepContainer stepActive={currentStep === 1}>
        <div className="space-y-6"></div>
      </StepContainer>{" "}
      <StepContainer stepActive={currentStep === 2}>
        <div className="space-y-6"></div>
      </StepContainer>{" "}
      <StepContainer stepActive={currentStep === 3}>
        <div className="space-y-6"></div>
      </StepContainer>
    </VerticalSteppedModal>
  );
};

export default ManualQuoteModal;
