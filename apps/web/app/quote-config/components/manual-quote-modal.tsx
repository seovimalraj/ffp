"use client";

import {
  VerticalSteppedModal,
  Step,
  StepContainer,
} from "@/components/ui/modal/VerticalSteppedModal";
import React, { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ManualQuoteModalProps {
  showManualQuoteModal: boolean;
  setShowManualQuoteModal: (show: boolean) => void;
  isSubmitting: boolean;
  handleSubmit: (metadata: {
    designFeedback: string;
    orderType: string;
    additionalRequirements: string;
  }) => void;
  submitLable: string;
}

const ManualQuoteModal = ({
  showManualQuoteModal,
  setShowManualQuoteModal,
  isSubmitting: isExternalSubmitting,
  handleSubmit,
  submitLable,
}: ManualQuoteModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isInternalSubmitting, setIsInternalSubmitting] = useState(false);

  // Form states
  const [designFeedback, setDesignFeedback] = useState("frozen");
  const [orderType, setOrderType] = useState("one-time");
  const [additionalRequirements, setAdditionalRequirements] = useState("");

  const steps: Step[] = [
    {
      id: "quote-details",
      title: "Quote Details",
      description: "Preferences & Order Nature",
    },
    {
      id: "additional-requirements",
      title: "Specifications",
      description: "Additional Requirements",
    },
  ];

  const handleInternalSubmit = async () => {
    setIsInternalSubmitting(true);
    // Simulate API call or call parent
    try {
      await handleSubmit({
        designFeedback,
        orderType,
        additionalRequirements,
      });
      setIsSubmitted(true);
    } catch (error) {
      console.error("Submission failed", error);
    } finally {
      setIsInternalSubmitting(false);
    }
  };

  const handleClose = () => {
    setShowManualQuoteModal(false);
    // Reset after animation
    setTimeout(() => {
      setIsSubmitted(false);
      setCurrentStep(0);
    }, 300);
  };

  return (
    <VerticalSteppedModal
      isOpen={showManualQuoteModal}
      onClose={handleClose}
      title="Manual Quote"
      steps={steps}
      currentStep={currentStep}
      onStepChange={(step) => setCurrentStep(step)}
      onSubmit={handleInternalSubmit}
      submitLabel={submitLable}
      isSubmitting={isExternalSubmitting || isInternalSubmitting}
      hideFooter={isSubmitted}
      hideSidebar={isSubmitted}
    >
      <div className="h-full">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <StepContainer stepActive={currentStep === 0}>
                <div className="space-y-8 py-2">
                  {/* Q1: Design Feedback */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-base font-semibold text-slate-900">
                        Do you accept design feedback or adjustments?
                      </Label>
                      <p className="text-sm text-slate-500">
                        Tell us if your design is final or open to manufacturing
                        optimizations.
                      </p>
                    </div>

                    <RadioGroup
                      value={designFeedback}
                      onValueChange={setDesignFeedback}
                      className="grid grid-cols-1 gap-3"
                    >
                      <label
                        className={`flex items-start space-x-3 p-4 rounded-lg border transition-all cursor-pointer ${
                          designFeedback === "frozen"
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                        onClick={() => setDesignFeedback("frozen")}
                      >
                        <RadioGroupItem
                          value="frozen"
                          id="frozen"
                          className="mt-1"
                        />
                        <div className="space-y-1">
                          <span className="block text-sm font-medium text-slate-900">
                            Design is frozen
                          </span>
                          <span className="block text-xs text-slate-500">
                            No changes allowed to the geometry
                          </span>
                        </div>
                      </label>

                      <label
                        className={`flex items-start space-x-3 p-4 rounded-lg border transition-all cursor-pointer ${
                          designFeedback === "acceptable"
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                        onClick={() => setDesignFeedback("acceptable")}
                      >
                        <RadioGroupItem
                          value="acceptable"
                          id="acceptable"
                          className="mt-1"
                        />
                        <div className="space-y-1">
                          <span className="block text-sm font-medium text-slate-900">
                            Changes are acceptable
                          </span>
                          <span className="block text-xs text-slate-500">
                            Open to DFM feedback and adjustments
                          </span>
                        </div>
                      </label>
                    </RadioGroup>
                  </div>

                  {/* Q2: Order Nature */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-base font-semibold text-slate-900">
                        What is the nature of this order?
                      </Label>
                      <p className="text-sm text-slate-500">
                        Selection helps us optimize production and material
                        sourcing.
                      </p>
                    </div>

                    <RadioGroup
                      value={orderType}
                      onValueChange={setOrderType}
                      className="grid grid-cols-1 gap-3"
                    >
                      <label
                        className={`flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer ${
                          orderType === "one-time"
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                        onClick={() => setOrderType("one-time")}
                      >
                        <RadioGroupItem value="one-time" id="one-time" />
                        <span className="text-sm font-medium text-slate-900">
                          One time order
                        </span>
                      </label>

                      <label
                        className={`flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer ${
                          orderType === "recurring"
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                        onClick={() => setOrderType("recurring")}
                      >
                        <RadioGroupItem value="recurring" id="recurring" />
                        <span className="text-sm font-medium text-slate-900">
                          Recurring order
                        </span>
                      </label>

                      <label
                        className={`flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer ${
                          orderType === "additional"
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                        onClick={() => setOrderType("additional")}
                      >
                        <RadioGroupItem value="additional" id="additional" />
                        <span className="text-sm font-medium text-slate-900">
                          Additional ones would be there
                        </span>
                      </label>
                    </RadioGroup>
                  </div>
                </div>
              </StepContainer>

              <StepContainer stepActive={currentStep === 1}>
                <div className="space-y-4 py-2">
                  <div className="space-y-1">
                    <Label className="text-base font-semibold text-slate-900">
                      Additional requirements or specification
                    </Label>
                    <p className="text-sm text-slate-500">
                      Include details like certifications, surface finish specs,
                      or packaging needs.
                    </p>
                  </div>
                  <Textarea
                    placeholder="E.g., Material certificates required, specific RAL color for powder coating, nested packaging for fragile parts..."
                    className="min-h-[200px] text-sm p-4 rounded-lg border-slate-200 focus:border-blue-600 transition-colors resize-y"
                    value={additionalRequirements}
                    onChange={(e) => setAdditionalRequirements(e.target.value)}
                  />
                </div>
              </StepContainer>
            </motion.div>
          ) : (
            <motion.div
              key="success-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-sm">
                <h2 className="text-2xl font-bold text-slate-900">
                  Request Received
                </h2>
                <p className="text-slate-500 text-base leading-relaxed">
                  Your manual quote request has been sent. We will review your
                  specifications and contact you shortly.
                </p>
              </div>

              <Button onClick={handleClose} className="min-w-[200px]" size="lg">
                Return to Configuration
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </VerticalSteppedModal>
  );
};

export default ManualQuoteModal;
