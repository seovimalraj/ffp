"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  KanbanItem,
  type KanbanColumn,
  type KanbanConfig,
} from "@/types/kanban";
import { KanbanCard } from "./kanban-card";
interface KanbanColumnProps {
  column: KanbanColumn;
  config?: KanbanConfig;
  readOnly?: boolean;
  onAddTask?: (columnId: string) => void;
  onRefresh: (() => void | Promise<void>) | undefined;
  onItemClick?: (item: KanbanItem) => void;
  onApproveRequest?: (item: KanbanItem, targetStatus: string, requestId: string) => void;
}

export function KanbanColumn({
  column,
  config,
  readOnly = false,
  onAddTask,
  onRefresh,
  onItemClick,
  onApproveRequest,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    disabled: readOnly || config?.readOnly,
  });

  const isAtLimit = column.limit && column.items.length >= column.limit;

  return (
    <div
      ref={setNodeRef}
      className="w-[344px] px-3 flex-shrink-0 flex flex-col h-full"
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-2.5 mb-4 rounded-lg bg-white border border-slate-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="font-bold capitalize text-sm text-slate-800 tracking-tight">
            {column.title}
          </h2>
          <span className="ml-1 text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">
            {column.items.length}
          </span>
        </div>

        {!readOnly && !config?.readOnly && (
          <button className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors group">
            <svg
              className="w-4 h-4 group-hover:scale-110 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Column Content */}
      <div
        className={`
          flex-1 min-h-[300px] space-y-3 custom-scrollbar overflow-y-auto invisible-scrollbar max-h-[calc(100vh-300px)]
          transition-colors duration-200
          ${!readOnly && !config?.readOnly && isOver ? "bg-slate-100/50 rounded-lg p-2 border-2 border-dashed border-slate-300" : ""}
          ${isAtLimit ? "opacity-75" : ""}
        `}
      >
        <SortableContext
          items={column.items
            .filter((item) => item != null)
            .map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.items
            .filter((item) => item != null)
            .map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                onRefresh={onRefresh}
                style={config?.cardStyle}
                readOnly={readOnly || config?.readOnly}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
                onApproveRequest={onApproveRequest}
              />
            ))}
        </SortableContext>

        {/* Empty State */}
        {column.items.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-center">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p>No items yet</p>
            </div>
          </div>
        )}

        {/* Add Task Button */}
        {!readOnly &&
          !config?.readOnly &&
          config?.allowAddTask &&
          onAddTask &&
          !isAtLimit && (
            <button
              onClick={() => onAddTask(column.id)}
              className="w-full flex items-center justify-center gap-2 p-3 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-300 transition-all group"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-sm font-medium">Add Task</span>
            </button>
          )}

        {/* Limit Warning */}
        {isAtLimit && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded text-center">
            Column limit reached ({column.limit} tasks)
          </div>
        )}
      </div>
    </div>
  );
}
