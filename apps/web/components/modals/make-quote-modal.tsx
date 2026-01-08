"use client";

import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DropAnimation,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, GripVertical, Trash2, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// --- Types ---
export type QuotePart = {
  id: string;
  file_name: string;
  snapshot_2d_url?: string;
  material: string;
  quantity: number;
  rfq_code?: string;
};

export type MakeQuoteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  parts: QuotePart[];
  onConfirm: (groups: { parts: string[] }[]) => void;
};

type ItemsState = Record<string, string[]>; // containerId -> array of partIds

// --- Sortable Item Component ---
const SortableItem = ({
  id,
  part,
  isOverlay = false,
}: {
  id: string;
  part: QuotePart;
  isOverlay?: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: id,
    data: {
      type: "Item",
      part,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-slate-100 dark:bg-neutral-800 border border-dashed border-slate-300 dark:border-neutral-700 h-[72px] rounded-xl"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-3 p-3 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-sm touch-none",
        isOverlay
          ? "cursor-grabbing shadow-xl ring-2 ring-primary/20"
          : "hover:border-primary/50",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 dark:bg-neutral-800 overflow-hidden border border-slate-100 dark:border-neutral-700">
        {part.snapshot_2d_url ? (
          <img
            src={part.snapshot_2d_url}
            alt={part.file_name}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Box className="w-4 h-4 text-slate-400" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {part.file_name}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
          <span>{part.material || "No material"}</span>
        </div>
      </div>
    </div>
  );
};

// --- Container Component ---
const Container = ({
  id,
  items,
  partsMap,
  onRemove,
}: {
  id: string;
  items: string[];
  partsMap: Record<string, QuotePart>;
  onRemove?: () => void;
}) => {
  const { setNodeRef } = useSortable({
    id: id,
    data: {
      type: "Container",
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col w-[320px] shrink-0 max-h-full bg-slate-50 dark:bg-neutral-950/50 rounded-2xl border border-slate-200 dark:border-neutral-800"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 rounded-t-2xl backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            Quote Group
          </span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-neutral-800 px-1.5 text-[10px] font-bold text-slate-500">
            {items.length}
          </span>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 p-3 overflow-y-auto min-h-[100px] overflow-x-hidden">
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map((itemId) => (
              <SortableItem key={itemId} id={itemId} part={partsMap[itemId]} />
            ))}
            {items.length === 0 && (
              <div className="h-24 border-2 border-dashed border-slate-200 dark:border-neutral-800 rounded-xl flex items-center justify-center text-xs text-slate-400">
                Drop items here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

// --- Main Modal Component ---
export const MakeQuoteModal = ({
  isOpen,
  onClose,
  parts,
  onConfirm,
}: MakeQuoteModalProps) => {
  const [items, setItems] = useState<ItemsState>({});
  const [containers, setContainers] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const partsMap = React.useMemo(() => {
    const map: Record<string, QuotePart> = {};
    parts.forEach((p) => (map[p.id] = p));
    return map;
  }, [parts]);

  // Initialize Items based on RFQ Groups
  useEffect(() => {
    if (isOpen) {
      const newItems: ItemsState = {};
      const newContainers: string[] = [];
      const groups: Record<string, string[]> = {};

      parts.forEach((part) => {
        const groupKey = part.rfq_code || "Unassigned";
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(part.id);
      });

      Object.entries(groups).forEach(([key, partIds], index) => {
        const containerId = `group-${index}-${key}`; // Unique container ID
        newItems[containerId] = partIds;
        newContainers.push(containerId);
      });

      // Ensure at least one empty container if no parts?
      // Actually if no parts, this modal probably shouldn't act this way.
      // But assuming parts exist.

      setItems(newItems);
      setContainers(newContainers);
    }
  }, [isOpen, parts]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findContainer = (id: string) => {
    if (id in items) {
      return id;
    }
    return Object.keys(items).find((key) => items[key].includes(id));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id;

    if (overId == null || active.id in items) {
      return;
    }

    const overContainer = findContainer(overId as string);
    const activeContainer = findContainer(active.id as string);

    if (!overContainer || !activeContainer) {
      return;
    }

    if (activeContainer !== overContainer) {
      setItems((items) => {
        const activeItems = items[activeContainer];
        const overItems = items[overContainer];
        const overIndex = overItems.indexOf(overId as string);
        const activeIndex = activeItems.indexOf(active.id as string);

        let newIndex;

        if (overId in items) {
          newIndex = overItems.length + 1;
        } else {
          const isBelowOverItem =
            over &&
            active.rect.current.translated &&
            active.rect.current.translated.top >
              over.rect.top + over.rect.height;

          const modifier = isBelowOverItem ? 1 : 0;

          newIndex =
            overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
        }

        return {
          ...items,
          [activeContainer]: [
            ...items[activeContainer].filter((item) => item !== active.id),
          ],
          [overContainer]: [
            ...items[overContainer].slice(0, newIndex),
            items[activeContainer][activeIndex],
            ...items[overContainer].slice(
              newIndex,
              items[overContainer].length,
            ),
          ],
        };
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeContainer = findContainer(active.id as string);
    const overContainer = over ? findContainer(over.id as string) : null;

    if (activeContainer && overContainer && activeContainer === overContainer) {
      const activeIndex = items[activeContainer].indexOf(active.id as string);
      const overIndex = items[overContainer].indexOf(over?.id as string);

      if (activeIndex !== overIndex) {
        setItems((items) => ({
          ...items,
          [activeContainer]: arrayMove(
            items[activeContainer],
            activeIndex,
            overIndex,
          ),
        }));
      }
    }

    setActiveId(null);
  };

  const addContainer = () => {
    const newContainerId = `group-new-${Date.now()}`;
    setContainers([...containers, newContainerId]);
    setItems({
      ...items,
      [newContainerId]: [],
    });
  };

  const removeContainer = (containerId: string) => {
    // If container has items, maybe prevent or move them to another?
    // For now, let's just dump them into the first available container or enforce empty to delete.
    // User wants "clean ui", assume intuitive behavior.
    // If items exist, maybe don't allow delete or ask to move.
    // For simplicity, finding the first other container and moving items there.
    const itemsToMove = items[containerId];
    if (itemsToMove.length > 0) {
      const otherContainer = containers.find((c) => c !== containerId);
      if (otherContainer) {
        setItems((prev) => ({
          ...prev,
          [otherContainer]: [...prev[otherContainer], ...itemsToMove],
          [containerId]: [], // Just to be safe before delete
        }));
        // Then delete safely in next render or just proceed since setState is async but logical flow differs
        // Let's just create a new items object directly
        const newItems = { ...items };
        newItems[otherContainer] = [
          ...newItems[otherContainer],
          ...itemsToMove,
        ];
        delete newItems[containerId];

        setItems(newItems);
        setContainers(containers.filter((c) => c !== containerId));
        return;
      } else {
        // Only container?
        alert("Cannot delete the last group containing items.");
        return;
      }
    }

    const newItems = { ...items };
    delete newItems[containerId];
    setItems(newItems);
    setContainers(containers.filter((c) => c !== containerId));
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  const handleConfirm = () => {
    // Filter out empty groups?
    const groups = containers
      .map((containerId) => items[containerId])
      .filter((groupParts) => groupParts.length > 0)
      .map((groupParts) => ({ parts: groupParts }));

    onConfirm(groups);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-7xl h-[85vh] bg-slate-50 dark:bg-neutral-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden m-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Prepare Quote
                </h2>
                <p className="text-sm text-slate-500">
                  Organize your parts into quote groups. Each group will be
                  processed as a separate RFQ.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={addContainer}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Group
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Board */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              measuring={{
                droppable: {
                  strategy: MeasuringStrategy.Always,
                },
              }}
            >
              <div className="flex-1 overflow-x-auto glass-scrollbar p-8">
                <div className="flex h-full gap-6 pb-4 min-w-max">
                  <SortableContext items={containers}>
                    {containers.map((containerId) => (
                      <Container
                        key={containerId}
                        id={containerId}
                        items={items[containerId]}
                        partsMap={partsMap}
                        onRemove={
                          containers.length > 1
                            ? () => removeContainer(containerId)
                            : undefined
                        }
                      />
                    ))}
                  </SortableContext>
                  <button
                    onClick={addContainer}
                    className="flex flex-col items-center justify-center w-[320px] shrink-0 h-[200px] border-2 border-dashed border-slate-200 dark:border-neutral-800 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900/50 transition-all gap-3"
                  >
                    <div className="p-3 bg-white dark:bg-neutral-800 rounded-full shadow-sm">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="font-semibold">Add New Group</span>
                  </button>
                </div>
              </div>

              <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (
                  <SortableItem
                    id={activeId}
                    part={partsMap[activeId]}
                    isOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex justify-end gap-3">
              <Button
                onClick={onClose}
                className="rounded-sm"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className="rounded-sm"
                variant="cta"
              >
                Create Quotes
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
