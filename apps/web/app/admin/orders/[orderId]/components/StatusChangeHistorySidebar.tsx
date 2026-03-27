"use client";

import React from "react";
import { X, Clock, Check, AlertCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { kebabToTitleSafe } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ImageViewerModal } from "@/components/image-viewer-modal";
import { PdfViewerModal } from "@/components/pdf-viewer-modal";

interface StatusRequest {
  id: string;
  order_id: string;
  part_id: string;
  status_from: string;
  status_to: string;
  comments?: string;
  attachments?: string[];
  status: "active" | "approved" | "rejected";
  created_at: string;
  reviwed_at: string;
  rejection_reason?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requests: StatusRequest[];
  partId?: string;
  statusFrom?: string;
  parts: any[];
}

const StatusChangeHistorySidebar = ({
  isOpen,
  onClose,
  requests,
  partId,
  statusFrom,
  parts,
}: Props) => {
  const filteredRequests = requests.filter((r) => {
    const isPartMatch = partId ? r.part_id === partId : true;
    const isStatusMatch = statusFrom ? r.status_from === statusFrom : true;
    return isPartMatch && isStatusMatch;
  });

  const [viewerDoc, setViewerDoc] = React.useState<{ url: string; type: "pdf" | "image" } | null>(null);

  const part = parts.find((p) => p.order_part_id === partId);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Status History
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {part && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                      {part.rfq_part.file_name}
                    </span>
                  )}
                  {statusFrom && (
                    <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                      {kebabToTitleSafe(statusFrom)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {filteredRequests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <Clock className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium italic">No history found</p>
                </div>
              ) : (
                <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-z-10 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
                  {filteredRequests
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
                    )
                    .map((req) => (
                      <div key={req.id} className="relative flex gap-6 group">
                        {/* Icon Container */}
                        <div className="relative shrink-0">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full border-4 border-white shadow-sm ring-1 ${
                              req.status === "approved"
                                ? "bg-emerald-500 ring-emerald-100"
                                : req.status === "rejected"
                                  ? "bg-rose-500 ring-rose-100"
                                  : "bg-amber-500 ring-amber-100 animate-pulse"
                            }`}
                          >
                            {req.status === "approved" ? (
                              <Check className="w-5 h-5 text-white" />
                            ) : req.status === "rejected" ? (
                              <X className="w-5 h-5 text-white" />
                            ) : (
                              <Clock className="w-5 h-5 text-white" />
                            )}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 capitalize">
                                {kebabToTitleSafe(req.status_to)}
                              </span>
                              <span
                                className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                                  req.status === "approved"
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                    : req.status === "rejected"
                                      ? "bg-rose-50 text-rose-600 border-rose-100"
                                      : "bg-amber-50 text-amber-600 border-amber-100"
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-medium text-slate-400">
                                {format(new Date(req.created_at), "MMM d, h:mm a")}
                              </span>
                              {req.reviwed_at && (
                                <span className="text-[9px] font-medium text-indigo-400">
                                  Rev:{" "}
                                  {format(
                                    new Date(req.reviwed_at),
                                    "MMM d, h:mm a",
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {req.comments && (
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 leading-relaxed italic">
                              "{req.comments}"
                            </div>
                          )}

                          {req.status === "rejected" &&
                            req.rejection_reason && (
                              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 leading-relaxed">
                                <div className="font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1.5 underline">
                                  <AlertCircle className="w-3 h-3" />
                                  Rejection Reason
                                </div>
                                {req.rejection_reason}
                              </div>
                            )}

                          {req.attachments && req.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {req.attachments.map((url, i) => (
                                <button
                                  key={i}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewerDoc({
                                      url,
                                      type: url.toLowerCase().includes(".pdf") ? "pdf" : "image",
                                    });
                                  }}
                                  className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md text-[9px] font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm"
                                >
                                  <FileText className="w-3 h-3" />
                                  ATTACHMENT {i + 1}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>

      <ImageViewerModal
        isOpen={viewerDoc?.type === "image"}
        onClose={() => setViewerDoc(null)}
        imageSrc={viewerDoc?.url || ""}
      />

      <PdfViewerModal
        isOpen={viewerDoc?.type === "pdf"}
        onClose={() => setViewerDoc(null)}
        pdfSrc={viewerDoc?.url || ""}
      />
    </>
  );
};

export default StatusChangeHistorySidebar;
