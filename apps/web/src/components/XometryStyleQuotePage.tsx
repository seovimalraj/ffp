"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CubeIcon,
  DocumentIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CogIcon,
  ShoppingCartIcon,
  TruckIcon,
  CalendarIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { FeatureAnalysisPanel } from "./FeatureAnalysisPanel";
import { ProcessRecommendationPanel } from "./ProcessRecommendationPanel";
import { BOMPanel } from "./BOMPanel";
import { RevisionHistoryPanel } from "./RevisionHistoryPanel";

interface Quote {
  id: string;
  status:
    | "Draft"
    | "Analyzing"
    | "Priced"
    | "Needs_Review"
    | "Reviewed"
    | "Sent"
    | "Accepted"
    | "Expired"
    | "Abandoned";
  subtotal: number;
  currency: string;
  lines: QuoteLine[];
  selectedLeadOptionId?: string;
  createdAt: string;
  updatedAt?: string;
}

interface QuoteLine {
  id: string;
  fileId: string;
  fileName: string;
  process: "CNC" | "SheetMetal" | "InjectionMolding";
  material: string;
  finish?: string;
  qty: number;
  status: "Analyzing" | "Priced" | "Needs_Review" | "Error";
  pricingBreakdown?: PricingBreakdown;
  leadTimeOptions?: LeadOption[];
  thumbnail?: string;
  features?: {
    detected_features: Array<{
      type: string;
      dimensions?: Record<string, number>;
      machining_difficulty: number;
      dff_issues?: string[];
    }>;
    summary: {
      total_features: number;
      complexity_score: number;
      dff_violations: string[];
    };
  };
  process_recommendation?: {
    recommended_process: {
      code: string;
      name: string;
      confidence: number;
      reasoning: string[];
      limitations: string[];
    };
    alternatives: Array<{
      code: string;
      name: string;
      confidence: number;
    }>;
    analysis: {
      primary_driver: string;
      cost_impact: string;
      lead_time_impact: string;
      quality_notes: string[];
    };
  };
  bom?: {
    items: Array<{
      id: string;
      category: string;
      name: string;
      description: string;
      quantity: number;
      unit_cost: number;
      total_cost: number;
      supplier?: string;
      lead_time_days?: number;
    }>;
    summary: {
      total_items: number;
      total_cost: number;
      categories: Record<string, { count: number; cost: number }>;
      critical_path_lead_time: number;
    };
  };
}

interface PricingBreakdown {
  setup_time_min: number;
  cycle_time_min: number;
  machine_rate_per_hr: number;
  material_buy_cost: number;
  material_waste_factor: number;
  tooling_wear_cost: number;
  finish_cost: number;
  inspection_cost: number;
  risk_adder: number;
  overhead: number;
  margin: number;
  unit_price: number;
}

interface LeadOption {
  id: string;
  region: "USA" | "International";
  speed: "Economy" | "Standard" | "Expedite";
  business_days: number;
  unit_price: number;
  msrp: number;
  savings_text: string;
}

const STATUS_COLORS = {
  Draft: "bg-gray-100 text-gray-800",
  Analyzing: "bg-blue-100 text-blue-800",
  Priced: "bg-green-100 text-green-800",
  Needs_Review: "bg-yellow-100 text-yellow-800",
  Reviewed: "bg-purple-100 text-purple-800",
  Sent: "bg-indigo-100 text-indigo-800",
  Accepted: "bg-emerald-100 text-emerald-800",
  Expired: "bg-red-100 text-red-800",
  Abandoned: "bg-gray-100 text-gray-600",
};

const LEAD_TIME_COLORS = {
  Economy: "text-green-600 bg-green-50 border-green-200",
  Standard: "text-blue-600 bg-blue-50 border-blue-200",
  Expedite: "text-orange-600 bg-orange-50 border-orange-200",
};

