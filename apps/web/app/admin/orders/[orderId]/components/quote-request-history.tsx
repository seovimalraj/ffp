"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import CustomLoader from "@/components/ui/loader/CustomLoader";
import { Clock, CheckCircle2, XCircle, AlertCircle, Send, FileText } from "lucide-react";
import { StatusPill } from "@/app/portal/orders/[orderId]/page";
import { ImageViewerModal } from "@/components/image-viewer-modal";
import { PdfViewerModal } from "@/components/pdf-viewer-modal";

/* =======================
   TYPES
======================= */

type QuoteRequest = {
  id: string;
  order_id: string;
  supplier_id: string;
  status: string;
  notes: string;
  reject_reason: string;
  created_at: string;
  responded_at: string;
  supplier: {
    name: string;
    display_name: string;
    email: string;
  };
  events: Array<{
    id: string;
    event_type: string;
    created_at: string;
    metadata: any;
  }>;
  attachments?: string[];
};

/* =======================
   COMPONENTS
======================= */

const TimelineItem = ({
  request,
  isLast,
  index,
  onViewAttachment,
}: {
  request: QuoteRequest;
  isLast: boolean;
  index: number;
  onViewAttachment: (url: string) => void;
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "declined":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "requested":
        return <Send className="w-5 h-5 text-indigo-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-emerald-50 border-emerald-100";
      case "declined":
        return "bg-red-50 border-red-100";
      case "requested":
        return "bg-indigo-50 border-indigo-100";
      default:
        return "bg-slate-50 border-slate-100";
    }
  };

  return (
    <div className="relative flex gap-6 pb-8">
      {/* Vertical Line */}
      {!isLast && (
        <div className="absolute left-[10px] top-6 bottom-0 w-px bg-slate-200" />
      )}

      {/* Dot/Icon */}
      <div className="relative z-10 flex items-center justify-center w-5 h-5 mt-1 bg-white">
        <div
          className={`absolute w-2.5 h-2.5 rounded-full ${index === 0 ? "bg-indigo-600 ring-[6px] ring-indigo-50" : "bg-slate-300 ring-4 ring-white"}`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900">
              {request.supplier.display_name || request.supplier.name}
            </span>
            <StatusPill status={request.status} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
            <Clock className="w-3.5 h-3.5" />
            {new Date(request.created_at).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${getStatusBg(request.status)}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Communication
              </div>
              <div className="text-slate-700 italic">
                {request.notes ? `"${request.notes}"` : "No notes provided"}
              </div>
            </div>

            {request.status === "declined" && (
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                  Rejection Reason
                </div>
                <div className="text-red-900 font-medium">
                  {request.reject_reason || "No reason specified"}
                </div>
              </div>
            )}

            {request.responded_at && (
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Responded At
                </div>
                <div className="text-slate-700">
                  {new Date(request.responded_at).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Attachments */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200/50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Attachments
              </div>
              <div className="flex flex-wrap gap-2">
                {request.attachments.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => onViewAttachment(url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm"
                  >
                    <FileText className="w-4 h-4" />
                    Attachment {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Activity log / events */}
          {request.events && request.events.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200/50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Activity Log
              </div>
              <div className="space-y-2.5">
                {request.events
                  .sort(
                    (a, b) =>
                      new Date(a.created_at).getTime() -
                      new Date(b.created_at).getTime(),
                  )
                  .map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                        <div className="text-xs font-semibold text-slate-600 capitalize">
                          {event.event_type.replace(/_/g, " ")}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {new Date(event.created_at).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const QuoteRequestHistory = ({ orderId }: { orderId: string }) => {
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerDoc, setViewerDoc] = useState<{ url: string; type: "pdf" | "image" } | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/quote-request/order/${orderId}`);
        setRequests(response.data.data || []);
      } catch (error) {
        console.error("Failed to fetch quote request history:", error);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchHistory();
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <CustomLoader />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 text-slate-300">
          <Send className="w-6 h-6" />
        </div>
        <div className="text-slate-500 font-medium">
          No quote requests found for this order
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="space-y-6 max-w-4xl">
        <div className="mt-8">
          {requests.map((request, index) => (
            <TimelineItem
              key={request.id}
              request={request}
              isLast={index === requests.length - 1}
              index={index}
              onViewAttachment={(url) =>
                setViewerDoc({
                  url,
                  type: url.toLowerCase().includes(".pdf") ? "pdf" : "image",
                })
              }
            />
          ))}
        </div>
      </section>

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

export default QuoteRequestHistory;
