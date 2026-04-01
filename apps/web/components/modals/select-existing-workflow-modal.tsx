"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, ChevronRight, ClipboardList, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SelectExistingWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onSuccess: () => void;
}

export const SelectExistingWorkflowModal = ({
  isOpen,
  onClose,
  orderId,
  onSuccess,
}: SelectExistingWorkflowModalProps) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setSelectedId(null);
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get("/order-workflows/templates");
      if (response.data.success) {
        setTemplates(response.data.data);
      }
    } catch (error) {
      console.error(error);
      notify.error("Failed to fetch templates");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedId) return;
    try {
      setLoading(true);
      await apiClient.post(`/order-workflows/assign/${orderId}`, {
        order_workflow_id: selectedId,
      });
      notify.success("Workflow assigned successfully");
      onSuccess();
      onClose();
    } catch (error: any) {
      notify.error(
        error.response?.data?.message || "Failed to assign template",
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
            className="relative w-full max-w-xl h-[80vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Assign Existing Workflow</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Choose a Blueprint</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 pb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  className="pl-11 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white"
                  placeholder="Search templates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-2">
              <div className="space-y-3">
                {loading && templates.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">Loading templates...</div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">No templates found</div>
                ) : (
                  filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedId(template.id)}
                      className={cn(
                        "w-full p-4 rounded-2xl border-2 text-left transition-all duration-300",
                        selectedId === template.id 
                          ? "border-amber-500 bg-amber-50 shadow-lg shadow-amber-100" 
                          : "border-slate-100 hover:border-amber-200 hover:bg-slate-50/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 mr-4">
                          <div className="text-sm font-bold text-slate-900 truncate mb-0.5">{template.name}</div>
                          <div className="text-xs text-slate-500 line-clamp-2">{template.description || "No description provided"}</div>
                        </div>
                        {selectedId === template.id ? (
                           <CheckCircle2 className="w-6 h-6 text-amber-600 shrink-0" />
                        ) : (
                           <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1 h-12 rounded-2xl border-slate-200 font-bold"
              >
                Cancel
              </Button>
              <Button
                disabled={!selectedId || loading}
                onClick={handleAssign}
                className="flex-1 h-12 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg shadow-amber-100"
              >
                {loading ? "Assigning..." : "Assign Template"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
