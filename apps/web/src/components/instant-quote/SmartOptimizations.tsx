import React, { useState, useEffect } from "react";
import {
  Lightbulb,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Sparkles,
  DollarSign,
  Target,
} from "lucide-react";

interface Optimization {
  type: "cost" | "quality" | "leadtime" | "material" | "design";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  impact: {
    cost?: number;
    time?: number;
    quality?: number;
  };
  action: string;
}

interface SmartOptimizationsProps {
  partData: {
    name: string;
    material: string;
    dimensions: { x: number; y: number; z: number };
    volume: number;
    surfaceArea: number;
    features: {
      holes: number;
      pockets: number;
      threads: number;
      complexity: number;
      thinWalls?: { thickness: number; locations: number };
      deepPockets?: { depth: number; width: number; count: number };
      tightTolerances?: { tolerance: string; count: number };
    };
    tolerance: string;
    finish: string;
    quantity: number;
    process: string;
  };
  onOptimizationApply?: (optimization: Optimization) => void;
}

export const SmartOptimizations: React.FC<SmartOptimizationsProps> = ({
  partData,
  onOptimizationApply,
}) => {
  const [optimizations, setOptimizations] = useState<Optimization[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedOptimizations, setSelectedOptimizations] = useState<
    Set<string>
  >(new Set());
  const [totalSavings, setTotalSavings] = useState({
    cost: 0,
    time: 0,
    quality: 0,
  });

  useEffect(() => {
    analyzeOptimizations();
  }, [partData]);

  const analyzeOptimizations = async () => {
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/ai/analyze-part", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part: partData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setOptimizations(data.data.recommendations || []);
      }
    } catch (error) {
      console.error("Optimization analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleOptimization = (title: string) => {
    const newSelected = new Set(selectedOptimizations);

    if (newSelected.has(title)) {
      newSelected.delete(title);
    } else {
      newSelected.add(title);
    }

    setSelectedOptimizations(newSelected);
    calculateTotalSavings(Array.from(newSelected), optimizations);
  };

  const calculateTotalSavings = (
    selected: string[],
    allOptimizations: Optimization[],
  ) => {
    const savings = { cost: 0, time: 0, quality: 0 };

    selected.forEach((title) => {
      const opt = allOptimizations.find((o) => o.title === title);
      if (opt?.impact) {
        if (opt.impact.cost) savings.cost += opt.impact.cost;
        if (opt.impact.time) savings.time += opt.impact.time;
        if (opt.impact.quality) savings.quality += opt.impact.quality;
      }
    });

    setTotalSavings(savings);
  };

  const applySelectedOptimizations = () => {
    optimizations
      .filter((opt) => selectedOptimizations.has(opt.title))
      .forEach((opt) => {
        onOptimizationApply?.(opt);
      });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "cost":
        return <DollarSign className="w-5 h-5" />;
      case "quality":
        return <CheckCircle className="w-5 h-5" />;
      case "leadtime":
        return <Clock className="w-5 h-5" />;
      case "material":
        return <Target className="w-5 h-5" />;
      case "design":
        return <Lightbulb className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "cost":
        return "bg-green-100 text-green-700";
      case "quality":
        return "bg-blue-100 text-blue-700";
      case "leadtime":
        return "bg-yellow-100 text-yellow-700";
      case "material":
        return "bg-purple-100 text-purple-700";
      case "design":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return (
          <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded font-medium">
            High Priority
          </span>
        );
      case "medium":
        return (
          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded font-medium">
            Medium
          </span>
        );
      case "low":
        return (
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded font-medium">
            Low
          </span>
        );
      default:
        return null;
    }
  };

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-lg font-semibold text-gray-900">
          Analyzing Your Part...
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Finding the best optimization opportunities
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <Sparkles className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              AI-Powered Optimizations
            </h3>
            <p className="text-sm text-gray-600">
              Select recommendations to reduce cost, improve quality, or speed
              up delivery
            </p>
          </div>
          <button
            onClick={analyzeOptimizations}
            className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 
                     transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Re-analyze
          </button>
        </div>

        {/* Summary Stats */}
        {selectedOptimizations.size > 0 && (
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <p className="text-sm text-gray-600 mb-3">
              {selectedOptimizations.size} optimization
              {selectedOptimizations.size !== 1 ? "s" : ""} selected
            </p>
            <div className="grid grid-cols-3 gap-4">
              {totalSavings.cost !== 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {totalSavings.cost > 0 ? "+" : ""}
                    {totalSavings.cost}%
                  </p>
                  <p className="text-xs text-gray-600">Cost Savings</p>
                </div>
              )}
              {totalSavings.time !== 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {totalSavings.time > 0 ? "+" : ""}
                    {totalSavings.time} days
                  </p>
                  <p className="text-xs text-gray-600">Time Saved</p>
                </div>
              )}
              {totalSavings.quality !== 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    +{totalSavings.quality}
                  </p>
                  <p className="text-xs text-gray-600">Quality Score</p>
                </div>
              )}
            </div>
            <button
              onClick={applySelectedOptimizations}
              className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                       transition-colors font-medium"
            >
              Apply {selectedOptimizations.size} Optimization
              {selectedOptimizations.size !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>

      {/* Optimizations List */}
      {optimizations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-lg font-semibold text-gray-900">Great Design!</p>
          <p className="text-sm text-gray-600 mt-1">
            No major optimization opportunities found
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {optimizations.map((opt, idx) => (
            <div
              key={idx}
              className={`bg-white rounded-lg border-2 transition-all cursor-pointer ${
                selectedOptimizations.has(opt.title)
                  ? "border-green-500 shadow-md"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => toggleOptimization(opt.title)}
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${getTypeColor(opt.type)}`}>
                    {getTypeIcon(opt.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">
                        {opt.title}
                      </h4>
                      {getPriorityBadge(opt.priority)}
                    </div>
                    <p className="text-sm text-gray-600">{opt.description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedOptimizations.has(opt.title)}
                    onChange={() => toggleOptimization(opt.title)}
                    className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Impact */}
                {Object.keys(opt.impact).length > 0 && (
                  <div className="flex items-center gap-4 mb-3 pl-11">
                    {opt.impact.cost && (
                      <div className="flex items-center gap-1 text-sm">
                        <TrendingDown className="w-4 h-4 text-green-600" />
                        <span className="text-green-600 font-semibold">
                          {opt.impact.cost > 0 ? "+" : ""}
                          {opt.impact.cost}%
                        </span>
                        <span className="text-gray-500">cost</span>
                      </div>
                    )}
                    {opt.impact.time && (
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-600 font-semibold">
                          {opt.impact.time > 0 ? "+" : ""}
                          {opt.impact.time} days
                        </span>
                      </div>
                    )}
                    {opt.impact.quality && (
                      <div className="flex items-center gap-1 text-sm">
                        <CheckCircle className="w-4 h-4 text-purple-600" />
                        <span className="text-purple-600 font-semibold">
                          +{opt.impact.quality}
                        </span>
                        <span className="text-gray-500">quality</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action */}
                <div className="pl-11">
                  <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded p-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    <span className="font-medium">Action:</span>
                    <span>{opt.action}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warning for high priority items */}
      {optimizations.some((opt) => opt.priority === "high") && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="font-semibold text-red-900">
              High Priority Recommendations
            </p>
          </div>
          <p className="text-sm text-red-700">
            Your design has{" "}
            {optimizations.filter((o) => o.priority === "high").length}{" "}
            high-priority issue
            {optimizations.filter((o) => o.priority === "high").length !== 1
              ? "s"
              : ""}{" "}
            that could significantly impact cost, quality, or lead time.
            Consider addressing these first.
          </p>
        </div>
      )}
    </div>
  );
};

export default SmartOptimizations;
