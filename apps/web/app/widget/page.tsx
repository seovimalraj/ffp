"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { CAD_MIME_MAP } from "@cnc-quote/shared";
import { notify } from "@/lib/toast";

export default function WidgetPage() {
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      acceptedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await apiClient.post("/files/bulk", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data?.uploadId) {
        window.open(
          `/instant-quote?uploadId=${response.data.uploadId}`,
          "_blank",
        );
      } else {
        notify.error("Upload failed, invalid response from server.");
      }
    } catch (error) {
      console.error("Widget upload error:", error);
      notify.error("Failed to upload files. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: CAD_MIME_MAP,
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-transparent font-sans">
      <div
        {...getRootProps()}
        className={`w-full max-w-lg p-10 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 cursor-pointer text-center bg-white/80 backdrop-blur-md shadow-xl ${
          isDragActive
            ? "border-blue-500 bg-blue-50/50 scale-105"
            : "border-slate-300 hover:border-blue-400 hover:bg-white"
        } ${isUploading ? "opacity-70 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <h3 className="text-xl font-semibold text-slate-800">
              Uploading...
            </h3>
            <p className="text-slate-500 mt-2">
              Please wait while we process your files
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Upload className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-semibold text-slate-800 tracking-tight">
              Get an Instant Quote
            </h3>
            <p className="text-slate-500 mt-3 max-w-sm">
              Drag & Drop your CAD files here or click to browse. Supports STEP,
              IGES, STL, DXF.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
