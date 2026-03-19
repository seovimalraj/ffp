"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanItem } from "@/types/kanban";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import { useState } from "react";
import { SupplierStatusRequestModal } from "../../modals/supplier-status-request-modal";
import { BaseModal } from "../modal/BaseModal";
interface KanbanCardProps {
  item: KanbanItem;
  style?: "default" | "compact" | "detailed";
  readOnly?: boolean;
  onRefresh: (() => void | Promise<void>) | undefined;
  onClick?: () => void;
  onApproveRequest?: (
    item: KanbanItem,
    targetStatus: string,
    requestId: string,
  ) => void;
}

export function KanbanCard({
  item,
  style: _style = "detailed",
  readOnly = false,
  onRefresh,
  onClick,
  onApproveRequest,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: readOnly,
  });
  const session = useSession();
  const isSupplier = session.data?.user.role === "supplier";
  const isAdmin = session.data?.user.role === "admin";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const statusSequence = [
    "pending",
    "backlog",
    "preparation",
    "production",
    "post-production",
    "shipping",
    "completed",
  ];

  const currentIndex = statusSequence.indexOf(item.status);
  const nextStatus = statusSequence[currentIndex + 1] || "";

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const requests = item.metadata?.requests?.[item.id] || [];
  const activeRequest = requests.find((r: any) => r.status === "active");

  const handleSupplierMove = async (data: {
    fromStatus: string;
    toStatus: string;
    comments: string;
    attachments: string[];
  }) => {
    try {
      if (data.attachments.length > 0) {
        await Promise.all([
          data.attachments.map((url) =>
            apiClient.post(`/orders/${item?.metadata?.orderId}/documents`, {
              document_type: "other",
              document_url: url,
              file_name: url.split("/").pop() || "attachment",
              mime_type: url.match(/\.(jpg|jpeg|png|webp|gif)$/i)
                ? "image/jpeg"
                : "application/pdf",
              uploaded_by: (session.data?.user as any)?.id,
              is_active: true,
              visibility: "supplier",
            }),
          ),
        ]);
      }

      const { data: response } = await apiClient.post(
        `/supplier/${item?.metadata?.orderId || ""}/request-status-change/${item.id}`,
        {
          status_from: data.fromStatus,
          status_to: data.toStatus,
          comments: data.comments,
          attachments: data.attachments,
        },
      );

      if (!response) {
        throw new Error("Error while requesting status change");
      }

      notify.success("Status change request sent");
      setIsModalOpen(false);
      onRefresh && onRefresh();
    } catch (error: any) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        "Error while requesting status change";
      notify.error(message);
    }
  };

  const handleReject = () => {
    if (!activeRequest) return;
    setRejectionReason("");
    setIsRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!activeRequest) return;

    setIsRejecting(true);
    try {
      await apiClient.patch(
        `/orders/status-requests/${activeRequest.id}/reject`,
        {
          rejection_reason: rejectionReason || "No reason provided",
        },
      );
      notify.success("Status change rejected");
      setIsRejectModalOpen(false);
      onRefresh && onRefresh();
    } catch (error: any) {
      console.error(error);
      const message =
        error?.response?.data?.message || "Error rejecting request";
      notify.error(message);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...(readOnly ? {} : { ...attributes, ...listeners })}
      {...(isSupplier || isAdmin ? {} : { onClick })}
      className={`
        group relative flex w-full bg-white border border-slate-200 rounded-xl overflow-hidden
        ${readOnly ? "cursor-default" : "cursor-grab hover:shadow-lg hover:border-indigo-400/50 active:cursor-grabbing"}
        transition-all duration-300 text-left items-stretch
        ${isDragging ? "opacity-50 rotate-3 scale-105 shadow-2xl z-50" : "shadow-sm"}
        ${readOnly ? "select-text" : "active:scale-95"}
      `}
    >
      {/* Left: Image / Snapshot */}
      {item.metadata && (
        <div className="w-20 bg-slate-50 border-r border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50/30 transition-colors">
          {item.metadata.snapshot_2d_url ? (
            <img
              src={item.metadata.snapshot_2d_url}
              onClick={onClick}
              alt="Part snapshot"
              className="w-full h-full object-contain mix-blend-multiply opacity-90 p-2"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Right: Content */}
      <div className="flex-1 p-3 flex flex-col justify-between gap-2 min-w-0">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold truncate text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
            {item.title}
          </h3>

          {item.metadata && (
            <div className="flex flex-wrap gap-1">
              {item.metadata.material && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-full">
                  {item.metadata.material}
                </span>
              )}
            </div>
          )}
        </div>

        {item.metadata && !isSupplier && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 mt-auto">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                Qty
              </div>
              <div className="text-xs font-medium text-slate-700">
                {item.metadata.quantity || 0}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                Lead Type
              </div>
              <div className="text-xs font-medium text-slate-700">
                {item.metadata.leadTimeType}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                Total
              </div>
              <div className="text-xs font-bold text-indigo-600">
                ${Number(item.metadata.totalPrice || 0).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {isSupplier && (
          <div className="mt-1">
            {activeRequest ? (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg group/req">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-amber-700 uppercase tracking-tight">
                    Pending Review
                  </div>
                  <div className="text-[9px] text-amber-600 truncate">
                    Move to {activeRequest.status_to.replace("-", " ")}
                  </div>
                </div>
                <div className="hidden group-hover/req:block absolute bottom-full left-0 mb-2 w-full p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl z-[60]">
                  {activeRequest.comments || "No comments provided"}
                </div>
              </div>
            ) : (
              <Button
                variant="frigate"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!nextStatus) {
                    notify.info("Item is already in the final status");
                    return;
                  }
                  setIsModalOpen(true);
                }}
                className="w-full h-8 text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                Move
              </Button>
            )}
          </div>
        )}

        {isAdmin && activeRequest && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg group/req">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-tight">
                  Status Request
                </div>
                <div className="text-[9px] text-amber-600 truncate">
                  Move to {activeRequest.status_to.replace("-", " ")}
                </div>
              </div>
              <div className="hidden group-hover/req:block absolute bottom-full left-0 mb-2 w-full p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl z-[60]">
                {activeRequest.comments || "No comments provided"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeRequest && onApproveRequest) {
                    onApproveRequest(
                      item,
                      activeRequest.status_to,
                      activeRequest.id,
                    );
                  }
                }}
                className="flex-1 h-8 text-[11px] font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 transition-all rounded-lg"
              >
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReject();
                }}
                className="flex-1 h-8 text-[11px] font-bold border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300 transition-all rounded-lg"
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </div>

      {isSupplier && nextStatus && (
        <SupplierStatusRequestModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSupplierMove}
          currentStatus={item.status}
          nextStatus={nextStatus}
        />
      )}

      <BaseModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Status Change"
        description="Please provide a reason for rejecting this status change request."
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={() => setIsRejectModalOpen(false)}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="frigate"
              onClick={confirmReject}
              disabled={isRejecting}
              className="flex-1 rounded-xl bg-violet-900 hover:bg-violet-800 shadow-lg shadow-violet-200"
            >
              {isRejecting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Rejecting...
                </div>
              ) : (
                "Confirm Reject"
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">
            Rejection Reason
          </label>
          <textarea
            autoFocus
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-900/20 focus:border-violet-900 outline-none min-h-[120px] transition-all text-sm text-slate-800 placeholder:text-slate-400"
            placeholder="E.g., Missing quality check documents..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </div>
      </BaseModal>
    </div>
  );
}