export default function XometryStyleQuotePage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [selectedLeadOptions, setSelectedLeadOptions] = useState<{
    [lineId: string]: string;
  }>({});
  const [showPricingDetails, setShowPricingDetails] = useState<{
    [lineId: string]: boolean;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  const fetchQuote = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/quotes/${quoteId}`);

      if (!response.ok) {
        throw new Error("Quote not found");
      }

      const quoteData = await response.json();
      setQuote(quoteData);

      // Initialize default lead time selections (economy for all)
      const defaultSelections: { [lineId: string]: string } = {};
      quoteData.lines.forEach((line: QuoteLine) => {
        const economyOption = line.leadTimeOptions?.find(
          (option) => option.speed === "Economy",
        );
        if (economyOption) {
          defaultSelections[line.id] = economyOption.id;
        }
      });
      setSelectedLeadOptions(defaultSelections);
    } catch (err) {
      console.error("Failed to fetch quote:", err);
      setError("Failed to load quote. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeadTimeChange = (lineId: string, leadOptionId: string) => {
    setSelectedLeadOptions((prev) => ({
      ...prev,
      [lineId]: leadOptionId,
    }));
  };

  const togglePricingDetails = (lineId: string) => {
    setShowPricingDetails((prev) => ({
      ...prev,
      [lineId]: !prev[lineId],
    }));
  };

  const calculateTotalPrice = () => {
    if (!quote) return 0;

    return quote.lines.reduce((total, line) => {
      const selectedOption = selectedLeadOptions[line.id];
      const leadOption = line.leadTimeOptions?.find(
        (option) => option.id === selectedOption,
      );
      const unitPrice =
        leadOption?.unit_price || line.pricingBreakdown?.unit_price || 0;
      return total + unitPrice * line.qty;
    }, 0);
  };

  const calculateTotalLeadTime = () => {
    if (!quote) return 0;

    const leadTimes = quote.lines.map((line) => {
      const selectedOption = selectedLeadOptions[line.id];
      const leadOption = line.leadTimeOptions?.find(
        (option) => option.id === selectedOption,
      );
      return leadOption?.business_days || 0;
    });

    return Math.max(...leadTimes);
  };

  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    try {
      // TODO: Implement cart functionality
      console.log("Adding to cart:", { quoteId, selectedLeadOptions });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Navigate to checkout or show success message
      router.push(`/portal/checkout/${quoteId}`);
    } catch (error) {
      console.error("Failed to add to cart:", error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-96 bg-gray-200 rounded-lg"></div>
                <div className="h-64 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="space-y-6">
                <div className="h-80 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="text-center py-12">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Quote Not Found
              </h3>
              <p className="text-gray-600 mb-6">
                {error || "The requested quote could not be found."}
              </p>
              <Button onClick={() => router.push("/portal/dashboard")}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalPrice = calculateTotalPrice();
  const totalLeadTime = calculateTotalLeadTime();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Quote {quote.id}
                </h1>
                <div className="flex items-center space-x-3 mt-1">
                  <Badge className={STATUS_COLORS[quote.status]}>
                    {quote.status}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Created {new Date(quote.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm">
                <DocumentIcon className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm">
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Refresh Quote
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Parts and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Parts List */}
            {quote.lines.map((line, index) => (
              <Card key={line.id} className="overflow-hidden">
                <CardHeader className="bg-gray-50 border-b border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <CubeIcon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold">
                          Part {index + 1}: {line.fileName}
                        </CardTitle>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span>
                            {line.process} • {line.material}
                          </span>
                          {line.finish && <span>• {line.finish}</span>}
                          <span>• Qty: {line.qty}</span>
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={
                        STATUS_COLORS[
                          line.status as keyof typeof STATUS_COLORS
                        ] || "bg-gray-100 text-gray-800"
                      }
                    >
                      {line.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  {/* Lead Time Options */}
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <TruckIcon className="w-4 h-4 mr-2" />
                      Choose Delivery Speed
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {line.leadTimeOptions?.map((option) => (
                        <div
                          key={option.id}
                          className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                            selectedLeadOptions[line.id] === option.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() =>
                            handleLeadTimeChange(line.id, option.id)
                          }
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div
                              className={`px-2 py-1 rounded text-xs font-medium border ${
                                LEAD_TIME_COLORS[option.speed]
                              }`}
                            >
                              {option.speed}
                            </div>
                            {selectedLeadOptions[line.id] === option.id && (
                              <CheckCircleIcon className="w-5 h-5 text-blue-500" />
                            )}
                          </div>
                          <div className="text-sm">
                            <div className="font-semibold text-gray-900">
                              {option.business_days} business days
                            </div>
                            <div className="text-lg font-bold text-gray-900 mt-1">
                              ${option.unit_price.toFixed(2)} each
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {option.savings_text}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  {line.pricingBreakdown && (
                    <div className="border-t border-gray-200 pt-4">
                      <button
                        onClick={() => togglePricingDetails(line.id)}
                        className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                      >
                        <InformationCircleIcon className="w-4 h-4 mr-1" />
                        Pricing Breakdown
                        {showPricingDetails[line.id] ? (
                          <ChevronDownIcon className="w-4 h-4 ml-1" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4 ml-1" />
                        )}
                      </button>

                      {showPricingDetails[line.id] && (
                        <div className="mt-3 bg-gray-50 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Setup Time:</span>
                              <span>
                                {line.pricingBreakdown.setup_time_min} min
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Cycle Time:</span>
                              <span>
                                {line.pricingBreakdown.cycle_time_min} min
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                Machine Rate:
                              </span>
                              <span>
                                ${line.pricingBreakdown.machine_rate_per_hr}/hr
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                Material Cost:
                              </span>
                              <span>
                                $
                                {line.pricingBreakdown.material_buy_cost.toFixed(
                                  2,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                Tooling Wear:
                              </span>
                              <span>
                                $
                                {line.pricingBreakdown.tooling_wear_cost.toFixed(
                                  2,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                Finish Cost:
                              </span>
                              <span>
                                ${line.pricingBreakdown.finish_cost.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Inspection:</span>
                              <span>
                                $
                                {line.pricingBreakdown.inspection_cost.toFixed(
                                  2,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Overhead:</span>
                              <span>
                                ${line.pricingBreakdown.overhead.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="border-t border-gray-200 pt-3 mt-3">
                            <div className="flex justify-between font-semibold">
                              <span>Unit Price:</span>
                              <span>
                                ${line.pricingBreakdown.unit_price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feature Analysis */}
                  <div className="border-t border-gray-200 pt-4">
                    <FeatureAnalysisPanel features={line.features} />
                  </div>

                  {/* Process Recommendation */}
                  <div className="border-t border-gray-200 pt-4">
                    <ProcessRecommendationPanel
                      recommendation={line.process_recommendation}
                    />
                  </div>

                  {/* Bill of Materials */}
                  <div className="border-t border-gray-200 pt-4">
                    <BOMPanel bom={line.bom} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Right Column - Order Summary */}
          <div className="space-y-6">
            {/* Price Summary */}
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CurrencyDollarIcon className="w-5 h-5 mr-2" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Individual Line Items */}
                <div className="space-y-3">
                  {quote.lines.map((line, index) => {
                    const selectedOption = selectedLeadOptions[line.id];
                    const leadOption = line.leadTimeOptions?.find(
                      (option) => option.id === selectedOption,
                    );
                    const unitPrice =
                      leadOption?.unit_price ||
                      line.pricingBreakdown?.unit_price ||
                      0;
                    const lineTotal = unitPrice * line.qty;

                    return (
                      <div
                        key={line.id}
                        className="flex justify-between text-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            Part {index + 1}
                          </div>
                          <div className="text-gray-500">
                            {line.qty} × ${unitPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="font-medium">
                          ${lineTotal.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>${totalPrice.toFixed(2)} USD</span>
                  </div>
                </div>

                {/* Lead Time Summary */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center text-sm font-medium text-blue-900 mb-1">
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    Estimated Delivery
                  </div>
                  <div className="text-lg font-bold text-blue-900">
                    {totalLeadTime} business days
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    Ships from closest facility
                  </div>
                </div>

                {/* Add to Cart Button */}
                <Button
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
                  size="lg"
                >
                  {isAddingToCart ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                      Adding to Cart...
                    </>
                  ) : (
                    <>
                      <ShoppingCartIcon className="w-4 h-4 mr-2" />
                      Add to Cart
                    </>
                  )}
                </Button>

                {/* Additional Options */}
                <div className="space-y-2 pt-4 border-t border-gray-200">
                  <Button variant="outline" className="w-full text-sm">
                    <CogIcon className="w-4 h-4 mr-2" />
                    Customize Parts
                  </Button>
                  <Button variant="outline" className="w-full text-sm">
                    <DocumentIcon className="w-4 h-4 mr-2" />
                    Request Changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Manufacturing Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Manufacturing Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Process</span>
                    <span className="font-medium">
                      {quote.lines[0]?.process}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Material</span>
                    <span className="font-medium">
                      {quote.lines[0]?.material}
                    </span>
                  </div>
                  {quote.lines[0]?.finish && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Finish</span>
                      <span className="font-medium">
                        {quote.lines[0].finish}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Certification</span>
                    <span className="font-medium">AS9100</span>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-3 mt-4">
                  <div className="flex items-center text-green-800 text-sm font-medium">
                    <CheckCircleIcon className="w-4 h-4 mr-1" />
                    Quality Guaranteed
                  </div>
                  <div className="text-green-700 text-xs mt-1">
                    100% inspection • ISO certified facility
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revision History */}
            <RevisionHistoryPanel
              quoteId={quote.id}
              currentQuoteState={quote}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
