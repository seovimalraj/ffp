"use client";

import {
  Timeline,
  Event,
  Title,
  Subtitle,
} from "@reactuiutils/horizontal-timeline";
import { OrderPhases } from "@cnc-quote/shared";
import { kebabToTitleSafe } from "@/utils";
import { IOrderFull } from "../page";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";
import { UpdatePartStatusModal } from "@/components/modals/update-part-status-modal";
import { SupplierStatusRequestModal } from "@/components/modals/supplier-status-request-modal";
import { BaseModal } from "@/components/ui/modal/BaseModal";
import { motion, AnimatePresence } from "framer-motion";
// No lucide-react imports needed as we use react-icons/lu

import {
  PiNumberZeroBold,
  PiNumberOneBold,
  PiNumberTwoBold,
  PiNumberThreeBold,
  PiNumberFourBold,
  PiNumberFiveBold,
  PiNumberSixBold,
  PiNumberSevenBold,
  PiNumberEightBold,
  PiNumberNineBold,
} from "react-icons/pi";

import {
  LuCheck,
  LuClock,
  LuBellRing,
  LuArrowRight,
  LuX,
  LuImage,
} from "react-icons/lu";
import RoleCheck from "@/components/auth/role-check";

const statusIcons = [
  PiNumberZeroBold,
  PiNumberOneBold,
  PiNumberTwoBold,
  PiNumberThreeBold,
  PiNumberFourBold,
  PiNumberFiveBold,
  PiNumberSixBold,
  PiNumberSevenBold,
  PiNumberEightBold,
  PiNumberNineBold,
];

interface OrderTimelineViewProps {
  parts: IOrderFull["parts"];
  onRefresh: () => void | Promise<void>;
  onItemClick?: (part: IOrderFull["parts"][number]) => void;
  onStatusClick?: (partId: string, statusFrom: string) => void;
  requests?: Record<string, any>;
  orderId: string;
}

