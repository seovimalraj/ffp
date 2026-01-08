"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanItem } from "@/types/kanban";

interface KanbanCardProps {
  item: KanbanItem;
  style?: "default" | "compact" | "detailed";
  readOnly?: boolean;
  onClick?: () => void;
}

export function KanbanCard({
  item,
  style: _style = "detailed",
  readOnly = false,
  onClick,
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

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...(readOnly ? {} : { ...attributes, ...listeners })}
      onClick={onClick}
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

        {item.metadata && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 mt-auto">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                Qty
              </div>
              <div className="text-xs font-medium text-slate-700">
                {item.metadata.quantity || 0}
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
      </div>
    </div>
  );
}
