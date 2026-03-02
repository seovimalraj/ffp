"use client";

import { X, Cpu, ChevronDown, BrainCog } from "lucide-react";
import type { PartConfig } from "@/types/part-config";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion"; // Added Framer Motion
import { useState, useMemo, useEffect } from "react"; // Added useState import
import { Button } from "@/components/ui/button"; // Added Button import
import { generateSuggestions } from "@/utils/suggestion-utils"; // Added generateSuggestions import
import { useSuggestionContext } from "@/components/store/suggestion-store";

// Declare SuggestionSidebarProps interface
interface SuggestionSidebarProps {
  parts: PartConfig[];
  onApplySuggestion: (suggestion: any) => void;
  filterPart?: string;
}

// Category types
type SuggestionCategory =
  | "cost-optimization"
  | "dfm"
  | "quality-optimization"
  | "all";

export function SuggestionSidebar({
  parts,
  onApplySuggestion,
  filterPart,
}: SuggestionSidebarProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedPart, setSelectedPart] = useState<string>(filterPart || "all");
  const [selectedCategory, setSelectedCategory] =
    useState<SuggestionCategory>("all");
  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const {
    isOpen,
    setIsOpen,
    suggestions: allSuggestions,
    setSuggestions,
  } = useSuggestionContext();

  useEffect(() => {
    if (filterPart !== undefined) setSelectedPart(filterPart || "all");
    setSelectedCategory("all");
  }, [filterPart]);

  useEffect(() => {
    const currentSuggestions = generateSuggestions(parts);
    setSuggestions(currentSuggestions);
  }, [parts]);

  const toggleSidebar = () => {
    if (!isOpen) {
      setIsAnalyzing(true);
      setTimeout(() => setIsAnalyzing(false), 1500);
    }
    setIsOpen(!isOpen);
  };

  // Categorize suggestions
  const categorizedSuggestions = useMemo(() => {
    return {
      "cost-optimization": allSuggestions.filter(
        (s) =>
          s.category === "volume-discount" ||
          s.category === "premium-service" ||
          s.category === "performance-upgrade" ||
          s.type === "volume-discount" ||
          s.type === "premium-upgrade" ||
          s.type === "bundle" ||
          s.type === "express-shipping",
      ),
      dfm: allSuggestions.filter(
        (s) =>
          s.type === "dfm" ||
          s.type === "tolerance" ||
          s.type === "secondary-ops",
      ),
      "quality-optimization": allSuggestions.filter(
        (s) =>
          s.category === "quality-improvement" ||
          (![
            "dfm",
            "tolerance",
            "secondary-ops",
            "volume-discount",
            "premium-upgrade",
            "bundle",
            "express-shipping",
          ].includes(s.type) &&
            ![
              "volume-discount",
              "premium-service",
              "performance-upgrade",
            ].includes(s.category || "")),
      ),
    };
  }, [allSuggestions]);

  // Get unique parts
  const uniqueParts = useMemo(() => {
    const partMap = new Map();
    parts.forEach((part) => {
      if (!partMap.has(part.id)) {
        partMap.set(part.id, part);
      }
    });
    return Array.from(partMap.values());
  }, [parts]);

  // Filter suggestions based on selected part and category
  const filteredSuggestions = useMemo(() => {
    let filtered = allSuggestions;

    // Filter by part
    if (selectedPart !== "all") {
      filtered = filtered.filter((s) => s.partId === selectedPart);
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = categorizedSuggestions[selectedCategory] || [];
      if (selectedPart !== "all") {
        filtered = filtered.filter((s) => s.partId === selectedPart);
      }
    }

    // Sort: Cost Optimization first, then DFM Suggestions, then Quality Optimization
    return filtered.sort((a, b) => {
      const getOrder = (suggestion: any) => {
        if (categorizedSuggestions["cost-optimization"].includes(suggestion))
          return 1;
        if (categorizedSuggestions.dfm.includes(suggestion)) return 2;
        if (categorizedSuggestions["quality-optimization"].includes(suggestion))
          return 3;
        return 4;
      };
      return getOrder(a) - getOrder(b);
    });
  }, [allSuggestions, selectedPart, selectedCategory, categorizedSuggestions]);

  // Helper to get count for a category considering selected part
  const getFilteredCategoryCount = (category: SuggestionCategory | "all") => {
    if (category === "all") {
      return selectedPart === "all"
        ? allSuggestions.length
        : allSuggestions.filter((s) => s.partId === selectedPart).length;
    }

    const suggestionsInCategory = categorizedSuggestions[category] || [];
    return selectedPart === "all"
      ? suggestionsInCategory.length
      : suggestionsInCategory.filter((s) => s.partId === selectedPart).length;
  };

  // Check if suggestion should show apply button (not DFM or quality optimization)
  const shouldShowApplyButton = (suggestion: any) => {
    return (
      !categorizedSuggestions.dfm.includes(suggestion) &&
      !categorizedSuggestions["quality-optimization"].includes(suggestion)
    );
  };

  // Check if any filter is active
  const isFilterActive = selectedPart !== "all" || selectedCategory !== "all";

  // Clear all filters
  const clearFilters = () => {
    setSelectedPart("all");
    setSelectedCategory("all");
    setIsPartDropdownOpen(false);
    setIsCategoryDropdownOpen(false);
  };

  return (
    <>
      {/* Floating Button at Bottom */}
      <div className="fixed bottom-6 right-6 z-40">
        {/* <Button
          onClick={toggleSidebar}
          className="animated-gradient-btn relative h-14 px-2 hover:px-6 group rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-105 text-white font-bold gap-3 transition-all duration-300 group overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 pulse-glow bg-blue-400/20 rounded-2xl" />
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <img
                src="/icons/ai-suggestion.png"
                alt="Logo"
                className="w-10 grayscale invert"
              />
              {filteredSuggestions.length > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-blue-600 rounded-full text-[11px] font-black flex items-center justify-center shadow-sm">
                  {filteredSuggestions.length}
                </span>
              )}
            </div>
            <span
              className="
              overflow-hidden
              max-w-0
              opacity-0
              whitespace-nowrap
              transition-all
              duration-300
              ease-out
              group-hover:max-w-[200px]
              group-hover:opacity-100
            "
            >
              {filteredSuggestions.length > 0
                ? "Smart Optimization"
                : "Analyze Quote"}
            </span>
          </div>
        </Button> */}
      </div>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[460px] bg-white text-zinc-950 border-l border-zinc-200 shadow-2xl z-50 transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col overflow-hidden",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-blue-200 shadow-lg">
                <BrainCog className="w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                  Optimization Engine
                  <span className="text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded text-white font-bold tracking-widest leading-none uppercase">
                    Beta
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 font-medium">
                  {isAnalyzing
                    ? "Scanning part geometry..."
                    : "Intelligent manufacturing insights"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="rounded-full h-8 w-8 text-zinc-400 hover:text-zinc-900"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        {!isAnalyzing && (
          <div className="px-6 py-4 border-b border-zinc-100 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Filters
              </span>
              {isFilterActive && (
                <button
                  onClick={clearFilters}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear All
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Part Selector Dropdown */}
              <div className="relative">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">
                  Part Filter
                </label>
                <button
                  onClick={() => setIsPartDropdownOpen(!isPartDropdownOpen)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 transition-colors"
                >
                  <span className="truncate">
                    {selectedPart === "all"
                      ? `All Parts (${uniqueParts.length})`
                      : uniqueParts.find((p) => p.id === selectedPart)
                          ?.fileName || "Select Part"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 text-zinc-400 transition-transform",
                      isPartDropdownOpen && "rotate-180",
                    )}
                  />
                </button>

                <AnimatePresence>
                  {isPartDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                    >
                      <button
                        onClick={() => {
                          setSelectedPart("all");
                          setIsPartDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-xs hover:bg-zinc-50 transition-colors",
                          selectedPart === "all" &&
                            "bg-blue-50 text-blue-600 font-bold",
                        )}
                      >
                        All Parts ({uniqueParts.length})
                      </button>
                      {uniqueParts.map((part) => (
                        <button
                          key={part.id}
                          onClick={() => {
                            setSelectedPart(part.id);
                            setIsPartDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-xs hover:bg-zinc-50 transition-colors truncate",
                            selectedPart === part.id &&
                              "bg-blue-50 text-blue-600 font-bold",
                          )}
                        >
                          {part.fileName}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Category Filter Dropdown */}
              <div className="relative">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">
                  Category
                </label>
                <button
                  onClick={() =>
                    setIsCategoryDropdownOpen(!isCategoryDropdownOpen)
                  }
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 transition-colors"
                >
                  <span className="flex items-center gap-2 truncate">
                    {selectedCategory === "all"
                      ? "All"
                      : selectedCategory === "cost-optimization"
                        ? "Cost"
                        : selectedCategory === "dfm"
                          ? "DFM"
                          : "Quality"}
                    <span className="text-[10px] text-zinc-400 font-normal">
                      ({getFilteredCategoryCount(selectedCategory)})
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 text-zinc-400 transition-transform",
                      isCategoryDropdownOpen && "rotate-180",
                    )}
                  />
                </button>

                <AnimatePresence>
                  {isCategoryDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-xl overflow-hidden"
                    >
                      {[
                        { id: "all", label: "All Categories", color: "zinc" },
                        {
                          id: "cost-optimization",
                          label: "Cost",
                          color: "emerald",
                        },
                        {
                          id: "quality-optimization",
                          label: "Quality",
                          color: "blue",
                        },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id as SuggestionCategory);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-xs hover:bg-zinc-50 transition-colors flex items-center justify-between",
                            selectedCategory === cat.id &&
                              "bg-zinc-50 font-bold",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {cat.id !== "all" && (
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  cat.color === "emerald" && "bg-emerald-500",
                                  cat.color === "amber" && "bg-amber-500",
                                  cat.color === "blue" && "bg-blue-500",
                                  cat.color === "zinc" && "bg-zinc-500",
                                )}
                              />
                            )}
                            {cat.label}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-normal">
                            {getFilteredCategoryCount(
                              cat.id as SuggestionCategory,
                            )}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto invisible-scrollbar p-6 space-y-4">
          {isAnalyzing ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="relative mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 border-2 border-blue-500/10 border-t-blue-500 rounded-full"
                />
                <img
                  src="/icons/ai-suggestion.png"
                  className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"
                  alt=""
                />
              </div>
              <h3 className="text-zinc-900 font-bold text-lg mb-2">
                Analyzing Geometry
              </h3>
              <p className="text-zinc-500 text-sm max-w-[240px]">
                Our AI model is currently evaluating your design against
                manufacturing constraints.
              </p>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center h-full opacity-40">
              <Cpu className="w-12 h-12 mb-4 text-zinc-300" />
              <p className="text-sm text-zinc-500 font-medium">
                No suggestions found for the selected filters
              </p>
            </div>
          ) : (
            filteredSuggestions.map((suggestion, index) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={suggestion.id}
                className="group relative bg-white rounded-2xl border border-zinc-200 p-5 hover:border-blue-200 hover:shadow-md transition-all duration-300"
              >
                {/* Badge/Category Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                        suggestion.color === "blue" &&
                          "bg-blue-50 text-blue-600",
                        suggestion.color === "purple" &&
                          "bg-purple-50 text-purple-600",
                        suggestion.color === "green" &&
                          "bg-emerald-50 text-emerald-600",
                        suggestion.color === "amber" &&
                          "bg-amber-50 text-amber-600",
                        suggestion.color === "red" && "bg-red-50 text-red-600",
                        suggestion.color === "orange" &&
                          "bg-orange-50 text-orange-600",
                        suggestion.color === "indigo" &&
                          "bg-indigo-50 text-indigo-600",
                        suggestion.color === "teal" &&
                          "bg-teal-50 text-teal-600",
                      )}
                    >
                      {suggestion.preview ? (
                        <img
                          src={suggestion.preview}
                          className="w-full h-full object-cover rounded-lg"
                          alt=""
                        />
                      ) : (
                        <Cpu className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {suggestion.type}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {suggestion.impact.savingsPercentage && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {suggestion.impact.savingsPercentage}% SAVINGS
                      </span>
                    )}
                    {suggestion.priority === "critical" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                        CRITICAL
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-1 mb-4">
                  <h3 className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">
                    {suggestion.title}
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                    {suggestion.description}
                  </p>
                </div>

                {/* Details Grid */}
                <div className="bg-zinc-50 rounded-xl p-3 grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-0.5">
                      Current
                    </span>
                    <span className="text-xs font-semibold text-zinc-400 line-through truncate block">
                      {suggestion.currentValue}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-0.5">
                      Recommended
                    </span>
                    <span className="text-xs font-bold text-zinc-900 truncate block">
                      {suggestion.suggestedValue}
                    </span>
                  </div>
                </div>

                {/* Impact Row */}
                {(suggestion.impact.savings !== undefined ||
                  suggestion.impact.lifetimeSavings ||
                  suggestion.impact.revenueIncrease) && (
                  <div className="flex items-center justify-between mb-4 px-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">
                      Estimated Impact
                    </span>
                    <span
                      className={cn(
                        "text-sm font-black",
                        (suggestion?.impact?.savings || 0) > 0
                          ? "text-emerald-500"
                          : "text-blue-600",
                      )}
                    >
                      {suggestion.impact.savings !== undefined &&
                        suggestion.impact.savings !== 0 &&
                        `$${Math.abs(suggestion.impact.savings).toFixed(2)}`}
                      {suggestion.impact.revenueIncrease &&
                        suggestion.impact.revenueIncrease > 0 &&
                        `+$${suggestion.impact.revenueIncrease.toFixed(0)}`}
                    </span>
                  </div>
                )}

                {/* Action */}
                {shouldShowApplyButton(suggestion) ? (
                  <Button
                    onClick={() => {
                      onApplySuggestion(suggestion);
                      setIsOpen(false);
                    }}
                    className="w-full h-9 rounded-xl bg-zinc-900 hover:bg-blue-600 text-white text-xs font-bold transition-all"
                  >
                    Apply Optimization
                  </Button>
                ) : (
                  <div className="text-center pt-2 border-t border-zinc-100 mt-2">
                    <p className="text-[10px] text-zinc-400 font-medium italic">
                      {categorizedSuggestions.dfm.includes(suggestion)
                        ? "Geometric design change required"
                        : "Non-automated quality enhancement"}
                    </p>
                  </div>
                )}

                {/* Part Name Footer */}
                <div className="mt-3 flex items-center gap-1.5 opacity-60">
                  <div className="w-1 h-1 rounded-full bg-zinc-300" />
                  <span className="text-[9px] font-bold text-zinc-400 uppercase truncate">
                    Part: {suggestion.partName}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
