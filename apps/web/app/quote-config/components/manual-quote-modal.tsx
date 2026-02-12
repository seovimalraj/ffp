"use client";

import {
  VerticalSteppedModal,
  Step,
  StepContainer,
} from "@/components/ui/modal/VerticalSteppedModal";
import React, { useState, useCallback } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Upload,
  X,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PartConfig } from "@/types/part-config";
import { useFileUpload } from "@/lib/hooks/use-file-upload";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";
import { useDropzone } from "react-dropzone";

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
  parts?: PartConfig[];
  updatePart?: (
    partId: string,
    field: keyof PartConfig,
    value: any,
    saveToDb?: boolean,
  ) => void;
}

const ManualQuoteModal = ({
  showManualQuoteModal,
  setShowManualQuoteModal,
  isSubmitting: isExternalSubmitting,
  handleSubmit,
  submitLable,
  parts = [],
  updatePart,
}: ManualQuoteModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isInternalSubmitting, setIsInternalSubmitting] = useState(false);
  const [uploadingPartId, setUploadingPartId] = useState<string | null>(null);

  // Form states
  const [designFeedback, setDesignFeedback] = useState("frozen");
  const [orderType, setOrderType] = useState("one-time");
  const [additionalRequirements, setAdditionalRequirements] = useState("");

  const { upload } = useFileUpload();

  const steps: Step[] = [
    {
      id: "quote-details",
      title: "Quote Details",
      description: "Preferences & Order Nature",
    },
    {
      id: "files-2d",
      title: "2D Files",
      description: "2D files for the parts",
    },
    {
      id: "additional-requirements",
      title: "Specifications",
      description: "Additional Requirements",
    },
  ];

  const handleInternalSubmit = async () => {
    setIsInternalSubmitting(true);
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
    setTimeout(() => {
      setIsSubmitted(false);
      setCurrentStep(0);
    }, 300);
  };

  const validateStep = (step: number) => {
    if (step === 2) {
      // Trying to move to step 2 (Specifications), validate step 1 (2D files)
      const missingFiles = parts.some(
        (p) => !p.files2d || p.files2d.length === 0,
      );
      if (missingFiles) {
        notify.error("Please upload 2D files for all parts before proceeding.");
        return false;
      }
    }
    return true;
  };

  const onStepChange = (step: number) => {
    if (step > currentStep) {
      if (!validateStep(step)) return;
    }
    setCurrentStep(step);
  };

  const handleFileUpload = async (part: PartConfig, acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploadingPartId(part.id);
    try {
      const newFiles = await Promise.all(
        acceptedFiles.map(async (file) => {
          let preview = URL.createObjectURL(file);
          try {
            const { url } = await upload(file);
            preview = url;
          } catch (error) {
            console.error("Failed to upload 2D file:", error);
            notify.error(`Failed to upload ${file.name}`);
          }
          return {
            file,
            preview,
          };
        }),
      );

      const { data } = await apiClient.post(
        `/rfq/${part.rfqId}/${part.id}/add-2d-drawings`,
        {
          drawings: newFiles.map((f) => ({
            file_name: f.file.name,
            file_url: f.preview,
            mime_type: f.file.type,
          })),
        },
      );

      if (!data || !data.drawings) {
        throw new Error("Failed to upload files");
      }

      const uploadedFiles = newFiles.map((f, i) => ({
        ...f,
        id: data.drawings[i]?.id,
      }));

      const currentFiles = part.files2d || [];
      if (updatePart) {
        updatePart(
          part.id,
          "files2d",
          [...currentFiles, ...uploadedFiles],
          false,
        );
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      notify.error("Failed to upload files");
    } finally {
      setUploadingPartId(null);
    }
  };

  const handleRemoveFile = async (
    part: PartConfig,
    fileIndex: number,
    fileId: string | undefined,
  ) => {
    if (fileId) {
      try {
        await apiClient.delete(
          `/rfq/${part.rfqId}/parts/${part.id}/drawings/${fileId}`,
        );
        notify.success("Drawing removed");
      } catch (error) {
        console.error("Failed to delete drawing", error);
        notify.error("Failed to delete drawing");
        return;
      }
    }

    const currentFiles = part.files2d || [];
    const updatedFiles = currentFiles.filter((_, i) => i !== fileIndex);
    if (updatePart) {
      updatePart(part.id, "files2d", updatedFiles, false);
    }
  };

  return (
    <VerticalSteppedModal
      isOpen={showManualQuoteModal}
      onClose={handleClose}
      title="Manual Quote"
      steps={steps}
      currentStep={currentStep}
      onStepChange={onStepChange}
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
                <div className="space-y-6 py-2">
                  <div className="space-y-1">
                    <Label className="text-base font-semibold text-slate-900">
                      Upload 2D Drawings
                    </Label>
                    <p className="text-sm text-slate-500">
                      2D drawings are required for manual quotes. Please upload
                      files for each part.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {parts.map((part) => (
                      <PartUploadItem
                        key={part.id}
                        part={part}
                        onUpload={(files) => handleFileUpload(part, files)}
                        onRemoveFile={(fileIndex, fileId) =>
                          handleRemoveFile(part, fileIndex, fileId)
                        }
                        isUploading={uploadingPartId === part.id}
                      />
                    ))}
                  </div>

                  {parts.some((p) => !p.files2d?.length) && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg text-sm border border-amber-200">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p>
                        Some parts are missing 2D files. You must upload files
                        for all parts to proceed.
                      </p>
                    </div>
                  )}
                </div>
              </StepContainer>

              <StepContainer stepActive={currentStep === 2}>
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

// Sub-component for individual part upload item
const PartUploadItem = ({
  part,
  onUpload,
  onRemoveFile,
  isUploading,
}: {
  part: PartConfig;
  onUpload: (files: File[]) => void;
  onRemoveFile: (fileIndex: number, fileId: string | undefined) => void;
  isUploading: boolean;
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onUpload(acceptedFiles);
    },
    [onUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/vnd.dxf": [".dxf"],
      "image/vnd.dwg": [".dwg"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/svg+xml": [".svg"],
      "image/webp": [".webp"],
    },
    multiple: true,
  });

  const hasFiles = part.files2d && part.files2d.length > 0;

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        hasFiles ? "border-blue-200 bg-blue-50/30" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            {part.fileName}
            {hasFiles && <CheckCircle2 className="w-4 h-4 text-green-600" />}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {part.geometry ? (
              <>
                {part.geometry.boundingBox.x.toFixed(1)} x{" "}
                {part.geometry.boundingBox.y.toFixed(1)} x{" "}
                {part.geometry.boundingBox.z.toFixed(1)} mm
              </>
            ) : (
              "No geometry data"
            )}
          </p>
        </div>
        <div className="shrink-0">
          {/* Status Indicator */}
          {hasFiles ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
              Uploaded
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
              Required
            </span>
          )}
        </div>
      </div>

      {/* File List */}
      {hasFiles && (
        <div className="space-y-2 mb-3">
          {part.files2d!.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-md text-xs group"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate max-w-[200px] text-slate-700">
                  {file.file.name}
                </span>
              </div>
              <button
                onClick={() =>
                  onRemoveFile(idx, "id" in file.file ? file.file.id : file.id)
                }
                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
        }`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-medium">Uploading...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Upload className="w-4 h-4" />
            <span className="text-xs">
              {isDragActive ? "Drop files now" : "Upload more files"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualQuoteModal;
