"use client";

import React from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type WorkflowPhase = {
  id: string; // Used for DnD sorting
  label: string;
  key: string;
  order: number;
  include: string[];
  color: string;
};

export const ROLES = [
  "cnc-machining",
  "sheet-metal",
  "forging",
  "extrusion",
  "casting",
];

export const PROTECTED_KEYS = ["pending", "backlog", "completed"];

// --- Sortable Preview Node Component ---
export const SortablePreviewNode = ({
  phase,
  index,
  isActive,
  isLast,
  onSelect,
  onInsert,
}: {
  phase: WorkflowPhase;
  index: number;
  isActive: boolean;
  isLast: boolean;
  onSelect: (id: string) => void;
  onInsert: (index: number) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      <button
        onClick={() => onSelect(phase.id)}
        {...attributes}
        {...listeners}
        className={cn(
          "flex flex-col items-center gap-3 min-w-[100px] transition-all outline-none group cursor-grab active:cursor-grabbing",
          isDragging ? "opacity-0" : "scale-100",
          isActive ? "scale-110" : "hover:scale-105",
        )}
      >
        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border-2 transition-all relative",
            isActive
              ? "border-violet-600 ring-4 ring-violet-100"
              : "border-white dark:border-neutral-800",
          )}
          style={{
            backgroundColor: phase.color,
            boxShadow: isActive
              ? `0 15px 30px -10px ${phase.color}66`
              : `0 10px 20px -5px ${phase.color}33`,
          }}
        >
          {isActive ? (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 rounded-full flex items-center justify-center text-[8px] font-bold text-white border-2 border-white">
              <Plus className="w-2.5 h-2.5" />
            </div>
          ) : (
            <span className="text-white font-black text-xs group-hover:hidden">
              {index + 1}
            </span>
          )}
          <Settings2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:block" />
        </div>
        <div className="flex flex-col items-center">
          <span
            className={cn(
              "text-[10px] font-black uppercase tracking-widest truncate max-w-[90px] transition-colors",
              isActive ? "text-violet-600" : "text-slate-900 dark:text-white",
            )}
          >
            {phase.label || "Untitled"}
          </span>
        </div>
      </button>

      {!isLast && (
        <div className=" relative flex-1 min-w-[40px] h-0.5 bg-slate-100 dark:bg-neutral-800 -mt-8 flex items-center justify-center">
          <button
            onClick={() => onInsert(index + 1)}
            className="absolute w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center transition-all hover:scale-125 z-10 shadow-md"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

// --- Pipeline Preview Component ---
export const PipelinePreview = ({
  phases,
  editingId,
  onSelect,
  onInsert,
  onReorder,
}: {
  phases: WorkflowPhase[];
  editingId: string | null;
  onSelect: (id: string) => void;
  onInsert: (index: number) => void;
  onReorder: (activeId: string, overId: string) => void;
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id, over.id);
    }
  };

  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-6 px-10 glass-scrollbar scroll-smooth bg-slate-50/50 dark:bg-neutral-900/50 rounded-3xl pt-8">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={phases.map((p) => p.id)}
          strategy={horizontalListSortingStrategy}
        >
          {phases.map((phase, i) => (
            <SortablePreviewNode
              key={phase.id}
              phase={phase}
              index={i}
              isLast={i === phases.length - 1}
              isActive={editingId === phase.id}
              onSelect={onSelect}
              onInsert={onInsert}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

// --- Focused Detail Editor Component ---
export const PhaseDetailEditor = ({
  phase,
  removePhase,
  updatePhase,
}: {
  phase: WorkflowPhase;
  removePhase: (id: string) => void;
  updatePhase: (id: string, updates: Partial<WorkflowPhase>) => void;
}) => {
  const isProtected = PROTECTED_KEYS.includes(phase.key.toLowerCase());

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 bg-white dark:bg-neutral-900 rounded-[2rem] border border-slate-100 dark:border-neutral-800 shadow-xl shadow-slate-200/40 relative"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div
            className="w-4 h-10 rounded-full"
            style={{ backgroundColor: phase.color }}
          />
          <div>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">
              {phase.label || "Untitled Stage"}
            </h4>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Editing Phase detail
            </p>
          </div>
        </div>
        {!isProtected && (
          <Button
            onClick={() => removePhase(phase.id)}
            variant="ghost"
            size="sm"
            className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete Phase
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block px-1">
              Public Label
            </label>
            <Input
              autoFocus
              className="h-14 px-5 text-sm font-medium bg-slate-50 border-none rounded-2xl"
              value={phase.label}
              disabled={isProtected}
              onChange={(e) => {
                const label = e.target.value;
                const key = label
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "");
                updatePhase(phase.id, { label, key });
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block px-1">
              System Key
            </label>
            <Input
              className="h-14 px-5 text-sm font-mono bg-slate-50 border-none rounded-2xl"
              value={phase.key}
              onChange={(e) => updatePhase(phase.id, { key: e.target.value })}
              disabled={isProtected}
            />
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block px-1">
              Process Filter
            </label>
            <div className="flex flex-wrap gap-2.5">
              {ROLES.map((role) => {
                const isActive = phase.include.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      const newInclude = isActive
                        ? phase.include.filter((r) => r !== role)
                        : [...phase.include, role];
                      updatePhase(phase.id, { include: newInclude });
                    }}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border",
                      isActive
                        ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200"
                        : "bg-white text-slate-400 border-slate-100 hover:border-slate-200",
                    )}
                  >
                    {role.replace("-", " ")}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block px-1">
              Theme Color
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                className="w-20 h-14 p-0.5 rounded-[1.2rem] cursor-pointer bg-white border-2 border-slate-100"
                value={phase.color}
                onChange={(e) =>
                  updatePhase(phase.id, { color: e.target.value })
                }
              />
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-slate-900 uppercase">
                  {phase.color}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  HEX Code
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
