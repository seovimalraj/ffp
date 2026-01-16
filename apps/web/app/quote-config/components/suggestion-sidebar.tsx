"use client";

import { X, Cpu, ChevronDown } from "lucide-react";
import type { PartConfig } from "@/types/part-config";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion"; // Added Framer Motion
import { useState, useMemo } from "react"; // Added useState import
import { Button } from "@/components/ui/button"; // Added Button import
import { generateSuggestions } from "@/utils/suggestion-utils"; // Added generateSuggestions import

// Declare SuggestionSidebarProps interface
interface SuggestionSidebarProps {
  parts: PartConfig[];
  onApplySuggestion: (suggestion: any) => void;
}

// Category types
type SuggestionCategory = "cost-optimization" | "dfm" | "quality-optimization" | "all";

export function SuggestionSidebar({
  parts,
  onApplySuggestion,
}: SuggestionSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedPart, setSelectedPart] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<SuggestionCategory>("all");
  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const toggleSidebar = () => {
    if (!isOpen) {
      setIsAnalyzing(true);
      setTimeout(() => setIsAnalyzing(false), 1500);
    }
    setIsOpen(!isOpen);
  };

  const allSuggestions = generateSuggestions(parts);
  
  // Categorize suggestions
  const categorizedSuggestions = useMemo(() => {
    return {
      marketing: allSuggestions.filter(s => 
        s.category === "volume-discount" || 
        s.category === "premium-service" || 
        s.category === "performance-upgrade" ||
        s.type === "volume-discount" ||
        s.type === "premium-upgrade" ||
        s.type === "bundle" ||
        s.type === "express-shipping"
      ),
      dfm: allSuggestions.filter(s => 
        s.type === "dfm" || 
        s.type === "tolerance" ||
        s.type === "secondary-ops"
      ),
      quality: allSuggestions.filter(s => 
        s.category === "quality-improvement" ||
        (!["dfm", "tolerance", "secondary-ops", "volume-discount", "premium-upgrade", "bundle", "express-shipping"].includes(s.type) &&
         !["volume-discount", "premium-service", "performance-upgrade"].includes(s.category || ""))
      ),
    };
  }, [allSuggestions]);

  // Get unique parts
  const uniqueParts = useMemo(() => {
    const partMap = new Map();
    parts.forEach(part => {
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
      filtered = filtered.filter(s => s.partId === selectedPart);
    }
    
    // Filter by category
    if (selectedCategory !== "all") {
      filtered = categorizedSuggestions[selectedCategory] || [];
      if (selectedPart !== "all") {
        filtered = filtered.filter(s => s.partId === selectedPart);
      }
    }
    
    // Sort: Cost Optimization first, then DFM Suggestions, then Quality Optimization
    return filtered.sort((a, b) => {
      const getOrder = (suggestion: any) => {
        if (categorizedSuggestions["cost-optimization"].includes(suggestion)) return 1;
        if (categorizedSuggestions.dfm.includes(suggestion)) return 2;
        if (categorizedSuggestions["quality-optimization"].includes(suggestion)) return 3;
        return 4;
      };
      return getOrder(a) - getOrder(b);
    });
  }, [allSuggestions, selectedPart, selectedCategory, categorizedSuggestions]);

  // Check if suggestion should show apply button (not DFM or quality optimization)
  const shouldShowApplyButton = (suggestion: any) => {
    return !categorizedSuggestions.dfm.includes(suggestion) && 
           !categorizedSuggestions["quality-optimization"].includes(suggestion);
  };

  return (
    <>
      {/* Fixed Button at Bottom */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
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
              {allSuggestions.length > 0 && (
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
              {filteredSuggestions.length > 0 ? "Smart Optimization" : "Analyze Quote"}
            </span>
          </div>
        </Button>
      </div>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white text-zinc-950 border-l border-zinc-200 shadow-2xl z-50 transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col sidebar-open overflow-hidden",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="ai-scan-overlay bg-gradient-to-b from-transparent via-blue-500/10 to-transparent" />

        {/* Scanning Beam Effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <motion.div
            animate={{ top: ["-100%", "100%"] }}
            transition={{
              duration: 4,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            className="absolute left-0 w-full h-1/2 bg-gradient-to-b from-transparent via-blue-500/30 to-transparent"
          />
        </div>

        {/* Header */}
        <div className="p-8 border-b border-zinc-100 bg-zinc-50/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Cpu className="w-24 h-24" />
          </div>

          <div className="flex items-center justify-between mb-4 relative">
            <div className="flex items-center gap-4">
              <div className="aspect-square bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100">
                <img
                  src="/icons/ai-suggestion.png"
                  alt="Logo"
                  className="w-12 object-contain"
                />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight flex items-center gap-2 text-zinc-900">
                  AI ENGINE{" "}
                  <span className="text-[10px] bg-blue-600 px-1.5 py-0.5 rounded text-white font-bold">
                    BETA
                  </span>
                </h2>
                <p className="text-sm text-zinc-500 font-medium">
                  {isAnalyzing
                    ? "Scanning part geometry..."
                    : "Optimization insights ready"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="rounded-xl h-10 w-10 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        {!isAnalyzing && (
          <div className="px-8 py-4 border-b border-zinc-100 space-y-3 bg-white">
            {/* Part Selector Dropdown */}
            <div className="relative">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5 block">
                Select Part
              </label>
              <button
                onClick={() => setIsPartDropdownOpen(!isPartDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-900 transition-colors"
              >
                <span className="truncate">
                  {selectedPart === "all" 
                    ? `All Parts (${uniqueParts.length})` 
                    : uniqueParts.find(p => p.id === selectedPart)?.fileName || "Select Part"}
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 text-zinc-400 transition-transform",
                  isPartDropdownOpen && "rotate-180"
                )} />
              </button>
              
              <AnimatePresence>
                {isPartDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                  >
                    <button
                      onClick={() => {
                        setSelectedPart("all");
                        setIsPartDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 transition-colors",
                        selectedPart === "all" && "bg-blue-50 text-blue-600 font-semibold"
                      )}
                    >
                      All Parts ({uniqueParts.length})
                    </button>
                    {uniqueParts.map(part => (
                      <button
                        key={part.id}
                        onClick={() => {
                          setSelectedPart(part.id);
                          setIsPartDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 transition-colors truncate",
                          selectedPart === part.id && "bg-blue-50 text-blue-600 font-semibold"
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
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5 block">
                Category
              </label>
              <button
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-900 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {selectedCategory === "all" && "All Categories"}
                  {selectedCategory === "cost-optimization" && (
                    <>
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      Cost Optimization
                    </>
                  )}
                  {selectedCategory === "dfm" && (
                    <>
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      DFM Suggestions
                    </>
                  )}
                  {selectedCategory === "quality-optimization" && (
                    <>
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Quality Optimization
                    </>
                  )}
                  <span className="text-xs text-zinc-400">
                    ({selectedCategory === "all" 
                      ? filteredSuggestions.length 
                      : categorizedSuggestions[selectedCategory]?.length || 0})
                  </span>
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 text-zinc-400 transition-transform",
                  isCategoryDropdownOpen && "rotate-180"
                )} />
              </button>
              
              <AnimatePresence>
                {isCategoryDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setSelectedCategory("all");
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 transition-colors",
                        selectedCategory === "all" && "bg-blue-50 text-blue-600 font-semibold"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>All Categories</span>
                        <span className="text-xs text-zinc-400">({allSuggestions.length})</span>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCategory("cost-optimization");
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 transition-colors",
                        selectedCategory === "cost-optimization" && "bg-purple-50 text-purple-600 font-semibold"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                          Cost Optimization
                        </span>
                        <span className="text-xs text-zinc-400">({categorizedSuggestions["cost-optimization"].length})</span>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCategory("dfm");
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 transition-colors",
                        selectedCategory === "dfm" && "bg-amber-50 text-amber-600 font-semibold"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                          DFM Suggestions
                        </span>
                        <span className="text-xs text-zinc-400">({categorizedSuggestions.dfm.length})</span>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCategory("quality-optimization");
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 transition-colors",
                        selectedCategory === "quality-optimization" && "bg-blue-50 text-blue-600 font-semibold"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          Quality Optimization
                        </span>
                        <span className="text-xs text-zinc-400">({categorizedSuggestions["quality-optimization"].length})</span>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto invisible-scrollbar p-8 space-y-6">
          {isAnalyzing ? (
            <div className="w-full h-full flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full"
                  />
                  <img
                    src="/animated/ai.gif"
                    className="w-16 h-16 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  />
                </div>
                <p className="text-gray-900 font-bold text-lg">
                  AI Engine is analyzing...
                </p>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                      className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-zinc-400 font-medium">
                No suggestions available for selected filters
              </p>
            </div>
          ) : (
            filteredSuggestions.map((suggestion, index) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={suggestion.id}
                className="bg-white rounded-lg border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all duration-200"
              >
                <div className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        suggestion.color === "blue" &&
                          "bg-blue-50 text-blue-600",
                        suggestion.color === "purple" &&
                          "bg-purple-50 text-purple-600",
                        suggestion.color === "green" &&
                          "bg-green-50 text-green-600",
                        suggestion.color === "amber" &&
                          "bg-amber-50 text-amber-600",
                        suggestion.color === "red" &&
                          "bg-red-50 text-red-600",
                        suggestion.color === "orange" &&
                          "bg-orange-50 text-orange-600",
                        suggestion.color === "indigo" &&
                          "bg-indigo-50 text-indigo-600",
                        suggestion.color === "teal" &&
                          "bg-teal-50 text-teal-600",
                      )}
                    >
                      {suggestion.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-medium text-zinc-500 uppercase">
                          {suggestion.type}
                        </span>
                        {suggestion.category && (
                          <span className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-full",
                            suggestion.category === "cost-saving" && "bg-green-100 text-green-700",
                            suggestion.category === "performance-upgrade" && "bg-indigo-100 text-indigo-700",
                            suggestion.category === "volume-discount" && "bg-teal-100 text-teal-700",
                            suggestion.category === "premium-service" && "bg-purple-100 text-purple-700",
                            suggestion.category === "quality-improvement" && "bg-blue-100 text-blue-700",
                          )}>
                            {suggestion.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        )}
                        {suggestion.priority === "critical" && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">
                            CRITICAL
                          </span>
                        )}
                        {suggestion.impact.savingsPercentage && suggestion.impact.savingsPercentage > 0 && (
                          <span className="text-xs font-semibold text-green-600">
                            {suggestion.impact.savingsPercentage}% savings
                          </span>
                        )}
                        {suggestion.impact.revenueIncrease && suggestion.impact.revenueIncrease > 0 && (
                          <span className="text-xs font-semibold text-indigo-600">
                            +${suggestion.impact.revenueIncrease.toFixed(0)} revenue
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-900 leading-tight">
                        {suggestion.title}
                      </h3>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {suggestion.description}
                  </p>

                  {/* Part Name */}
                  <div className="pt-3 border-t border-zinc-100">
                    <p className="text-xs text-zinc-500 mb-1">Part</p>
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {suggestion.partName}
                    </p>
                  </div>

                  {/* Current vs Suggested */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Current</p>
                      <p className="text-sm font-medium text-zinc-400 line-through">
                        {suggestion.currentValue}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Suggested</p>
                      <p className="text-sm font-semibold text-zinc-900">
                        {suggestion.suggestedValue}
                      </p>
                    </div>
                  </div>

                  {/* Savings / Impact */}
                  {(suggestion.impact.savings !== undefined || suggestion.impact.lifetimeSavings || suggestion.impact.revenueIncrease) && (
                    <div className="space-y-2">
                      {suggestion.impact.savings !== undefined && suggestion.impact.savings !== 0 && (
                        <div className={cn(
                          "border rounded-lg px-3 py-2",
                          suggestion.impact.savings > 0 
                            ? "bg-green-50 border-green-100"
                            : "bg-indigo-50 border-indigo-100"
                        )}>
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-xs font-medium",
                              suggestion.impact.savings > 0 ? "text-green-700" : "text-indigo-700"
                            )}>
                              {suggestion.impact.savings > 0 ? "Potential Savings" : "Investment"}
                            </span>
                            <span className={cn(
                              "text-sm font-semibold",
                              suggestion.impact.savings > 0 ? "text-green-700" : "text-indigo-700"
                            )}>
                              ${Math.abs(suggestion.impact.savings).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                      {suggestion.impact.lifetimeSavings && suggestion.impact.lifetimeSavings > 0 && (
                        <div className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-teal-700">
                              Lifetime Value (3 years)
                            </span>
                            <span className="text-sm font-semibold text-teal-700">
                              ${Math.abs(suggestion.impact.lifetimeSavings).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                      {suggestion.impact.revenueIncrease && suggestion.impact.revenueIncrease > 0 && (
                        <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-purple-700">
                              Revenue Opportunity
                            </span>
                            <span className="text-sm font-semibold text-purple-700">
                              +${suggestion.impact.revenueIncrease.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Button - Only show for non-DFM/quality suggestions */}
                  {shouldShowApplyButton(suggestion) && (
                    <Button
                      onClick={() => {
                        onApplySuggestion(suggestion);
                        setIsOpen(false);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Apply Suggestion
                    </Button>
                  )}
                  
                  {/* Info message for DFM/Quality suggestions */}
                  {!shouldShowApplyButton(suggestion) && (
                    <div className="pt-3 border-t border-zinc-100">
                      <p className="text-xs text-zinc-500 italic text-center">
                        {categorizedSuggestions.dfm.includes(suggestion) 
                          ? "Design recommendation - requires CAD file modification"
                          : "Quality improvement suggestion for consideration"}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
