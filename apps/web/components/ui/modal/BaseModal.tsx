"use client";

import type React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-[95vw]",
};

export function BaseModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: BaseModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(sizeClasses[size], "p-0 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border-slate-200 dark:border-slate-800", className)}>
        <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 text-left">
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="px-6 py-6 border-none">
          {children}
        </div>

        {footer && (
          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
