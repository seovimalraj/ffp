"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Package,
  ArrowLeft,
  Download,
  Share2,
  MessageSquare,
  CheckCircle,
  Clock,
  Sparkles,
  AlertCircle,
  Info,
  ShieldCheck,
  Truck,
  Lock,
  FileText,
  Wrench,
  Layers,
  Ruler,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  ChevronRight,
  Star,
  Award,
  ThumbsUp,
  Eye,
  CheckSquare,
} from "lucide-react";

interface QuoteDetailsPageProps {
  params: {
    id: string;
  };
}

export default function QuoteDetailsPage({ params }: QuoteDetailsPageProps) {
  const [checkoutStep, setCheckoutStep] = useState<
    "review" | "shipping" | "payment" | "confirmation"
  >("review");
  const [shippingInfo, setShippingInfo] = useState({
    fullName: "",
    company: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
  });
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    nameOnCard: "",
  });

  // Mock quote data - in real app, fetch by params.id
  const quote = {
    id: params.id,
    status: "ready",
    createdAt: "2024-01-20T10:30:00Z",
    expiresAt: "2024-02-20T10:30:00Z",
    customer: {
      name: "John Smith",
      company: "TechCorp Industries",
      email: "john.smith@techcorp.com",
      phone: "+1 (555) 123-4567",
    },
    parts: [
      {
        id: "1",
        name: "Aluminum Bracket - v3.2",
        fileName: "bracket_v3.2.step",
        quantity: 50,
        material: "Aluminum 6061-T6",
        finish: "Anodized - Clear",
        tolerance: '±0.002"',
        dimensions: '4.5" × 3.2" × 1.8"',
        weight: "0.45 lbs",
        volume: "8.2 in³",
        surfaceArea: "42.5 in²",
        unitPrice: 24.5,
        totalPrice: 1225.0,
        leadTime: "5-7 days",
      },
      {
        id: "2",
        name: "Steel Shaft",
        fileName: "shaft_assembly.stp",
        quantity: 25,
        material: "Steel 4140",
        finish: "Black Oxide",
        tolerance: '±0.001"',
        dimensions: '8.0" × 1.5" dia',
        weight: "2.1 lbs",
        volume: "14.1 in³",
        surfaceArea: "37.7 in²",
        unitPrice: 32.0,
        totalPrice: 800.0,
        leadTime: "7-9 days",
      },
    ],
    pricing: {
      subtotal: 2025.0,
      setupFee: 150.0,
      materialsCost: 845.0,
      machiningCost: 980.0,
      finishingCost: 200.0,
      inspectionFee: 75.0,
      shippingEstimate: 85.0,
      tax: 182.25,
      total: 2442.25,
      savings: 245.0,
    },
    timeline: {
      orderReceived: "2024-01-20",
      designReview: "2024-01-21",
      manufacturing: "2024-01-23",
      qualityCheck: "2024-01-28",
      shipping: "2024-01-30",
      delivery: "2024-02-02",
    },
    dfmInsights: [
      {
        type: "success",
        title: "Optimal Tool Access",
        message:
          "All features are accessible with standard 3-axis machining. No special tooling required.",
        icon: CheckCircle,
        severity: "success",
      },
      {
        type: "info",
        title: "Material Utilization",
        message:
          "Current design achieves 78% material utilization. Consider adjusting dimensions to reduce waste.",
        icon: Info,
        severity: "info",
      },
      {
        type: "warning",
        title: "Sharp Internal Corners",
        message:
          '2 internal corners have 90° angles. Consider adding 0.125" radius for easier machining and reduced cost.',
        icon: AlertCircle,
        severity: "warning",
      },
      {
        type: "success",
        title: "Tolerance Optimization",
        message:
          "Specified tolerances are appropriate for the design. Well-balanced between cost and precision.",
        icon: ThumbsUp,
        severity: "success",
      },
    ],
    qualityStandards: [
      { name: "ISO 9001:2015", verified: true },
      { name: "AS9100D", verified: true },
      { name: "ITAR Compliant", verified: false },
      { name: "RoHS Compliant", verified: true },
    ],
    manufacturingNotes: [
      "Parts will be deburred and cleaned before finishing",
      "Anodizing will be Type II, clear, per MIL-A-8625",
      "First article inspection included for quantities over 25",
      "Parts will be individually packaged to prevent damage",
    ],
  };

  const handleCheckout = () => {
    setCheckoutStep("shipping");
  };

  const handleShippingSubmit = () => {
    setCheckoutStep("payment");
  };

  const handlePaymentSubmit = () => {
    setCheckoutStep("confirmation");
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      success:
        "from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-green-300 dark:border-green-800",
      info: "from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 border-blue-300 dark:border-blue-800",
      warning:
        "from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-300 dark:border-yellow-800",
    };
    return colors[severity as keyof typeof colors];
  };

  const getIconColor = (severity: string) => {
    const colors = {
      success: "text-green-600 dark:text-green-400",
      info: "text-blue-600 dark:text-blue-400",
      warning: "text-yellow-600 dark:text-yellow-400",
    };
    return colors[severity as keyof typeof colors];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/instant-quote"
              className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Quotes</span>
            </Link>

            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 px-3 py-1">
                <CheckCircle className="w-3 h-3 mr-1" />
                Quote Ready
              </Badge>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-300"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-300"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-300"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Contact Engineer
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quote Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Quote #{quote.id}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Created {new Date(quote.createdAt).toLocaleDateString()} •
                Expires {new Date(quote.expiresAt).toLocaleDateString()}
              </p>
            </div>

            {checkoutStep === "review" && (
              <div className="text-right">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Total Amount
                </p>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ${quote.pricing.total.toFixed(2)}
                </p>
                <Button
                  onClick={handleCheckout}
                  className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg"
                >
                  <Lock className="w-5 h-5 mr-2" />
                  Proceed to Checkout
                </Button>
              </div>
            )}
          </div>
        </div>

        {checkoutStep === "review" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* 3D Preview & Parts */}
              <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-slate-200 dark:border-slate-800 shadow-xl">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600" />
                    Parts & 3D Preview
                  </h2>

                  {/* 3D Viewer Placeholder */}
                  <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-xl h-96 mb-6 flex items-center justify-center border-2 border-slate-300 dark:border-slate-700">
                    <div className="text-center">
                      <Package className="w-24 h-24 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 dark:text-slate-400 font-medium">
                        Interactive 3D Viewer
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-500">
                        Rotate • Zoom • Measure
                      </p>
                      <div className="flex gap-2 justify-center mt-4">
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          View All Angles
                        </Button>
                        <Button variant="outline" size="sm">
                          <Ruler className="w-4 h-4 mr-2" />
                          Measure
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Parts List */}
                  <div className="space-y-4">
                    {quote.parts.map((part, idx) => (
                      <div
                        key={part.id}
                        className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                Part {idx + 1}
                              </Badge>
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {part.name}
                              </h3>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                              <FileText className="w-4 h-4 inline mr-1" />
                              {part.fileName}
                            </p>

                            {/* Specifications Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Material
                                </p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                  {part.material}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Finish
                                </p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                  {part.finish}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Tolerance
                                </p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                  {part.tolerance}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Quantity
                                </p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                  {part.quantity} units
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Dimensions
                                </p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                  {part.dimensions}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Weight
                                </p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                  {part.weight}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Lead Time
                                </p>
                                <p className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                                  {part.leadTime}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Unit Price
                                </p>
                                <p className="font-semibold text-green-600 dark:text-green-400 text-sm">
                                  ${part.unitPrice}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="text-right ml-6">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                              Total
                            </p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              ${part.totalPrice.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* AI-Powered DFM Insights */}
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800 shadow-xl">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    AI-Powered DFM Analysis
                  </h2>

                  <div className="space-y-3">
                    {quote.dfmInsights.map((insight, idx) => {
                      const Icon = insight.icon;
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl bg-gradient-to-br ${getSeverityColor(insight.severity)} border-2`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon
                              className={`w-6 h-6 mt-0.5 ${getIconColor(insight.severity)}`}
                            />
                            <div className="flex-1">
                              <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                                {insight.title}
                              </h3>
                              <p className="text-sm text-slate-700 dark:text-slate-300">
                                {insight.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-5 h-5 text-green-600" />
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        Manufacturability Score
                      </h3>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-4">
                        <div
                          className="bg-gradient-to-r from-green-500 to-emerald-500 h-4 rounded-full"
                          style={{ width: "87%" }}
                        />
                      </div>
                      <span className="text-2xl font-bold text-green-600">
                        87/100
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Excellent! Your design is well-optimized for CNC
                      manufacturing.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Manufacturing Timeline */}
              <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-slate-200 dark:border-slate-800 shadow-xl">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Manufacturing Timeline
                  </h2>

                  <div className="space-y-4">
                    {Object.entries(quote.timeline).map(([key, date], idx) => (
                      <div key={key} className="flex items-center gap-4">
                        <div className="relative">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              idx === 0
                                ? "bg-gradient-to-br from-green-500 to-emerald-500 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {idx === 0 ? (
                              <CheckCircle className="w-6 h-6" />
                            ) : (
                              <Clock className="w-6 h-6" />
                            )}
                          </div>
                          {idx < Object.keys(quote.timeline).length - 1 && (
                            <div className="absolute left-1/2 top-12 w-0.5 h-8 bg-slate-300 dark:bg-slate-700 transform -translate-x-1/2" />
                          )}
                        </div>

                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {new Date(date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        {idx === 0 && (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Complete
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-1">
                          Expedited Shipping Available
                        </h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Get your parts 3 days faster for an additional $120.
                          Select at checkout.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Quality Standards */}
              <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-slate-200 dark:border-slate-800 shadow-xl">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                    Quality & Compliance
                  </h2>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {quote.qualityStandards.map((standard, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border-2 ${
                          standard.verified
                            ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800"
                            : "bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {standard.verified ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-slate-400" />
                          )}
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {standard.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t-2 border-slate-200 dark:border-slate-700 pt-6">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-blue-600" />
                      Manufacturing Notes
                    </h3>
                    <ul className="space-y-2">
                      {quote.manufacturingNotes.map((note, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                        >
                          <CheckSquare className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Price Breakdown */}
              <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-slate-200 dark:border-slate-800 shadow-xl sticky top-24">
                <div className="p-6">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Price Breakdown
                  </h2>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Parts Subtotal
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        ${quote.pricing.subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Setup Fee
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        ${quote.pricing.setupFee.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Materials
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        ${quote.pricing.materialsCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        CNC Machining
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        ${quote.pricing.machiningCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Finishing
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        ${quote.pricing.finishingCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Inspection
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        ${quote.pricing.inspectionFee.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Shipping (Est.)
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        ${quote.pricing.shippingEstimate.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Tax
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        ${quote.pricing.tax.toFixed(2)}
                      </span>
                    </div>

                    {quote.pricing.savings > 0 && (
                      <div className="flex justify-between text-sm p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <span className="text-green-700 dark:text-green-400 font-medium">
                          Volume Discount
                        </span>
                        <span className="font-bold text-green-700 dark:text-green-400">
                          -${quote.pricing.savings.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t-2 border-slate-300 dark:border-slate-700 pt-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        Total
                      </span>
                      <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        ${quote.pricing.total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={handleCheckout}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 text-lg"
                  >
                    <Lock className="w-5 h-5 mr-2" />
                    Secure Checkout
                  </Button>

                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    <span>Secure Payment • SSL Encrypted</span>
                  </div>
                </div>
              </Card>

              {/* Trust Signals */}
              <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
                <div className="p-6">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-4">
                    Why Choose Us?
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                          4.9/5 Rating
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          10,000+ verified reviews
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                          Quality Guarantee
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          100% satisfaction or money back
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Truck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                          Fast Delivery
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          On-time delivery guaranteed
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Customer Support */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
                <div className="p-6">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-4">
                    Need Help?
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Our engineering team is available 24/7 to answer your
                    questions.
                  </p>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start border-green-300"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      +1 (555) 123-4567
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-green-300"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      support@frigatecnc.com
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-green-300"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Live Chat
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : checkoutStep === "shipping" ? (
          <div className="max-w-4xl mx-auto">
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Shipping Information
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    Where should we deliver your parts?
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-base font-semibold mb-2">
                        Full Name *
                      </Label>
                      <Input
                        placeholder="John Smith"
                        value={shippingInfo.fullName}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            fullName: e.target.value,
                          })
                        }
                        className="h-12"
                      />
                    </div>
                    <div>
                      <Label className="text-base font-semibold mb-2">
                        Company
                      </Label>
                      <Input
                        placeholder="Your Company Inc."
                        value={shippingInfo.company}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            company: e.target.value,
                          })
                        }
                        className="h-12"
                      />
                    </div>
                    <div>
                      <Label className="text-base font-semibold mb-2">
                        Email *
                      </Label>
                      <Input
                        type="email"
                        placeholder="john@company.com"
                        value={shippingInfo.email}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            email: e.target.value,
                          })
                        }
                        className="h-12"
                      />
                    </div>
                    <div>
                      <Label className="text-base font-semibold mb-2">
                        Phone *
                      </Label>
                      <Input
                        placeholder="+1 (555) 123-4567"
                        value={shippingInfo.phone}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            phone: e.target.value,
                          })
                        }
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold mb-2">
                      Address *
                    </Label>
                    <Input
                      placeholder="123 Manufacturing Street"
                      value={shippingInfo.address}
                      onChange={(e) =>
                        setShippingInfo({
                          ...shippingInfo,
                          address: e.target.value,
                        })
                      }
                      className="h-12"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label className="text-base font-semibold mb-2">
                        City *
                      </Label>
                      <Input
                        placeholder="San Francisco"
                        value={shippingInfo.city}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            city: e.target.value,
                          })
                        }
                        className="h-12"
                      />
                    </div>
                    <div>
                      <Label className="text-base font-semibold mb-2">
                        State *
                      </Label>
                      <Input
                        placeholder="CA"
                        value={shippingInfo.state}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            state: e.target.value,
                          })
                        }
                        className="h-12"
                      />
                    </div>
                    <div>
                      <Label className="text-base font-semibold mb-2">
                        ZIP Code *
                      </Label>
                      <Input
                        placeholder="94105"
                        value={shippingInfo.zip}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            zip: e.target.value,
                          })
                        }
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
                    <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-3">
                      Shipping Options
                    </h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-lg border-2 border-blue-500 cursor-pointer">
                        <input
                          type="radio"
                          name="shipping"
                          defaultChecked
                          className="w-5 h-5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              Standard Shipping
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              ${quote.pricing.shippingEstimate.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Delivery by{" "}
                            {new Date(
                              quote.timeline.delivery,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-300 dark:border-slate-700 cursor-pointer hover:border-blue-300">
                        <input
                          type="radio"
                          name="shipping"
                          className="w-5 h-5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              Expedited Shipping
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              $205.00
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            3 days faster delivery
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setCheckoutStep("review")}
                    className="flex-1 py-6 text-lg"
                  >
                    Back to Quote
                  </Button>
                  <Button
                    onClick={handleShippingSubmit}
                    className="flex-1 py-6 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    Continue to Payment
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        ) : checkoutStep === "payment" ? (
          <div className="max-w-4xl mx-auto">
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Payment Information
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    Your payment is secure and encrypted
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-green-600" />
                    <div>
                      <h3 className="font-bold text-green-900 dark:text-green-100">
                        Secure Payment
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        256-bit SSL encryption • PCI DSS compliant
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold mb-2">
                      Card Number *
                    </Label>
                    <Input
                      placeholder="1234 5678 9012 3456"
                      value={paymentInfo.cardNumber}
                      onChange={(e) =>
                        setPaymentInfo({
                          ...paymentInfo,
                          cardNumber: e.target.value,
                        })
                      }
                      className="h-12"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="text-base font-semibold mb-2">
                        Expiry Date *
                      </Label>
                      <Input
                        placeholder="MM/YY"
                        value={paymentInfo.expiry}
                        onChange={(e) =>
                          setPaymentInfo({
                            ...paymentInfo,
                            expiry: e.target.value,
                          })
                        }
                        className="h-12"
                      />
                    </div>
                    <div>
                      <Label className="text-base font-semibold mb-2">
                        CVV *
                      </Label>
                      <Input
                        placeholder="123"
                        value={paymentInfo.cvv}
                        onChange={(e) =>
                          setPaymentInfo({
                            ...paymentInfo,
                            cvv: e.target.value,
                          })
                        }
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold mb-2">
                      Name on Card *
                    </Label>
                    <Input
                      placeholder="John Smith"
                      value={paymentInfo.nameOnCard}
                      onChange={(e) =>
                        setPaymentInfo({
                          ...paymentInfo,
                          nameOnCard: e.target.value,
                        })
                      }
                      className="h-12"
                    />
                  </div>

                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">
                      Order Summary
                    </h3>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">
                          Subtotal
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          ${quote.pricing.subtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">
                          Shipping
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          ${quote.pricing.shippingEstimate.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">
                          Tax
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          ${quote.pricing.tax.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="border-t-2 border-slate-300 dark:border-slate-700 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          Total
                        </span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          ${quote.pricing.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setCheckoutStep("shipping")}
                    className="flex-1 py-6 text-lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handlePaymentSubmit}
                    className="flex-1 py-6 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                  >
                    <Lock className="w-5 h-5 mr-2" />
                    Complete Order - ${quote.pricing.total.toFixed(2)}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="p-12 text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-16 h-16 text-white" />
                </div>

                <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
                  Order Confirmed!
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
                  Thank you for your order. We've received your payment and
                  started processing your parts.
                </p>

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-8 mb-8">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-4">
                    Order Details
                  </h3>
                  <div className="grid grid-cols-2 gap-6 text-left">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Order Number
                      </p>
                      <p className="font-bold text-lg text-slate-900 dark:text-white">
                        #{quote.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Order Total
                      </p>
                      <p className="font-bold text-lg text-green-600">
                        ${quote.pricing.total.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Estimated Delivery
                      </p>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {new Date(quote.timeline.delivery).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Tracking Available
                      </p>
                      <p className="font-bold text-slate-900 dark:text-white">
                        In 24-48 hours
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-slate-600 dark:text-slate-400">
                    We've sent a confirmation email to{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {quote.customer.email}
                    </span>
                  </p>

                  <div className="flex gap-4 justify-center">
                    <Link href="/portal/dashboard">
                      <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg">
                        View Order Status
                      </Button>
                    </Link>
                    <Link href="/instant-quote">
                      <Button variant="outline" className="px-8 py-6 text-lg">
                        Get Another Quote
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <Mail className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                      Email Updates
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      You'll receive updates at every stage
                    </p>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <Truck className="w-8 h-8 text-green-600 mx-auto mb-3" />
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                      Track Shipment
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Real-time tracking once shipped
                    </p>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <MessageSquare className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                      24/7 Support
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      We're here if you need help
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
