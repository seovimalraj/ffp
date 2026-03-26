"use client";

import { KanbanBoard } from "@/components/ui/kanban/kanban-board";
import { KanbanBoard as KanbanBoardType, KanbanItem } from "@/types/kanban";
import { IOrderFull } from "../page";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import { useSession } from "next-auth/react";
import { useMemo, useCallback, useState } from "react";
import { UpdatePartStatusModal } from "@/components/modals/update-part-status-modal";
import { RequestType } from "@/app/supplier/orders/[orderId]/page";
import { OrderPhases } from "@cnc-quote/shared";
import { kebabToTitleSafe } from "@/utils";

interface Props {
  parts: IOrderFull["parts"];
  onRefresh?: () => void | Promise<void>;
  onItemClick?: (part: IOrderFull["parts"][number]) => void;
  requests?: Record<string, RequestType>;
  orderId?: string;
}

export function RFQKanban({
  parts,
  onRefresh,
  onItemClick,
  orderId,
  requests,
}: Props) {
  const session = useSession();
  const [pendingMove, setPendingMove] = useState<{
    itemId: string;
    toColumnId: string;
    requestId?: string;
  } | null>(null);
  // Convert RFQ parts to Kanban items
  const kanbanItems: KanbanItem[] = useMemo(() => {
    return parts.map((part) => ({
      id: part.order_part_id,
      title: part.rfq_part.file_name,
      description: part.order_part_code,
      status: part.status,
      priority:
        part.lead_time <= 3 ? "high" : part.lead_time <= 7 ? "medium" : "low",
      metadata: {
        orderId: orderId,
        material: part.rfq_part.material,
        finish: part.rfq_part.finish,
        quantity: part.quantity,
        leadTime: part.lead_time,
        leadTimeType: part.lead_time_type,
        unitPrice: part.unit_price,
        totalPrice: part.total_price,
        snapshot_2d_url: part.rfq_part.snapshot_2d_url,
        requests: requests,
      },
    }));
  }, [parts]);

  const columns = OrderPhases.map((phase) => ({
    id: phase,
    title: kebabToTitleSafe(phase),
    items: kanbanItems.filter((item) => item.status === phase),
  }));

  // Group items by status
  const kanbanBoard: KanbanBoardType = useMemo(
    () => ({
      id: "rfq-kanban",
      title: "",
      columns,
    }),
    [kanbanItems],
  );

  const handleItemMove = (event: any) => {
    setPendingMove({ itemId: event.itemId, toColumnId: event.toColumnId });
  };

  const handleModalSubmit = async (notes: string, attachments: string[]) => {
    if (!pendingMove || !orderId) return;

    try {
      // Upload documents if any
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

      if (onRefresh) {
        await onRefresh();
      }

      notify.success("RFQ part status updated successfully");
    } catch (error) {
      console.error(error);
      notify.error("Failed to update RFQ part status");
    } finally {
      setPendingMove(null);
    }
  };

  const handleCardClick = useCallback(
    (item: KanbanItem) => {
      if (onItemClick) {
        const part = parts.find((p) => p.order_part_id === item.id);
        if (part) onItemClick(part);
      }
    },
    [onItemClick, parts],
  );

  return (
    <div className="">
      <KanbanBoard
        board={kanbanBoard}
        config={{
          allowAddTask: false,
          showColumnLimits: false,
          cardStyle: "detailed",
        }}
        onItemMove={handleItemMove}
        onItemClick={handleCardClick}
        onRefresh={onRefresh}
        onApproveRequest={(item, targetStatus, requestId) => {
          setPendingMove({
            itemId: item.id,
            toColumnId: targetStatus,
            requestId,
          });
        }}
        readOnly={session.data?.user?.role !== "admin"}
        className="bg-transparent"
      />

      <UpdatePartStatusModal
        isOpen={!!pendingMove}
        onClose={() => setPendingMove(null)}
        onSubmit={handleModalSubmit}
        title="Update Production Status"
        targetStatus={pendingMove?.toColumnId || ""}
      />
    </div>
  );
}
