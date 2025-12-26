"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Lightbulb,
  X,
  TrendingUp,
  Package,
  DollarSign,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { PartConfig } from "@/types/part-config";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  type: "quantity" | "material" | "finish" | "leadtime";
  title: string;
  description: string;
  partId: string;
  partName: string;
  currentValue: string | number;
  suggestedValue: string | number;
  impact: {
    savings?: number;
    savingsPercentage?: number;
    leadTimeReduction?: number;
  };
  icon: React.ReactNode;
  color: string;
}

interface SuggestionSidebarProps {
  parts: PartConfig[];
  onApplySuggestion: (suggestion: Suggestion) => void;
}

export function SuggestionSidebar({
  parts,
  onApplySuggestion,
}: SuggestionSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Generate suggestions based on parts
  const generateSuggestions = (): Suggestion[] => {
    const suggestions: Suggestion[] = [];

    parts.forEach((part) => {
      // Quantity optimization suggestion
      if (part.quantity === 10) {
        suggestions.push({
          id: `qty-${part.id}`,
          type: "quantity",
          title: "Optimize Quantity for Better Pricing",
          description: `Increasing quantity from ${part.quantity} to 15 units can reduce unit cost by 12%`,
          partId: part.id,
          partName: part.fileName,
          currentValue: part.quantity,
          suggestedValue: 15,
          impact: {
            savings: 45.5,
            savingsPercentage: 12,
          },
          icon: <Package className="w-4 h-4" />,
          color: "blue",
        });
      }

      // Material suggestion
      if (part.material === "Aluminum 6061") {
        suggestions.push({
          id: `mat-${part.id}`,
          type: "material",
          title: "Alternative Material Available",
          description: `Aluminum 7075 offers better strength with only 8% cost increase`,
          partId: part.id,
          partName: part.fileName,
          currentValue: part.material || "Not specified",
          suggestedValue: "Aluminum 7075",
          impact: {
            savings: -25.0,
            savingsPercentage: 8,
          },
          icon: <TrendingUp className="w-4 h-4" />,
          color: "purple",
        });
      }

      // Lead time optimization
      if (part.leadTimeType === "expedited") {
        suggestions.push({
          id: `lead-${part.id}`,
          type: "leadtime",
          title: "Consider Standard Lead Time",
          description: `Switching to standard lead time can save 35% on this part`,
          partId: part.id,
          partName: part.fileName,
          currentValue: "Expedited",
          suggestedValue: "Standard",
          impact: {
            savings: 120.0,
            savingsPercentage: 35,
            leadTimeReduction: -5,
          },
          icon: <Clock className="w-4 h-4" />,
          color: "green",
        });
      }

      // Finish optimization
      if (part.finish === "Anodizing") {
        suggestions.push({
          id: `finish-${part.id}`,
          type: "finish",
          title: "Cost-Effective Finish Option",
          description: `Powder coating provides similar protection at 20% lower cost`,
          partId: part.id,
          partName: part.fileName,
          currentValue: part.finish || "As Machined",
          suggestedValue: "Powder Coating",
          impact: {
            savings: 35.0,
            savingsPercentage: 20,
          },
          icon: <Sparkles className="w-4 h-4" />,
          color: "amber",
        });
      }
    });

    return suggestions;
  };

  const suggestions = generateSuggestions();

  return (
    <>
      {/* Fixed Button at Bottom */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setIsOpen(true)}
          className="animated-gradient-btn h-12 px-5 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 text-white font-medium gap-2 transition-all duration-200"
        >
          <div className="relative">
            <Lightbulb className="w-5 h-5" />
            {suggestions.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-primary">
                {suggestions.length}
              </span>
            )}
          </div>
          <span className="text-sm font-semibold">
            {suggestions.length > 0
              ? `${suggestions.length} Suggestion${suggestions.length > 1 ? "s" : ""}`
              : "Suggestions"}
          </span>
        </Button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[440px] bg-background border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold tracking-tight">
                Smart Suggestions
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="rounded-full h-8 w-8"
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Optimize your quote with technical recommendations
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                <Lightbulb className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold mb-1">
                No Suggestions Available
              </h3>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                Your quote is already optimized according to our standard best
                practices.
              </p>
            </div>
          ) : (
            suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="group border border-border rounded-xl p-5 bg-card hover:bg-accent/50 transition-colors"
              >
                {/* Type & Icon */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {suggestion.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {suggestion.type}
                  </span>
                </div>

                <h3 className="text-sm font-bold leading-tight mb-2">
                  {suggestion.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  {suggestion.description}
                </p>

                {/* Part & Changes Grid */}
                <div className="grid grid-cols-1 gap-4 bg-muted/30 rounded-lg p-3 border border-border/50">
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase block mb-1">
                      Part
                    </span>
                    <span className="text-xs font-semibold block truncate">
                      {suggestion.partName}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase block mb-1">
                        Current
                      </span>
                      <span className="text-xs font-medium text-muted-foreground line-through decoration-muted-foreground/50">
                        {suggestion.currentValue}
                      </span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <div className="flex-1 text-right sm:text-left">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase block mb-1">
                        Suggested
                      </span>
                      <span className="text-xs font-bold text-primary">
                        {suggestion.suggestedValue}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Impact Info */}
                {suggestion.impact.savings !== undefined && (
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">
                        Potential Savings
                      </span>
                      <span className="text-sm font-bold text-green-600">
                        {suggestion.impact.savings > 0 ? "+" : ""}$
                        {Math.abs(suggestion.impact.savings).toFixed(2)}
                      </span>
                    </div>
                    {suggestion.impact.savingsPercentage && (
                      <div className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold">
                        {suggestion.impact.savingsPercentage}% OFF
                      </div>
                    )}
                  </div>
                )}

                {/* Action */}
                <Button
                  onClick={() => {
                    onApplySuggestion(suggestion);
                    setIsOpen(false);
                  }}
                  variant="outline"
                  className="w-full mt-4 h-9 text-xs font-bold hover:bg-primary hover:text-primary-foreground border-primary/20 hover:border-primary transition-all"
                >
                  Apply Changes
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card">
          <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest font-medium">
            AI-Driven Quote Optimization
          </p>
        </div>
      </div>
    </>
  );
}
