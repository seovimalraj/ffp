"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FloatingAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive" | "ghost" | "secondary";
  className?: string;
  disabled?: boolean;
}

export interface FloatingActionsProps {
  count: number;
  totalCount?: number;
  onClear: () => void;
  actions: FloatingAction[];
  itemLabel?: string;
  show?: boolean;
}

export const FloatingActions = ({
  count,
  totalCount,
  onClear,
  actions,
  itemLabel = "item",
  show = true,
}: FloatingActionsProps) => {
  return (
    <AnimatePresence>
      {show && count > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0, x: "-50%", scale: 0.9 }}
          animate={{ y: 0, opacity: 1, x: "-50%", scale: 1 }}
          exit={{ y: 100, opacity: 0, x: "-50%", scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "fixed bottom-8 left-1/2 z-[100]",
            "flex items-center gap-6 px-6 py-4",
            "rounded-[2rem] border border-white/40 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]",
            "backdrop-blur-[20px] bg-white/60 dark:bg-slate-900/60",
            "before:absolute before:inset-0 before:p-[1px] before:rounded-[2rem] before:bg-gradient-to-b before:from-white/40 before:to-transparent before:-z-10",
          )}
        >
          {/* Liquid Glass Shine Effect */}
          <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
            <div className="absolute top-[-100%] left-[-100%] w-[300%] h-[300%] bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2)_0%,transparent_50%)] animate-[spin_20s_linear_infinite]" />
          </div>

          {/* Selection Info */}
          <div className="flex items-center gap-4 relative z-10">
            <div className="relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30"
              >
                <span className="text-sm font-bold text-white">{count}</span>
              </motion.div>
              {/* Pulse effect */}
              <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20" />
            </div>
            <div className="flex flex-col min-w-[120px]">
              <span className="text-sm font-black text-slate-900 dark:text-white items-center gap-1.5 flex">
                {count} {count === 1 ? itemLabel : `${itemLabel}s`} selected
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {totalCount !== undefined && (
                  <>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {totalCount} Total
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                  </>
                )}
                <button
                  onClick={onClear}
                  className="text-[10px] uppercase tracking-wider font-bold text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Glass Separator */}
          <div className="h-10 w-px bg-gradient-to-b from-transparent via-slate-200 dark:via-slate-700 to-transparent relative z-10" />

          {/* Actions */}
          <div className="flex items-center gap-3 relative z-10">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || "outline"}
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  "rounded-2xl font-bold text-sm h-11 px-5 transition-all duration-300 active:scale-95",
                  action.variant === "outline" &&
                    "bg-white/40 dark:bg-slate-800/40 border-slate-200/50 dark:border-white/5 hover:bg-white/80 dark:hover:bg-slate-800/80 hover:shadow-lg backdrop-blur-sm",
                  action.variant === "default" &&
                    "bg-slate-900 border-none hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100",
                  action.className,
                )}
              >
                <span className="flex items-center gap-2">
                  {action.icon}
                  {action.label}
                </span>
              </Button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
