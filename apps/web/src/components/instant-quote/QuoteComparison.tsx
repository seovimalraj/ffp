"use client";

import React, { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Zap,
  ArrowRight,
} from "lucide-react";

interface QuoteOption {
  id: string;
  name: string;
  material: string;
  process: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  leadTimeDays: number;
  manufacturabilityScore: number;
  features: {
    holes: number;
    pockets: number;
    threads: number;
  };
  pros: string[];
  cons: string[];
  recommended?: boolean;
}

interface QuoteComparisonProps {
  options: QuoteOption[];
  onSelectOption?: (optionId: string) => void;
  baselineId?: string;
}

export function QuoteComparison({
  options,
  onSelectOption,
  baselineId,
}: Readonly<QuoteComparisonProps>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Find baseline for comparison (either specified or cheapest)
  const baseline = useMemo(() => {
    if (baselineId) {
      return options.find((o) => o.id === baselineId);
    }
    return options.reduce(
      (min, opt) => (opt.totalPrice < min.totalPrice ? opt : min),
      options[0],
    );
  }, [options, baselineId]);

  const getPriceDiff = (option: QuoteOption) => {
    if (!baseline || option.id === baseline.id) return 0;
    return (
      ((option.totalPrice - baseline.totalPrice) / baseline.totalPrice) * 100
    );
  };

  const getLeadTimeDiff = (option: QuoteOption) => {
    if (!baseline || option.id === baseline.id) return 0;
    return option.leadTimeDays - baseline.leadTimeDays;
  };

  const handleSelect = (optionId: string) => {
    setSelectedId(optionId);
    onSelectOption?.(optionId);
  };

  const ComparisonIcon = ({ value }: { value: number }) => {
    if (value > 5) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (value < -5) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white">
        <div>
          <h3 className="text-sm font-bold mb-1">Quote Comparison</h3>
          <p className="text-xs opacity-90">
            Compare {options.length} options side-by-side
          </p>
        </div>
        {baseline && (
          <div className="text-right">
            <div className="text-xs opacity-80">Baseline:</div>
            <div className="text-sm font-semibold">{baseline.name}</div>
          </div>
        )}
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {options.map((option) => {
          const priceDiff = getPriceDiff(option);
          const leadTimeDiff = getLeadTimeDiff(option);
          const isBaseline = baseline?.id === option.id;
          const isSelected = selectedId === option.id;
          const isRecommended = option.recommended;

          return (
            <div
              key={option.id}
              className={`relative rounded-lg border-2 transition-all ${
                isSelected
                  ? "border-blue-500 shadow-lg scale-[1.02]"
                  : isRecommended
                    ? "border-green-400 shadow-md"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              } bg-white dark:bg-gray-800 overflow-hidden`}
            >
              {/* Badges */}
              <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                {isRecommended && (
                  <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-md">
                    <Zap className="w-3 h-3" />
                    Best Value
                  </span>
                )}
                {isBaseline && (
                  <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-full shadow-md">
                    Baseline
                  </span>
                )}
              </div>

              <div className="p-5">
                {/* Header */}
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {option.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span>{option.material}</span>
                    <span>•</span>
                    <span>{option.process}</span>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      ${option.totalPrice.toLocaleString()}
                    </div>
                    {!isBaseline && (
                      <div
                        className={`flex items-center gap-1 text-sm font-semibold ${
                          priceDiff > 0
                            ? "text-red-600 dark:text-red-400"
                            : priceDiff < 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        <ComparisonIcon value={priceDiff} />
                        {priceDiff > 0 ? "+" : ""}
                        {priceDiff.toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      ${option.unitPrice.toFixed(2)}/unit
                    </span>
                    <span className="text-gray-500 dark:text-gray-500 flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {option.quantity} units
                    </span>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <Clock className="w-3 h-3" />
                      Lead Time
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {option.leadTimeDays} days
                      </span>
                      {!isBaseline && leadTimeDiff !== 0 && (
                        <span
                          className={`text-xs font-semibold ${
                            leadTimeDiff > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {leadTimeDiff > 0 ? "+" : ""}
                          {leadTimeDiff}d
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <Zap className="w-3 h-3" />
                      Mfg Score
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {option.manufacturabilityScore}/10
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Detected Features
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {option.features.holes}
                      </div>
                      <div className="text-gray-500 dark:text-gray-500">
                        Holes
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {option.features.pockets}
                      </div>
                      <div className="text-gray-500 dark:text-gray-500">
                        Pockets
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {option.features.threads}
                      </div>
                      <div className="text-gray-500 dark:text-gray-500">
                        Threads
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pros/Cons */}
                <div className="space-y-2 mb-4">
                  {option.pros.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Advantages
                      </div>
                      <ul className="space-y-1">
                        {option.pros.map((pro, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1"
                          >
                            <span className="text-green-500 mt-0.5">•</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {option.cons.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Considerations
                      </div>
                      <ul className="space-y-1">
                        {option.cons.map((con, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1"
                          >
                            <span className="text-red-500 mt-0.5">•</span>
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Select Button */}
                <button
                  onClick={() => handleSelect(option.id)}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md"
                      : isRecommended
                        ? "bg-green-500 text-white hover:bg-green-600 shadow-md"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {isSelected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Selected
                    </>
                  ) : (
                    <>
                      Select This Option
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {selectedId && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-blue-900 dark:text-blue-100">
              Option selected:
            </span>
            <span className="text-blue-700 dark:text-blue-300">
              {options.find((o) => o.id === selectedId)?.name}
            </span>
            <button
              onClick={() => console.log("Proceed with", selectedId)}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
