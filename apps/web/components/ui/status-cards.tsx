"use client";

import React from "react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";

export type StatusItem = {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
  color?:
    | "gray"
    | "blue"
    | "green"
    | "purple"
    | "orange"
    | "rose"
    | "indigo"
    | "emerald"
    | "amber"
    | "sky"
    | "pink"
    | "teal"
    | "violet"
    | "cyan"
    | "slate"
    | "red"
    | "lime";
};

type StatusCardsProps = {
  items: StatusItem[];
  isLoading?: boolean;
  className?: string;
};

const colorVariants = {
  blue: "from-blue-500/20 to-blue-600/5 text-blue-600 border-blue-200/50 dark:border-blue-500/20",
  green:
    "from-green-500/20 to-green-600/5 text-green-600 border-green-200/50 dark:border-green-500/20",
  purple:
    "from-purple-500/20 to-purple-600/5 text-purple-600 border-purple-200/50 dark:border-purple-500/20",
  orange:
    "from-orange-500/20 to-orange-600/5 text-orange-600 border-orange-200/50 dark:border-orange-500/20",
  rose: "from-rose-500/20 to-rose-600/5 text-rose-600 border-rose-200/50 dark:border-rose-500/20",
  indigo:
    "from-indigo-500/20 to-indigo-600/5 text-indigo-600 border-indigo-200/50 dark:border-indigo-500/20",
  gray: "from-gray-500/20 to-gray-600/5 text-gray-600 border-gray-200/50 dark:border-gray-500/20",

  // New Additions
  emerald:
    "from-emerald-500/20 to-emerald-600/5 text-emerald-600 border-emerald-200/50 dark:border-emerald-500/20",
  amber:
    "from-amber-500/20 to-amber-600/5 text-amber-600 border-amber-200/50 dark:border-amber-500/20",
  sky: "from-sky-500/20 to-sky-600/5 text-sky-600 border-sky-200/50 dark:border-sky-500/20",
  pink: "from-pink-500/20 to-pink-600/5 text-pink-600 border-pink-200/50 dark:border-pink-500/20",
  teal: "from-teal-500/20 to-teal-600/5 text-teal-600 border-teal-200/50 dark:border-teal-500/20",
  violet:
    "from-violet-500/20 to-violet-600/5 text-violet-600 border-violet-200/50 dark:border-violet-500/20",
  cyan: "from-cyan-500/20 to-cyan-600/5 text-cyan-600 border-cyan-200/50 dark:border-cyan-500/20",
  slate:
    "from-slate-500/20 to-slate-600/5 text-slate-600 border-slate-200/50 dark:border-slate-500/20",
  red: "from-red-500/20 to-red-600/5 text-red-600 border-red-200/50 dark:border-red-500/20",
  lime: "from-lime-500/20 to-lime-600/5 text-lime-600 border-lime-200/50 dark:border-lime-500/20",
};

const iconBgVariants = {
  blue: "bg-blue-100 dark:bg-blue-500/20 text-blue-600",
  green: "bg-green-100 dark:bg-green-500/20 text-green-600",
  purple: "bg-purple-100 dark:bg-purple-500/20 text-purple-600",
  orange: "bg-orange-100 dark:bg-orange-500/20 text-orange-600",
  rose: "bg-rose-100 dark:bg-rose-500/20 text-rose-600",
  indigo: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600",
  gray: "bg-gray-100 dark:bg-gray-500/20 text-gray-600",
  emerald: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600",
  amber: "bg-amber-100 dark:bg-amber-500/20 text-amber-600",
  sky: "bg-sky-100 dark:bg-sky-500/20 text-sky-600",
  pink: "bg-pink-100 dark:bg-pink-500/20 text-pink-600",
  teal: "bg-teal-100 dark:bg-teal-500/20 text-teal-600",
  violet: "bg-violet-100 dark:bg-violet-500/20 text-violet-600",
  cyan: "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600",
  slate: "bg-slate-100 dark:bg-slate-500/20 text-slate-600",
  red: "bg-red-100 dark:bg-red-500/20 text-red-600",
  lime: "bg-lime-100 dark:bg-lime-500/20 text-lime-600",
};

export function StatusCards({ items, isLoading, className }: StatusCardsProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
          className,
        )}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const colorClass = item.color
          ? colorVariants[item.color]
          : "from-slate-500/10 to-transparent border-slate-200/50 dark:border-white/10";
        const iconBgClass = item.color
          ? iconBgVariants[item.color]
          : "bg-slate-100 dark:bg-white/10 text-slate-600";

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className={cn(
              "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 transition-all duration-300",
              "hover:shadow-2xl hover:shadow-indigo-500/10",
              colorClass,
            )}
            style={{
              backdropFilter: "blur(24px) saturate(200%)",
              WebkitBackdropFilter: "blur(24px) saturate(200%)",
            }}
          >
            {/* Liquid Glass Shine */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative flex flex-col h-full">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500/70 dark:text-slate-400">
                  {item.label}
                </span>
                {Icon && (
                  <div
                    className={cn(
                      "rounded-xl p-2 transition-transform duration-300 group-hover:scale-110",
                      iconBgClass,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {item.value}
                </span>
                {item.trend && (
                  <div
                    className={cn(
                      "flex items-center gap-0.5 text-xs font-semibold",
                      item.trend.isPositive
                        ? "text-emerald-500"
                        : "text-rose-500",
                    )}
                  >
                    {item.trend.isPositive ? (
                      <TrendingUp size={12} />
                    ) : (
                      <TrendingDown size={12} />
                    )}
                    {item.trend.value}
                  </div>
                )}
              </div>

              {(item.subValue || item.trend) && (
                <div className="mt-auto pt-2">
                  {item.subValue && (
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      {item.subValue}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Accent Border for Glass Depth */}
            <div className="absolute inset-[1px] rounded-[inherit] border border-white/20 pointer-events-none opacity-50" />

            {/* Subtle Liquid Edge */}
            <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-current opacity-30 transition-all duration-500 group-hover:w-full" />
          </motion.div>
        );
      })}
    </div>
  );
}
