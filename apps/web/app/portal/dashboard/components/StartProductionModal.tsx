"use client";

import {
  VerticalSteppedModal,
  Step,
  StepContainer,
} from "@/components/ui/modal/VerticalSteppedModal";
import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, Package, FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";

interface StartProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const StartProductionModal = ({
  isOpen,
  onClose,
  onSuccess,
}: StartProductionModalProps) => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);

  // Errors
  const [nameError, setNameError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await apiClient.get("/system?keys=services");
        if (res.data?.success && res.data.configData) {
          const serviceVar = res.data.configData.find(
            (v: any) => v.key === "services",
          );
          if (serviceVar && serviceVar.value) {
            try {
              const services = JSON.parse(serviceVar.value);
              if (Array.isArray(services)) {
                setAvailableServices(services);
              }
            } catch (e) {
              console.error("Failed to parse services:", e);
              // Fallback if parsing fails or structure is different
              setAvailableServices([
                "CNC Machining",
                "Injection Molding",
                "3D Printing",
                "Sheet Metal",
              ]);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch services:", error);
      }
    };

    if (isOpen) {
      fetchServices();
    }
  }, [isOpen]);

  const steps: Step[] = [
    {
      id: "production-details",
      title: "Production Request",
      description: "Tell us about your project",
    },
  ];

  const validate = (): boolean => {
    let valid = true;
    if (!projectName.trim()) {
      setNameError("Project name is required.");
      valid = false;
    } else {
      setNameError("");
    }

    if (!projectDescription.trim() || projectDescription.trim().length < 10) {
      setDescriptionError(
        "Please provide more detail (at least 10 characters).",
      );
      valid = false;
    } else {
      setDescriptionError("");
    }

    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await apiClient.post(`/technical-support/production-request`, {
        projectName,
        projectDescription,
        services: selectedServices,
      });

      setIsSubmitted(true);
      onSuccess?.();
    } catch (error: any) {
      console.error("Failed to submit production request:", error);
      notify.error(
        error?.response?.data?.message ||
          "Failed to submit your request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setIsSubmitted(false);
      setProjectName("");
      setProjectDescription("");
      setSelectedServices([]);
      setNameError("");
      setDescriptionError("");
    }, 300);
  };

  const toggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service],
    );
  };

  return (
    <VerticalSteppedModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Start Production"
      subtitle="New Manufacturing Project"
      steps={steps}
      currentStep={0}
      onStepChange={() => {}} // Only one step
      onSubmit={handleSubmit}
      submitLabel="Send to our team"
      isSubmitting={isSubmitting}
      hideFooter={isSubmitted}
      hideSidebar={isSubmitted}
      elementStyle={{
        submitButtonColor: "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20",
      }}
    >
      <div className="h-full">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              <StepContainer stepActive={true}>
                <div className="space-y-8">
                  <header className="space-y-2">
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Project Details
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-md">
                      Our engineering team will review your requirements and get
                      back to you with a custom production plan.
                    </p>
                  </header>

                  <div className="space-y-6">
                    {/* Project Name */}
                    <div className="group space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2 group-focus-within:text-blue-600 transition-colors">
                        <Package className="w-4 h-4" />
                        Project Name
                      </Label>
                      <Input
                        placeholder="e.g. Aluminum Enclosure V2"
                        value={projectName}
                        onChange={(e) => {
                          setProjectName(e.target.value);
                          if (nameError) setNameError("");
                        }}
                        className={cn(
                          "h-14 border-slate-200 bg-slate-50/50 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all text-base px-6",
                          nameError &&
                            "border-red-500 focus:ring-red-500/10 focus:border-red-500",
                        )}
                      />
                      {nameError && (
                        <p className="text-red-500 text-xs font-medium ml-1 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-red-500" />
                          {nameError}
                        </p>
                      )}
                    </div>

                    {/* Manufacturing Services */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-slate-400" />
                        Manufacturing Services
                      </Label>
                      <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-200">
                        {availableServices.map((service) => (
                          <div
                            key={service}
                            className="flex items-center space-x-3 group cursor-pointer"
                            onClick={() => toggleService(service)}
                          >
                            <Checkbox
                              checked={selectedServices.includes(service)}
                              onCheckedChange={() => toggleService(service)}
                              className="w-5 h-5 rounded-md border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 transition-all"
                            />
                            <Label className="text-sm font-medium text-slate-600 group-hover:text-slate-900 cursor-pointer transition-colors">
                              {service}
                            </Label>
                          </div>
                        ))}
                        {availableServices.length === 0 && (
                          <p className="text-slate-400 text-xs italic">
                            Loading available services...
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        Project Description
                      </Label>
                      <Textarea
                        placeholder="Describe your project requirements, quantities, materials, and any specific tolerances..."
                        className={cn(
                          "min-h-[180px] text-base p-6 rounded-3xl border border-slate-200 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none shadow-sm",
                          descriptionError &&
                            "border-red-400 focus:ring-red-500/10",
                        )}
                        value={projectDescription}
                        onChange={(e) => {
                          setProjectDescription(e.target.value);
                          if (descriptionError) setDescriptionError("");
                        }}
                      />
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[11px] font-medium text-red-500 italic">
                          {descriptionError}
                        </span>
                        <span className="text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md">
                          {projectDescription.length} / 10 min
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </StepContainer>
            </motion.div>
          ) : (
            <motion.div
              key="success-container"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
              }}
              className="h-full flex flex-col items-center justify-center text-center p-8 space-y-10"
            >
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-24 h-24 bg-emerald-50 rounded-[32px] flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-500/10 border border-emerald-100/50"
                >
                  <CheckCircle2 className="w-12 h-12" />
                </motion.div>
                <div className="absolute -z-10 inset-0 bg-emerald-400/20 blur-3xl rounded-full animate-pulse" />
              </div>

              <div className="space-y-4 max-w-sm">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                  Request Received!
                </h2>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                  <p className="text-slate-600 text-sm leading-relaxed">
                    We've received your production project:{" "}
                    <span className="font-bold text-slate-900">
                      {projectName}
                    </span>
                    .
                  </p>
                  <div className="h-px bg-slate-200 w-12 mx-auto" />
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Our engineering team will review your requirements and reach
                    out within{" "}
                    <span className="text-slate-900 font-bold">24 hours</span>.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleClose}
                className="w-full max-w-[240px] bg-slate-900 hover:bg-black text-white rounded-2xl h-14 font-black shadow-lg shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Back to Dashboard
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </VerticalSteppedModal>
  );
};

export default StartProductionModal;
