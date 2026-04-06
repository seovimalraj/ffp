"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X, AlertTriangle, Info, Loader2 } from "lucide-react";

interface ToastCardProps {
  title: string;
  message?: string;
  type?: "success" | "error" | "info" | "warning" | "loading";
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
}

export function ToastCard({
  title,
  message,
  type = "info",
  onClose,
  autoClose = true,
  duration = 5000,
}: ToastCardProps) {
  const variants = {
    success: {
      gradient: "from-emerald-500 to-teal-600",
      glow: "shadow-emerald-500/25",
      icon: Check,
      iconBg: "bg-emerald-500",
    },
    error: {
      gradient: "from-rose-500 to-red-600",
      glow: "shadow-rose-500/25",
      icon: X,
      iconBg: "bg-rose-500",
    },
    warning: {
      gradient: "from-amber-500 to-orange-600",
      glow: "shadow-amber-500/25",
      icon: AlertTriangle,
      iconBg: "bg-amber-500",
    },
    info: {
      gradient: "from-blue-500 to-indigo-600",
      glow: "shadow-blue-500/25",
      icon: Info,
      iconBg: "bg-blue-500",
    },
    loading: {
      gradient: "from-zinc-400 to-zinc-600",
      glow: "shadow-zinc-500/25",
      icon: Loader2,
      iconBg: "bg-zinc-500",
    },
  };

  const variant = variants[type];
  const IconComponent = variant.icon;

  useEffect(() => {
    if (!autoClose || !onClose) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [autoClose, onClose, duration]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`relative w-80 overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ${variant.glow} border border-zinc-200/50 dark:border-zinc-800/50`}
    >
      {/* Gradient accent line */}
      <div className={`h-1 w-full bg-gradient-to-r ${variant.gradient}`} />

      <div className="flex items-start gap-3 p-4">
        {/* Icon with gradient background */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
          className={`flex-shrink-0 w-9 h-9 rounded-xl ${variant.iconBg} flex items-center justify-center shadow-lg`}
        >
          <IconComponent className={`w-5 h-5 text-white ${type === "loading" ? "animate-spin" : ""}`} strokeWidth={2.5} />
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 leading-tight"
          >
            {title}
          </motion.p>
          {message && (
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed"
            >
              {message}
            </motion.p>
          )}
        </div>

        {/* Close button */}
        {onClose && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.1, backgroundColor: "rgba(0,0,0,0.05)" }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      {/* Progress bar */}
      {autoClose && (
        <div className="h-0.5 w-full bg-zinc-100 dark:bg-zinc-800">
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: duration / 1000, ease: "linear" }}
            className={`h-full bg-gradient-to-r ${variant.gradient}`}
          />
        </div>
      )}
    </motion.div>
  );
}
