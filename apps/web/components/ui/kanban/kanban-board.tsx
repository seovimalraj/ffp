"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  type KanbanBoard,
  KanbanItem,
  KanbanMoveEvent,
  type KanbanConfig,
} from "@/types/kanban";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";

interface KanbanBoardProps {
  board: KanbanBoard;
  config?: KanbanConfig;
  readOnly?: boolean;
  onItemMove?: (event: KanbanMoveEvent) => void | Promise<void>;
  onAddTask?: (columnId: string) => void;
  onStatusChange?: (
    item: KanbanItem,
    fromStatus: string,
    toStatus: string,
  ) => void | Promise<void>;
  onRefresh: (() => void | Promise<void>) | undefined;
  onItemClick?: (item: KanbanItem) => void;
  onApproveRequest?: (item: KanbanItem, targetStatus: string, requestId: string) => void;
  className?: string;
}

export function KanbanBoard({
  board: initialBoard,
  config,
  readOnly = false,
  onItemMove,
  onAddTask,
  onStatusChange,
  onRefresh,
  onItemClick,
  onApproveRequest,
  className = "",
}: KanbanBoardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);
  const [sourceColumnId, setSourceColumnId] = useState<string | null>(null);
  const [originalBoard, setOriginalBoard] = useState(initialBoard);

  // Sync state with props when data changes in parent
  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const findItemById = useCallback(
    (id: string): KanbanItem | null => {
      for (const column of board.columns) {
        const item = column.items.find((item) => item.id === id);
        if (item) return item;
      }
      return null;
    },
    [board],
  );

  const findColumnByItemId = useCallback(
    (itemId: string) => {
      return board.columns.find((column) =>
        column.items.some((item) => item.id === itemId),
      );
    },
    [board],
  );

  const findColumnById = useCallback(
    (columnId: string) => {
      return board.columns.find((column) => column.id === columnId);
    },
    [board],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const item = findItemById(active.id as string);
      const column = findColumnByItemId(active.id as string);
      setActiveItem(item);
      setSourceColumnId(column?.id || null);
      setOriginalBoard(board); // Save current board state as backup
    },
    [board, findItemById, findColumnByItemId],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over || readOnly || config?.readOnly) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      if (activeId === overId) return;

      setBoard((prev) => {
        // Find columns in the CURRENT state (prev), not stale closures
        const activeColumn = prev.columns.find((col) =>
          col.items.some((item) => item.id === activeId),
        );
        const overColumn = prev.columns.find(
          (col) =>
            col.items.some((item) => item.id === overId) || col.id === overId,
        );

        if (!activeColumn || !overColumn) return prev;

        // If same column, don't do anything in handleDragOver
        if (activeColumn.id === overColumn.id) return prev;

        // Check if transition is allowed
        if (config?.statusChangeConfig) {
          const statusConfig = config.statusChangeConfig[activeColumn.id];
          if (
            statusConfig?.allowedTransitions &&
            !statusConfig.allowedTransitions.includes(overColumn.id)
          ) {
            return prev; // Transition not allowed
          }
        }

        // Check if item already exists in destination column (prevent duplicates)
        const itemAlreadyInDestination = overColumn.items.some(
          (item) => item.id === activeId,
        );
        if (itemAlreadyInDestination) return prev;

        const activeItems = activeColumn.items;
        const activeIndex = activeItems.findIndex(
          (item) => item.id === activeId,
        );

        if (activeIndex === -1) return prev;

        const overIndex = overColumn.items.findIndex(
          (item) => item.id === overId,
        );

        let newIndex;
        if (overIndex >= 0) {
          newIndex = overIndex;
        } else {
          newIndex = overColumn.items.length;
        }

        const itemToMove = {
          ...activeItems[activeIndex],
          status: overColumn.id,
        };

        return {
          ...prev,
          columns: prev.columns.map((column) => {
            if (column.id === activeColumn.id) {
              return {
                ...column,
                items: column.items.filter((item) => item.id !== activeId),
              };
            }
            if (column.id === overColumn.id) {
              const newItems = [...column.items];
              newItems.splice(newIndex, 0, itemToMove);
              return {
                ...column,
                items: newItems,
              };
            }
            return column;
          }),
        };
      });
    },
    [config],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveItem(null);

      if (!over || readOnly || config?.readOnly) {
        setBoard(originalBoard); // Revert to original state if drop is invalid
        setSourceColumnId(null);
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      // Use the helper functions which now use the latest board state
      const activeColumn = findColumnByItemId(activeId);
      const overColumn = findColumnByItemId(overId) || findColumnById(overId);

      if (!activeColumn || !overColumn) {
        console.warn("Could not find active or over column", {
          activeId,
          overId,
        });
        setSourceColumnId(null);
        return;
      }

      const activeIndex = activeColumn.items.findIndex(
        (item) => item.id === activeId,
      );
      const overIndex = overColumn.items.findIndex(
        (item) => item.id === overId,
      );
      const item = activeColumn.items[activeIndex];

      // Use sourceColumnId to determine if this is a cross-column move
      const isCrossColumnMove =
        sourceColumnId && sourceColumnId !== overColumn.id;

      if (!isCrossColumnMove && activeColumn.id === overColumn.id) {
        // Same column reordering
        if (activeIndex !== overIndex) {
          setBoard((prev) => ({
            ...prev,
            columns: prev.columns.map((column) => {
              if (column.id === activeColumn.id) {
                return {
                  ...column,
                  items: arrayMove(column.items, activeIndex, overIndex),
                };
              }
              return column;
            }),
          }));

          // Call the callback for reordering within same column
          if (onItemMove) {
            await onItemMove({
              itemId: activeId,
              fromColumnId: activeColumn.id,
              toColumnId: overColumn.id,
              fromIndex: activeIndex,
              toIndex: overIndex,
              item,
            });
          }
        }
      } else if (isCrossColumnMove) {
        // Cross-column move - The item has already been moved by handleDragOver
        // We just need to call the callbacks and apply any config transformations
        let updatedItem = { ...item, status: overColumn.id };

        // Apply status change configuration
        if (config?.statusChangeConfig && sourceColumnId) {
          const fromConfig = config.statusChangeConfig[sourceColumnId];
          const toConfig = config.statusChangeConfig[overColumn.id];

          // Handle onExit from previous status
          if (fromConfig?.onExit) {
            updatedItem = await Promise.resolve(fromConfig.onExit(updatedItem));
          }

          // Handle onEnter to new status
          if (toConfig?.onEnter) {
            updatedItem = await Promise.resolve(toConfig.onEnter(updatedItem));
          }

          // Auto-assign if configured
          if (toConfig?.autoAssign) {
            updatedItem = {
              ...updatedItem,
              assignee: {
                name: toConfig.autoAssign,
                initials: toConfig.autoAssign.slice(0, 2).toUpperCase(),
              },
            };
          }

          // Show notifications if configured
          if (config.enableNotifications) {
            if (fromConfig?.notifications?.onExit) {
              console.log(fromConfig.notifications.onExit);
            }
            if (toConfig?.notifications?.onEnter) {
              console.log(toConfig.notifications.onEnter);
            }
          }
        }

        // Call status change callback
        if (onStatusChange && sourceColumnId) {
          await onStatusChange(updatedItem, sourceColumnId, overColumn.id);
        }

        // Call the move callback
        if (onItemMove && sourceColumnId) {
          const sourceColumn = findColumnById(sourceColumnId);
          await onItemMove({
            itemId: activeId,
            fromColumnId: sourceColumnId,
            toColumnId: overColumn.id,
            fromIndex:
              sourceColumn?.items.findIndex((item) => item.id === activeId) ??
              -1,
            toIndex: overIndex >= 0 ? overIndex : overColumn.items.length,
            item: updatedItem,
          });
        }
      }

      setSourceColumnId(null);
    },
    [
      onItemMove,
      onStatusChange,
      config,
      sourceColumnId,
      board,
      originalBoard,
      readOnly,
      findColumnByItemId,
      findColumnById,
    ],
  );

  return (
    <div className={`h-full bg-gray-50 ${className}`}>
      <div className="p-1 h-full flex flex-col">
        {/* Board Header */}
        {/* <div className="mb-6">
          {board.title && (
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {board.title}
            </h1>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>
              {board.columns.reduce((acc, col) => acc + col.items.length, 0)}{" "}
              items
            </span>
          </div>
        </div> */}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={
            readOnly || config?.readOnly ? undefined : handleDragStart
          }
          onDragOver={readOnly || config?.readOnly ? undefined : handleDragOver}
          onDragEnd={readOnly || config?.readOnly ? undefined : handleDragEnd}
        >
          {/* Columns Container */}
          <div className="flex overflow-x-auto pb-6 invisible-scrollbar flex-1">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                config={config}
                readOnly={readOnly}
                onAddTask={onAddTask}
                onRefresh={onRefresh}
                onItemClick={onItemClick}
                onApproveRequest={onApproveRequest}
              />
            ))}

            {/* Add Column Button */}
            {!readOnly && !config?.readOnly && config?.allowAddTask && (
              <div className="w-80 flex-shrink-0">
                <button className="w-full h-16 bg-gray-100 hover:bg-gray-200 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 transition-all flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800">
                  <svg
                    className="w-5 h-5"
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
                  <span className="font-medium">Add Column</span>
                </button>
              </div>
            )}
          </div>

          <DragOverlay>
            {activeItem && !readOnly && !config?.readOnly ? (
              <div className="transform rotate-3 scale-105 shadow-2xl">
                <KanbanCard
                  item={activeItem}
                  onRefresh={onRefresh}
                  style={config?.cardStyle}
                  readOnly={true}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