export function OrderTimelineView({
  parts,
  onRefresh,
  onItemClick,
  onStatusClick,
  requests,
  orderId,
}: OrderTimelineViewProps) {
  const session = useSession();
  const isSupplier = session.data?.user.role === "supplier";
  const isAdmin = session.data?.user.role === "admin";

  const [pendingMove, setPendingMove] = useState<{
    itemId: string;
    toColumnId: string;
    requestId?: string;
  } | null>(null);

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierMoveData, setSupplierMoveData] = useState<{
    itemId: string;
    currentStatus: string;
    nextStatus: string;
  } | null>(null);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [activeRejectRequest, setActiveRejectRequest] = useState<any>(null);

  const handleAdminModalSubmit = async (
    notes: string,
    attachments: string[],
  ) => {
    if (!pendingMove || !orderId) return;

    try {
      if (attachments.length > 0) {
        await Promise.all(
          attachments.map((url) =>
            apiClient.post(`/orders/${orderId}/documents`, {
              document_type: "other",
              document_url: url,
              file_name: url.split("/").pop() || "attachment",
              mime_type: url.match(/\.(jpg|jpeg|png|webp|gif)$/i)
                ? "image/jpeg"
                : "application/pdf",
              uploaded_by: (session.data?.user as any)?.id,
              is_active: true,
              visibility: "customer",
            }),
          ),
        );
      }

      if (pendingMove.requestId) {
        await apiClient.patch(
          `/orders/status-requests/${pendingMove.requestId}/approve`,
          { notes, attachments },
        );
      } else {
        await apiClient.patch(`/orders/part/${pendingMove.itemId}`, {
          status: pendingMove.toColumnId,
          notes: notes,
        });
      }

      notify.success("Status updated successfully");
      onRefresh && (await onRefresh());
    } catch (error) {
      console.error(error);
      notify.error("Failed to update status");
    } finally {
      setPendingMove(null);
    }
  };

  const handleSupplierMove = async (data: {
    fromStatus: string;
    toStatus: string;
    comments: string;
    attachments: string[];
  }) => {
    if (!supplierMoveData) return;
    try {
      if (data.attachments.length > 0) {
        await Promise.all(
          data.attachments.map((url) =>
            apiClient.post(`/orders/${orderId}/documents`, {
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
        );
      }

      await apiClient.post(
        `/supplier/${orderId}/request-status-change/${supplierMoveData.itemId}`,
        {
          status_from: data.fromStatus,
          status_to: data.toStatus,
          comments: data.comments,
          attachments: data.attachments,
        },
      );

      notify.success("Status change request sent");
      setIsSupplierModalOpen(false);
      onRefresh && (await onRefresh());
    } catch (error: any) {
      console.error(error);
      notify.error(
        error?.response?.data?.message || "Error requesting status change",
      );
    }
  };

  const confirmReject = async () => {
    if (!activeRejectRequest) return;
    setIsRejecting(true);
    try {
      await apiClient.patch(
        `/orders/status-requests/${activeRejectRequest.id}/reject`,
        { rejection_reason: rejectionReason || "No reason provided" },
      );
      notify.success("Status change rejected");
      setIsRejectModalOpen(false);
      onRefresh && (await onRefresh());
    } catch (error: any) {
      console.error(error);
      notify.error(error?.response?.data?.message || "Error rejecting request");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-8">
      {parts.map((part) => {
        const currentIndex = OrderPhases.indexOf(part.status);
        const nextStatus = OrderPhases[currentIndex + 1] || null;
        const partRequests = requests?.[part.order_part_id] || [];
        const activeRequest = Array.isArray(partRequests)
          ? partRequests.find((r: any) => r.status === "active")
          : partRequests?.status === "active"
            ? partRequests
            : null;

        return (
          <div
            key={part.order_part_id}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Part Info Area (Sidebar) */}
              <div className="w-full md:w-64 flex flex-col h-full shrink-0">
                <div className="flex-1 space-y-6">
                  {/* Part Header: Identity & Image */}
                  <div className="space-y-4">
                    <div className="flex flex-col items-start gap-4">
                      <div className="relative aspect-square shrink-0 w-full bg-slate-50 rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                        {part.rfq_part.snapshot_2d_url ? (
                          <img
                            src={part.rfq_part.snapshot_2d_url}
                            alt={part.rfq_part.file_name}
                            className="w-full h-full object-contain mix-blend-multiply p-2 group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <LuImage className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors duration-300" />
                      </div>
                    </div>
                  </div>

                  {/* Actions Section - Conditional Logic */}
                  <div className="pt-2 border-t border-slate-100">
                    {isSupplier && (
                      <div className="min-h-[44px]">
                        <AnimatePresence mode="wait">
                          {activeRequest ? (
                            <motion.div
                              key="pending"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl flex items-start gap-3 shadow-sm"
                            >
                              <div className="p-1.5 bg-amber-100 rounded-lg">
                                <LuClock className="w-3.5 h-3.5 text-amber-600" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[9px] font-black text-amber-800 uppercase tracking-widest mb-0.5 leading-none">
                                  PENDING REVIEW
                                </div>
                                <div className="text-[11px] text-amber-700/80 font-bold truncate max-w-[130px]">
                                  TO:{" "}
                                  {kebabToTitleSafe(activeRequest.status_to)}
                                </div>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="move"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              <Button
                                disabled={!nextStatus}
                                onClick={() => {
                                  if (nextStatus) {
                                    setSupplierMoveData({
                                      itemId: part.order_part_id,
                                      currentStatus: part.status,
                                      nextStatus,
                                    });
                                    setIsSupplierModalOpen(true);
                                  }
                                }}
                                variant={"frigate"}
                                className="w-full text-white font-bold h-10 text-[11px] rounded-xl shadow-md shadow-indigo-100/50 hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2 group/btn uppercase tracking-wider"
                              >
                                <span>
                                  MOVE TO{" "}
                                  {nextStatus
                                    ? kebabToTitleSafe(nextStatus)
                                    : "COMPLETED"}
                                </span>
                                <LuArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {isAdmin && activeRequest && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                      >
                        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-start gap-3 shadow-sm">
                          <div className="p-1.5 bg-indigo-100 rounded-lg border border-indigo-200">
                            <LuBellRing className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-black text-indigo-800 uppercase tracking-widest mb-1 leading-none">
                              STATUS REQUEST
                            </div>
                            <div className="text-[11px] text-indigo-700 font-bold uppercase tracking-tight">
                              → {kebabToTitleSafe(activeRequest.status_to)}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              setPendingMove({
                                itemId: part.order_part_id,
                                toColumnId: activeRequest.status_to,
                                requestId: activeRequest.id,
                              })
                            }
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-9 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform uppercase tracking-wider"
                          >
                            <LuCheck className="w-3.5 h-3.5 font-bold" />
                            APPROVE
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setActiveRejectRequest(activeRequest);
                              setRejectionReason("");
                              setIsRejectModalOpen(true);
                            }}
                            className="flex-1 border-rose-200 text-rose-600 bg-white hover:bg-rose-50 hover:border-rose-300 text-[10px] h-9 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform uppercase tracking-wider"
                          >
                            <LuX className="w-3.5 h-3.5 font-bold" />
                            REJECT
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden md:block w-px h-full bg-slate-100 self-stretch" />

              {/* Timeline Area (Main Area) */}
              <div className="flex-1 w-full flex flex-col pt-2 min-w-0">
                {/* Header Row: Title on Left, Buttons on Right */}
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors truncate capitalize">
                      {part.rfq_part.file_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onItemClick?.(part)}
                      className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 h-9 px-4 text-xs font-bold rounded-lg gap-2 transition-all shadow-sm"
                    >
                      View Part
                    </Button>
                    <RoleCheck roles={["admin", "supplier"]}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onStatusClick?.(part.order_part_id, "")}
                        className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 h-9 px-4 text-xs font-bold rounded-lg gap-2 transition-all shadow-sm"
                      >
                        View History
                      </Button>
                    </RoleCheck>
                  </div>
                </div>

                <div className="overflow-x-auto pb-4 scrollbar-hide">
                  <Timeline minEvents={OrderPhases.length}>
                    {OrderPhases.map((phase, idx) => {
                      const isCompleted = idx < currentIndex;
                      const isCurrent = idx === currentIndex;
                      const Icon = statusIcons[idx] || statusIcons[0];
                      const color = isCompleted
                        ? "#10b981" // emerald-500
                        : isCurrent
                          ? "#6366f1" // indigo-500
                          : "#e2e8f0"; // slate-200

                      return (
                        <Event
                          key={phase}
                          isFirst={idx === 0}
                          color={color}
                          icon={() => {
                            return (
                              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[30px] flex items-center justify-center">
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                            );
                          }}
                        >
                          <motion.div
                            className={`flex flex-col gap-1 p-3 rounded-xl transition-all duration-300 cursor-pointer hover:bg-slate-50 ${
                              isCurrent
                                ? "bg-indigo-50/50 ring-1 mt-2 ring-indigo-100 shadow-sm shadow-indigo-100/50"
                                : ""
                            }`}
                            whileHover={{ y: -2 }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {isCompleted ? (
                                <div className="p-0.5 bg-emerald-100 rounded-full">
                                  <LuCheck className="w-2.5 h-2.5 text-emerald-600" />
                                </div>
                              ) : isCurrent ? (
                                <div className="p-0.5 bg-indigo-100 rounded-full animate-pulse">
                                  <LuClock className="w-2.5 h-2.5 text-indigo-600" />
                                </div>
                              ) : (
                                <div className="p-0.5 bg-slate-100 rounded-full">
                                  <Icon className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}

                              <Title
                                className={`!text-[11px] !m-0 font-bold tracking-tight uppercase ${
                                  isCurrent
                                    ? "text-indigo-600"
                                    : isCompleted
                                      ? "text-emerald-600"
                                      : "text-slate-400"
                                }`}
                              >
                                {kebabToTitleSafe(phase)}
                              </Title>
                            </div>

                            <Subtitle className="!text-[10px] !m-0 text-slate-400 font-medium">
                              {isCurrent
                                ? "Current Phase"
                                : isCompleted
                                  ? "Completed"
                                  : "Next Steps"}
                            </Subtitle>

                            <RoleCheck roles={["admin", "supplier"]}>
                              <div className="mt-2 pt-2 border-t border-slate-100/50">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onStatusClick?.(part.order_part_id, phase);
                                  }}
                                  className="w-full flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-500 transition-colors group/history"
                                >
                                  <span>View History</span>
                                  <LuArrowRight className="w-2.5 h-2.5 opacity-0 -translate-x-1 group-hover/history:opacity-100 group-hover/history:translate-x-0 transition-all" />
                                </button>
                              </div>
                            </RoleCheck>

                            {isAdmin && !isCurrent && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  setPendingMove({
                                    itemId: part.order_part_id,
                                    toColumnId: phase,
                                  })
                                }
                                className="mt-2 py-1 px-2 bg-slate-50 hover:bg-indigo-50 text-[9px] text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-md font-bold uppercase tracking-wider transition-colors text-center shadow-sm"
                              >
                                Move Stage
                              </motion.button>
                            )}
                          </motion.div>
                        </Event>
                      );
                    })}
                  </Timeline>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Modals */}
      <UpdatePartStatusModal
        isOpen={!!pendingMove}
        onClose={() => setPendingMove(null)}
        onSubmit={handleAdminModalSubmit}
        title="Update Production Status"
        targetStatus={pendingMove?.toColumnId || ""}
      />

      {supplierMoveData && (
        <SupplierStatusRequestModal
          isOpen={isSupplierModalOpen}
          onClose={() => setIsSupplierModalOpen(false)}
          onSubmit={handleSupplierMove}
          currentStatus={supplierMoveData.currentStatus}
          nextStatus={supplierMoveData.nextStatus}
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
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="frigate"
              onClick={confirmReject}
              disabled={isRejecting}
              className="flex-1 bg-rose-600 hover:bg-rose-700"
            >
              {isRejecting ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </div>
        }
      >
        <textarea
          className="w-full p-3 border border-slate-200 rounded-xl min-h-[100px]"
          placeholder="Reason for rejection..."
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
        />
      </BaseModal>
    </div>
  );
}
