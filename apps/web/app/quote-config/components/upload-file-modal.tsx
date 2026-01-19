"use client";

import { Upload, Loader2 } from "lucide-react";
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PartConfig } from "@/types/part-config";
import { analyzeCADFile } from "@/lib/cad-analysis";
import { useFileUpload } from "@/lib/hooks/use-file-upload";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import { 
  getDefaultMaterialForProcess,
  getDefaultFinishForProcess,
  getDefaultToleranceForProcess,
  getDefaultThickness 
} from "@/lib/pricing-engine";

type UploadFileModalProps = {
  open: boolean;
  setOpen: (value: boolean) => void;
  parts?: PartConfig[];
  setParts?: React.Dispatch<React.SetStateAction<PartConfig[]>>;
  saveAsDraft?: () => void;
};

const UploadFileModal = ({
  open,
  setOpen,
  saveAsDraft,
}: UploadFileModalProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const { upload } = useFileUpload();
  const [isUploading, setIsUploading] = useState(false);

  const onDropFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setIsUploading(true);
      try {
        const uploadResults = [];

        for (const file of acceptedFiles) {
          console.log(`Analyzing CAD file: ${file.name}`);
          const geometry = await analyzeCADFile(file);

          let uploadedPath = `quotes/temp-${Date.now()}/${file.name}`;
          try {
            const { url } = await upload(file);
            uploadedPath = url;
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            notify.error(`Failed to upload ${file.name}`);
            continue; // Skip if upload fails
          }

          // Map recommendedProcess to process field
          const processMap: Record<string, string> = {
            'sheet-metal': 'sheet-metal',
            'cnc-milling': 'cnc-milling',
            'cnc-turning': 'cnc-turning',
            'injection-molding': 'injection-molding',
          };
          const detectedProcess = geometry?.recommendedProcess 
            ? processMap[geometry.recommendedProcess] || 'cnc-milling'
            : 'cnc-milling';

          console.log(`Process detection for ${file.name}:`, {
            recommendedProcess: geometry?.recommendedProcess,
            detectedProcess,
            confidence: geometry?.processConfidence,
            reasoning: geometry?.processReasoning
          });

          // Use process-specific defaults
          const defaultMaterial = getDefaultMaterialForProcess(detectedProcess);
          const defaultFinish = getDefaultFinishForProcess(detectedProcess);
          const defaultTolerance = getDefaultToleranceForProcess(detectedProcess);
          const defaultThickness = detectedProcess.includes('sheet') ? getDefaultThickness() : undefined;

          uploadResults.push({
            file_name: file.name,
            cad_file_url: uploadedPath,
            cad_file_type: file.name.split(".").pop() || "unknown",
            process: detectedProcess, // Set process based on geometry analysis
            material: defaultMaterial,
            quantity: 1,
            tolerance: defaultTolerance,
            finish: defaultFinish,
            threads: "none",
            inspection: "standard",
            notes: "",
            lead_time_type: "standard",
            lead_time: 7,
            thickness: defaultThickness,
            geometry,
            certificates: [],
          });
        }

        if (uploadResults.length === 0) {
          setIsUploading(false);
          return;
        }

        // Call saveAsDraft before redirecting if we are in an existing quote
        if (saveAsDraft) {
          try {
            await saveAsDraft();
          } catch (error) {
            console.error("Failed to save current draft:", error);
            // Continue anyway? Usually yes, we want to create the new one
          }
        }

        const rfqPayload = {
          user_id: session?.user?.id,
          parts: uploadResults,
        };

        const response = await apiClient.post("/rfq", rfqPayload);

        if (response.data?.success && response.data?.rfq_id) {
          notify.success("New quote created successfully");
          setOpen(false);
          router.push(`/quote-config/${response.data.rfq_id}`);
        } else {
          throw new Error("Failed to create quote");
        }
      } catch (error: any) {
        console.error("Error creating new quote:", error);
        notify.error(
          "Failed to process files: " + (error.message || "Please try again"),
        );
      } finally {
        setIsUploading(false);
      }
    },
    [upload, saveAsDraft, session?.user?.id, setOpen, router],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropFiles,
    multiple: true,
    disabled: isUploading,
    accept: {
      "model/stl": [".stl"],
      "model/step": [".step", ".stp"],
      "application/octet-stream": [".stl", ".step", ".stp"],
      "application/sla": [".stl"],
      "application/vnd.ms-pki.stl": [".stl"],
      "application/iges": [".iges", ".igs"],
      "image/vnd.dxf": [".dxf"],
      "image/vnd.dwg": [".dwg"],
      "model/x.stl-binary": [".stl"],
      "application/x-navistyle": [".x_t", ".x_b"],
      "model/obj": [".obj"],
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-xl p-0 overflow-hidden"
        onInteractOutside={(e) => (isUploading ? e.preventDefault() : null)}
        onEscapeKeyDown={(e) => (isUploading ? e.preventDefault() : null)}
      >
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-bold">New Quote</DialogTitle>
        </DialogHeader>

        <div className="pt-4 w-full px-6 pb-8">
          <div
            {...getRootProps()}
            className={`bg-gradient-to-br from-white to-slate-50/80 rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-300 ${
              isUploading
                ? "opacity-60 cursor-not-allowed border-slate-200"
                : "cursor-pointer"
            } ${
              !isUploading && isDragActive
                ? "border-blue-500 border-dashed bg-blue-50/50 shadow-lg scale-[1.01]"
                : !isUploading
                  ? "border-slate-200 hover:border-blue-400 border-dashed hover:shadow-md"
                  : ""
            }`}
          >
            <input {...getInputProps()} />

            {/* Upload Area */}
            <div className="p-8 flex flex-col items-center justify-center gap-4 text-center border-b border-slate-200">
              <div
                className={`p-4 bg-gradient-to-br rounded-2xl transition-all shadow-sm ${
                  isUploading
                    ? "from-slate-100 to-slate-50"
                    : isDragActive
                      ? "from-blue-200 to-blue-100 scale-110"
                      : "from-blue-50 to-slate-50"
                }`}
              >
                {isUploading ? (
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                ) : (
                  <Upload
                    className={`w-10 h-10 transition-colors ${
                      isDragActive ? "text-blue-700" : "text-blue-600"
                    }`}
                  />
                )}
              </div>

              <div>
                <p
                  className={`font-bold text-xl mb-2 transition-colors ${
                    isUploading
                      ? "text-slate-500"
                      : isDragActive
                        ? "text-blue-700"
                        : "text-slate-900"
                  }`}
                >
                  {isUploading
                    ? "Creating New Quote..."
                    : isDragActive
                      ? "Drop your files here"
                      : "Start by uploading a part"}
                </p>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  {isDragActive
                    ? "Release to upload your CAD files"
                    : "Click to upload or drag and drop your CAD files here"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {["STEP", "STL", "IGES", "OBJ", "and more"].map((ext) => (
                  <span
                    key={ext}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      isDragActive
                        ? "bg-blue-200 text-blue-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {ext}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadFileModal;
