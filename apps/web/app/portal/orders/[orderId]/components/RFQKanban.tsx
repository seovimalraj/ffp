"use client";

import { KanbanBoard } from "@/components/ui/kanban/kanban-board";
import { KanbanBoard as KanbanBoardType, KanbanItem } from "@/types/kanban";
import { IOrderFull } from "../page";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import { useSession } from "next-auth/react";
import { useMemo, useCallback } from "react";

interface Props {
  parts: IOrderFull["parts"];
  onRefresh?: () => void | Promise<void>;
  onItemClick?: (part: IOrderFull["parts"][number]) => void;
}

export function RFQKanban({ parts, onRefresh, onItemClick }: Props) {
  const session = useSession();
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
        material: part.rfq_part.material,
        finish: part.rfq_part.finish,
        quantity: part.quantity,
        leadTime: part.lead_time,
        unitPrice: part.unit_price,
        totalPrice: part.total_price,
        snapshot_2d_url: part.rfq_part.snapshot_2d_url,
      },
    }));
  }, [parts]);

  // Group items by status
  const kanbanBoard: KanbanBoardType = useMemo(
    () => ({
      id: "rfq-kanban",
      title: "",
      columns: [
        {
          id: "pending",
          title: "Pending",
          items: kanbanItems.filter((item) => item.status === "pending"),
        },
        {
          id: "backlog",
          title: "Backlog",
          items: kanbanItems.filter((item) => item.status === "backlog"),
        },
        {
          id: "preparation",
          title: "Preparation",
          items: kanbanItems.filter((item) => item.status === "preparation"),
        },
        {
          id: "production",
          title: "Production",
          items: kanbanItems.filter((item) => item.status === "production"),
        },
        {
          id: "post-production",
          title: "Post Production",
          items: kanbanItems.filter(
            (item) => item.status === "post-production",
          ),
        },
        {
          id: "shipping",
          title: "Shipping",
          items: kanbanItems.filter((item) => item.status === "shipping"),
        },
        {
          id: "completed",
          title: "Completed",
          items: kanbanItems.filter((item) => item.status === "completed"),
        },
      ],
    }),
    [kanbanItems],
  );

  const handleItemMove = async (event: any) => {
    console.log("RFQ Part status changed:", event);
    try {
      await apiClient.patch(`/orders/part/${event.itemId}`, {
        status: event.toColumnId,
      });

      if (onRefresh) {
        await onRefresh(); // Silent update
      }

      notify.success("RFQ part status updated successfully");
    } catch (error) {
      console.error(error);
      notify.error("Failed to update RFQ part status");
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
        readOnly={session.data?.user?.role !== "admin"}
        className="bg-transparent"
      />
    </div>
  );
}
