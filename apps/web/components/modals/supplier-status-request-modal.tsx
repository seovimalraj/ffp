"use client";

import { useState, useRef } from "react";
import SteppedModal from "../ui/modal/SteppedModal";
import Step from "../ui/modal/step";
import { FormField, Textarea } from "../ui/form-field";
import {
  ClipboardList,
  ArrowRight,
  Paperclip,
  X,
  Upload,
  Loader2,
} from "lucide-react";
import { useFileUpload } from "@/lib/hooks/use-file-upload";

interface SupplierStatusRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    fromStatus: string;
    toStatus: string;
    comments: string;
    attachments: string[];
  }) => Promise<void>;
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
  const [attachments, setAttachments] = useState<string[]>([]);
  const { upload, isUploading } = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const result = await upload(file);
      setAttachments((prev) => [...prev, result.url]);
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a !== url));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        fromStatus: currentStatus,
        toStatus: nextStatus,
        comments,
        attachments,
      });
      setComments("");
      setAttachments([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setComments("");
    setAttachments([]);
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
      isLoading={isSubmitting || isUploading}
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
                className="h-24"
                disabled={isSubmitting}
              />
            </FormField>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Paperclip size={14} />
                Attachments
              </label>

              <div className="grid grid-cols-1 gap-2">
                {attachments.map((url, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-lg group"
                  >
                    <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                      {url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                        <img
                          src={url}
                          alt="Attachment"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Paperclip size={14} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-600 truncate">
                        {url.split("/").pop()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(url)}
                      className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isSubmitting}
                  className="flex flex-col items-center justify-center py-4 px-2 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mb-1" />
                  ) : (
                    <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 mb-1" />
                  )}
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-indigo-600">
                    {isUploading ? "Uploading..." : "Click to upload file"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    Images or PDF documents
                  </span>
                </button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,application/pdf"
              />
            </div>
          </div>
        </Step>
      )}
    </SteppedModal>
  );
}
