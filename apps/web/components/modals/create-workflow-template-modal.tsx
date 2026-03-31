"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Info,
  Layers,
  Settings2,
} from "lucide-react";
import {
  WorkflowPhase,
  PipelinePreview,
  PhaseDetailEditor,
  PROTECTED_KEYS,
} from "../workflow-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { useSession } from "next-auth/react";
import { arrayMove } from "@dnd-kit/sortable";

export type CreateWorkflowTemplateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export const CreateWorkflowTemplateModal = ({
  isOpen,
  onClose,
  onSuccess,
}: CreateWorkflowTemplateModalProps) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();

  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  const [phases, setPhases] = useState<WorkflowPhase[]>([
    {
      id: "ph-1",
      label: "Pending",
      key: "pending",
      order: 0,
      include: [],
      color: "#94a3b8",
    },
    {
      id: "ph-2",
      label: "Backlog",
      key: "backlog",
      order: 1,
      include: [],
      color: "#6366f1",
    },
    {
      id: "ph-3",
      label: "Completed",
      key: "completed",
      order: 2,
      include: [],
      color: "#10b981",
    },
  ]);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setFormData({ name: "", description: "", is_active: true });
      // Restore defaults
      setPhases([
        {
          id: "ph-1",
          label: "Pending",
          key: "pending",
          order: 0,
          include: [],
          color: "#94a3b8",
        },
        {
          id: "ph-2",
          label: "Backlog",
          key: "backlog",
          order: 1,
          include: [],
          color: "#6366f1",
        },
        {
          id: "ph-3",
          label: "Completed",
          key: "completed",
          order: 2,
          include: [],
          color: "#10b981",
        },
      ]);
    }
  }, [isOpen]);

  const insertPhaseAt = (index: number) => {
    const newId = uuidv4();
    const randomColor = `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`;
    const newPhase = {
      id: newId,
      label: "",
      key: "",
      order: index,
      include: [],
      color: randomColor,
    };
    const updatedPhases = [...phases];
    updatedPhases.splice(index, 0, newPhase);
    setPhases(updatedPhases.map((p, i) => ({ ...p, order: i })));
    setEditingId(newId);
  };

  const removePhase = (id: string) => {
    const phaseToRemove = phases.find((p) => p.id === id);
    if (
      phaseToRemove &&
      PROTECTED_KEYS.includes(phaseToRemove.key.toLowerCase())
    ) {
      return;
    }
    setPhases(phases.filter((p) => p.id !== id));
  };

  const updatePhase = (id: string, updates: Partial<WorkflowPhase>) => {
    setPhases(phases.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleSubmit = async () => {
    if (phases.length < 1) {
      notify.error("At least one phase is required");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        created_by: session?.user.id || "",
        phases: phases.map(({ id: _id, ...p }, i) => ({
          ...p,
          order: i,
        })),
      };
      await apiClient.post("/order-workflows/templates", payload);
      notify.success("Workflow template created");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      notify.error(
        error.response?.data?.message || "Failed to create template",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl h-[90vh] max-h-[800px] bg-white dark:bg-neutral-950 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Stepper Header */}
            <div className="px-10 pt-10 pb-6 flex items-center justify-between border-b border-slate-100 dark:border-neutral-800">
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500",
                      step === 0
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-200"
                        : "bg-violet-50 text-violet-600",
                    )}
                  >
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                      Step 01
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      General Blueprint
                    </span>
                  </div>
                </div>
                <div className="w-10 h-px bg-slate-100" />
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500",
                      step === 1
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-200"
                        : "bg-slate-50 text-slate-400",
                    )}
                  >
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                      Step 02
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Phase Construction
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-neutral-900 rounded-2xl text-slate-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {step === 0 ? (
                  <motion.div
                    key="step0"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 20, opacity: 0 }}
                    className="absolute inset-0 p-10 space-y-8"
                  >
                    <div className="max-w-xl space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                          Template Identity
                        </label>
                        <Input
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          placeholder="e.g. Standard Aerospace Workflow"
                          className="h-14 px-5 text-lg font-medium border-slate-200 rounded-2xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                          Mission Description
                        </label>
                        <Textarea
                          rows={6}
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          placeholder="What makes this workflow unique? When should it be assigned?"
                          className="px-5 py-4 text-sm border-slate-200 rounded-2xl resize-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step1"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="absolute inset-0 flex flex-col p-10 overflow-hidden"
                  >
                    <PipelinePreview
                      phases={phases}
                      editingId={editingId}
                      onSelect={setEditingId}
                      onInsert={insertPhaseAt}
                      onReorder={(activeId, overId) => {
                        const oldIndex = phases.findIndex(
                          (p) => p.id === activeId,
                        );
                        const newIndex = phases.findIndex(
                          (p) => p.id === overId,
                        );
                        setPhases(
                          arrayMove(phases, oldIndex, newIndex).map((p, i) => ({
                            ...p,
                            order: i,
                          })),
                        );
                      }}
                    />

                    <div className="flex-1 overflow-y-auto px-4 pb-20 scroll-smooth">
                      {editingId ? (
                        <PhaseDetailEditor
                          phase={phases.find((p) => p.id === editingId)!}
                          updatePhase={updatePhase}
                          removePhase={(id) => {
                            removePhase(id);
                            setEditingId(null);
                          }}
                        />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                          <div className="w-20 h-20 bg-slate-100 dark:bg-neutral-900 rounded-3xl flex items-center justify-center mb-4">
                            <Layers className="w-8 h-8 text-slate-400" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Pipeline Blueprints
                          </h4>
                          <p className="text-xs max-w-[240px]">
                            Select a stage from the timeline above to configure
                            its manufacturing details.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-10 py-8 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    step === 0 ? "bg-violet-600" : "bg-slate-200",
                  )}
                />
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    step === 1 ? "bg-violet-600" : "bg-slate-200",
                  )}
                />
              </div>

              <div className="flex gap-3">
                {step === 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => setStep(0)}
                    className="rounded-2xl h-12 px-6 gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>
                )}
                {step === 0 ? (
                  <Button
                    onClick={() => setStep(1)}
                    disabled={!formData.name}
                    className="bg-violet-600 hover:bg-violet-700 text-white rounded-2xl h-12 px-8 gap-2 shadow-lg shadow-violet-100"
                  >
                    Set Stages <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || phases.length === 0}
                    className="bg-violet-600 hover:bg-violet-700 text-white rounded-2xl h-12 px-10 shadow-lg shadow-violet-100"
                  >
                    {loading ? "Generating..." : "Finalize Template"}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
