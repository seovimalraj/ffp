"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard,
  MapPin,
  Package,
  Clock,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Globe,
  FileText,
  Info,
  ChevronRight,
  Truck,
  Building2,
  Check,
  Lock,
} from "lucide-react";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

interface PartConfig {
  id: string;
  fileName: string;
  material: string;
  quantity: number;
  tolerance: string;
  finish: string;
  leadTimeType: string;
  complexity: string;
  finalPrice: number;
  leadTime: number;
}

interface QuoteConfig {
  parts: PartConfig[];
  email: string;
  quoteId: string;
  totalPrice: number;
  maxLeadTime: number;
}

const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Japan",
  "Australia",
];

const INDUSTRIES = [
  "Aerospace",
  "Automotive",
  "Medical",
  "Defense",
  "Consumer Electronics",
  "Industrial",
  "Robotics",
  "Other",
];

/* ------------------------------------------------------------------ */
/* Component */
/* ------------------------------------------------------------------ */

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params?.quoteId as string;
  const session = useSession();

  const [config, setConfig] = useState<QuoteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // --- Form State ---

  // 1. Shipping Address
  const [shippingAddress, setShippingAddress] = useState({
    name: "",
    country: "United States",
    street: "",
    city: "",
    zip: "",
    phone: "",
    ext: "",
    email: "",
  });

  // 3. Export Control
  const [exportControl, setExportControl] = useState<"no" | "yes" | "">("");

  // 4. Customs Info
  const [customsInfo, setCustomsInfo] = useState({
    type: "prototype" as "prototype" | "production",
    industry: "",
    partDescriptions: {} as Record<string, string>,
  });

  // 5. Shipping Method
  const [shippingMethod, setShippingMethod] = useState({
    method: "ffp" as "ffp" | "account",
    instructions: "",
  });

  // 6. Payment
  const [paymentInfo, setPaymentInfo] = useState({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    billingSameAsShipping: true,
    billingAddress: {
      street: "",
      city: "",
      zip: "",
    },
  });

  const [termsAccepted, setTermsAccepted] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Data Loading */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    async function loadData() {
      if (!quoteId) return;
      setLoading(true);
      try {
        const { data } = await apiClient.get(`/rfq/${quoteId}`);
        if (!data) {
          notify.error("Failed to load quote data");
          return;
        }

        const mappedParts: PartConfig[] = data.parts.map((p: any) => ({
          id: p.id,
          fileName: p.file_name,
          material: p.material,
          quantity: p.quantity,
          tolerance: p.tolerance,
          finish: p.finish,
          leadTimeType: p.lead_time_type,
          complexity: p.geometry?.complexity || "standard",
          finalPrice: p.final_price,
          leadTime: p.lead_time || 7,
        }));

        setConfig({
          parts: mappedParts,
          email: session.data?.user?.email || "",
          quoteId,
          totalPrice: data.rfq.final_price,
          maxLeadTime: data.rfq.lead_time || 7,
        });

        // Initialize part descriptions for customs
        const initialDescriptions: Record<string, string> = {};
        mappedParts.forEach((p: PartConfig) => {
          initialDescriptions[p.id] = "";
        });
        setCustomsInfo((prev) => ({
          ...prev,
          partDescriptions: initialDescriptions,
        }));

        // Auto-fill email if available
        if (session.data?.user?.email) {
          setShippingAddress((prev) => ({
            ...prev,
            email: session.data?.user?.email || "",
          }));
        }
      } catch (error) {
        console.error(error);
        notify.error("Failed to load quote data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [quoteId, session.data?.user?.email]);

  /* ------------------------------------------------------------------ */
  /* Handlers */
  /* ------------------------------------------------------------------ */

  const handlePlaceOrder = async () => {
    if (!termsAccepted) {
      notify.error("Please accept the terms and conditions");
      return;
    }

    // Basic validation...
    if (
      !shippingAddress.name ||
      !shippingAddress.street ||
      !shippingAddress.city ||
      !shippingAddress.zip
    ) {
      notify.error("Please fill in the shipping address");
      return;
    }

    if (!exportControl) {
      notify.error("Please confirm export control status");
      return;
    }

    setIsProcessing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsProcessing(false);
    setOrderPlaced(true);

    setTimeout(() => {
      router.push("/portal/orders");
    }, 3000);
  };

  /* ------------------------------------------------------------------ */
  /* Render Helpers */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-600 font-medium">Preparing your checkout...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Quote Not Found</h2>
          <Button
            className="mt-4"
            onClick={() => router.push("/instant-quote")}
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const subtotal = config.totalPrice;
  const shippingCost = 0; // or mock
  const tax = subtotal * 0.08; // mock 8% tax
  const total = subtotal + shippingCost + tax;

  const estimatedShipDate = new Date();
  estimatedShipDate.setDate(estimatedShipDate.getDate() + config.maxLeadTime);

  const estimatedDeliveryDate = new Date(estimatedShipDate);
  estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1E293B] font-sans pb-20 selection:bg-blue-100 selection:text-blue-700">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="text-slate-600 hover:text-slate-900 border-slate-200 bg-white shadow-sm transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Secure Checkout
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">
                Frigate Manufacturing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              SSL SECURED
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                  JD
                </div>
              </div>
              <span className="hidden sm:inline">
                Reviewing Quote:{" "}
                <span className="text-slate-900 font-bold">
                  #{quoteId.slice(-6).toUpperCase()}
                </span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Section - Form Fields */}
          <div className="lg:col-span-8 space-y-8">
            {/* 1. Shipping Address */}
            <section id="shipping-address" className="space-y-6">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-slate-200 group-hover:bg-blue-600 transition-colors">
                  01
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  Shipping Address
                </h2>
              </div>
              <Card className="border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] overflow-hidden ring-1 ring-slate-200/50">
                <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="ship-name">Full Name</Label>
                    <Input
                      id="ship-name"
                      placeholder="e.g. John Doe"
                      value={shippingAddress.name}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          name: e.target.value,
                        })
                      }
                      className="border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ship-country">Country</Label>
                    <Select
                      value={shippingAddress.country}
                      onValueChange={(v) =>
                        setShippingAddress({ ...shippingAddress, country: v })
                      }
                    >
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ship-street">Street Address</Label>
                    <Input
                      id="ship-street"
                      placeholder="Street and house number"
                      value={shippingAddress.street}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          street: e.target.value,
                        })
                      }
                      className="border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ship-city">City</Label>
                    <Input
                      id="ship-city"
                      placeholder="City"
                      value={shippingAddress.city}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          city: e.target.value,
                        })
                      }
                      className="border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ship-zip">Zip / Postal Code</Label>
                    <Input
                      id="ship-zip"
                      placeholder="ZIP"
                      value={shippingAddress.zip}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          zip: e.target.value,
                        })
                      }
                      className="border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ship-phone">Phone Number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="ship-phone"
                        placeholder="Phone"
                        className="flex-1 border-slate-200 focus-visible:ring-blue-500"
                        value={shippingAddress.phone}
                        onChange={(e) =>
                          setShippingAddress({
                            ...shippingAddress,
                            phone: e.target.value,
                          })
                        }
                      />
                      <Input
                        id="ship-ext"
                        placeholder="Ext"
                        className="w-20 border-slate-200 focus-visible:ring-blue-500"
                        value={shippingAddress.ext}
                        onChange={(e) =>
                          setShippingAddress({
                            ...shippingAddress,
                            ext: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ship-email">Email Address</Label>
                    <Input
                      id="ship-email"
                      type="email"
                      placeholder="email@example.com"
                      value={shippingAddress.email}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          email: e.target.value,
                        })
                      }
                      className="border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* 2. Tax Exemptions */}
            <section id="tax-exemptions" className="space-y-6">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-slate-200 group-hover:bg-blue-600 transition-colors">
                  02
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  Tax Exemptions
                </h2>
              </div>
              <Card className="border-slate-200 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] bg-slate-50/50">
                <CardContent className="p-6 flex gap-6 items-start">
                  <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                    <Info className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-700">
                      This account doesn't have tax exempt certification. To add
                      one, please contact our support team or upload your
                      certificate in the account settings after checkout.
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-blue-600 font-semibold"
                    >
                      Learn more about tax exemptions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* 3. Export Control Confirmation */}
            <section id="export-control" className="space-y-6">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-slate-200 group-hover:bg-blue-600 transition-colors">
                  03
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  Export Control
                </h2>
              </div>
              <Card className="border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] ring-1 ring-slate-200/50">
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-slate-900">
                      Are any parts subject to export control regulations?
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
                      Parts containing sensitive technology may fall under ITAR
                      or EAR regulations. Orders for military or aerospace
                      applications are typically subject to these controls.
                      <span className="text-blue-600 cursor-pointer ml-1 font-semibold hover:underline">
                        Learn more about compliance.
                      </span>
                    </p>
                  </div>

                  <RadioGroup
                    value={exportControl}
                    onValueChange={(v: any) => setExportControl(v)}
                    className="grid grid-cols-1 gap-4"
                  >
                    {[
                      {
                        id: "no",
                        label: "No, standard parts only.",
                        sub: "This quote does not include export controlled items.",
                      },
                      {
                        id: "yes",
                        label: "Yes, parts are subject to ITAR/EAR.",
                        sub: "Including Controlled Unclassified Information (CUI).",
                      },
                    ].map((opt) => (
                      <div
                        key={opt.id}
                        className={cn(
                          "relative flex flex-col p-5 rounded-2xl cursor-pointer transition-all border-2",
                          exportControl === opt.id
                            ? "border-blue-600 bg-blue-50/30 shadow-[0_0_0_1px_rgba(37,99,235,1)]"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
                        )}
                        onClick={() => setExportControl(opt.id as any)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="text-sm font-bold text-slate-900 cursor-pointer">
                              {opt.label}
                            </Label>
                            <p className="text-xs text-slate-500">{opt.sub}</p>
                          </div>
                          <RadioGroupItem
                            value={opt.id}
                            id={`exp-${opt.id}`}
                            className="ring-offset-white focus:ring-blue-600"
                          />
                        </div>
                        {opt.id === "yes" && exportControl === "yes" && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="mt-4 pt-4 border-t border-blue-100 overflow-hidden"
                          >
                            <ul className="text-[11px] text-blue-700/80 space-y-2 font-medium">
                              <li className="flex items-center gap-2">
                                <CheckCircle className="w-3 h-3" /> FFP utilizes
                                verified registered partners only
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle className="w-3 h-3" /> Access
                                restricted to US Persons only
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle className="w-3 h-3" /> Potential
                                impact on pricing and lead times
                              </li>
                            </ul>
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            </section>

            {/* 4. Information Required for Customs */}
            <section id="customs-info" className="space-y-6">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-slate-200 group-hover:bg-blue-600 transition-colors">
                  04
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  Customs Information
                </h2>
              </div>
              <Card className="border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] ring-1 ring-slate-200/50">
                <CardContent className="p-8 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Quote Purpose
                      </Label>
                      <div className="flex bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/50">
                        {["prototype", "production"].map((t) => (
                          <button
                            key={t}
                            className={cn(
                              "flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize",
                              customsInfo.type === t
                                ? "bg-white shadow-md text-blue-600 ring-1 ring-slate-200"
                                : "text-slate-500 hover:text-slate-700",
                            )}
                            onClick={() =>
                              setCustomsInfo({ ...customsInfo, type: t as any })
                            }
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Industry Segment
                      </Label>
                      <Select
                        value={customsInfo.industry}
                        onValueChange={(v) =>
                          setCustomsInfo({ ...customsInfo, industry: v })
                        }
                      >
                        <SelectTrigger className="border-slate-200 h-11 rounded-xl shadow-sm bg-white">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200">
                          {INDUSTRIES.map((i) => (
                            <SelectItem key={i} value={i} className="py-2.5">
                              {i}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-1 bg-blue-600 rounded-full" />
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                        Part Descriptions for Customs
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {config.parts.map((part) => (
                        <div
                          key={part.id}
                          className="group flex flex-col md:flex-row md:items-center gap-6 p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-4 min-w-[200px]">
                            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                              <FileText className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate text-slate-900">
                                {part.fileName}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {part.material}
                              </p>
                            </div>
                          </div>
                          <div className="flex-1">
                            <Input
                              placeholder="Describe the function of this part (e.g. assembly bracket)"
                              value={
                                customsInfo.partDescriptions[part.id] || ""
                              }
                              onChange={(e) =>
                                setCustomsInfo({
                                  ...customsInfo,
                                  partDescriptions: {
                                    ...customsInfo.partDescriptions,
                                    [part.id]: e.target.value,
                                  },
                                })
                              }
                              className="h-12 border-slate-200 bg-slate-50/30 focus-visible:ring-blue-500 rounded-xl"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* 5. Shipping Method */}
            <section id="shipping-method" className="space-y-6">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-slate-200 group-hover:bg-blue-600 transition-colors">
                  05
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  Shipping Method
                </h2>
              </div>
              <Card className="border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] ring-1 ring-slate-200/50">
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-4">
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Delivery Preference
                    </Label>
                    <RadioGroup
                      value={shippingMethod.method}
                      onValueChange={(v: any) =>
                        setShippingMethod({ ...shippingMethod, method: v })
                      }
                      className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                      {[
                        {
                          id: "ffp",
                          title: "FFP Standard",
                          sub: "Fast & Reliable",
                          icon: Truck,
                        },
                        {
                          id: "account",
                          title: "My Account",
                          sub: "UPS / FedEx / DHL",
                          icon: Building2,
                        },
                      ].map((opt) => (
                        <div
                          key={opt.id}
                          className={cn(
                            "group relative flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all border-2",
                            shippingMethod.method === opt.id
                              ? "border-blue-600 bg-blue-50/30 shadow-[0_0_0_1px_rgba(37,99,235,1)]"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
                          )}
                          onClick={() =>
                            setShippingMethod({
                              ...shippingMethod,
                              method: opt.id as any,
                            })
                          }
                        >
                          <div
                            className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                              shippingMethod.method === opt.id
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-400 group-hover:bg-slate-200",
                            )}
                          >
                            <opt.icon className="w-6 h-6" />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="font-bold text-slate-900 cursor-pointer">
                              {opt.title}
                            </Label>
                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tighter">
                              {opt.sub}
                            </p>
                          </div>
                          <RadioGroupItem
                            value={opt.id}
                            id={`ship-${opt.id}`}
                            className="absolute right-5 top-5 opacity-0"
                          />
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label
                      htmlFor="special-instructions"
                      className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                    >
                      Special Instructions
                    </Label>
                    <Textarea
                      id="special-instructions"
                      placeholder="Add any specific delivery requirements (e.g. lift gate, loading dock)..."
                      className="min-h-[120px] border-slate-200 focus-visible:ring-blue-500 rounded-2xl bg-white shadow-sm p-4 text-sm"
                      value={shippingMethod.instructions}
                      onChange={(e) =>
                        setShippingMethod({
                          ...shippingMethod,
                          instructions: e.target.value,
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* 6. Payment Information */}
            <section id="payment-info" className="space-y-6">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-slate-200 group-hover:bg-blue-600 transition-colors">
                  06
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  Payment
                </h2>
              </div>
              <Card className="border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] overflow-hidden ring-1 ring-slate-200/50">
                <div className="bg-slate-50/80 px-8 py-5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Credit Card
                    </span>
                  </div>
                  <div className="flex gap-1.5 opacity-60 grayscale hover:grayscale-0 transition-all">
                    <div className="w-8 h-5 bg-slate-200 rounded animate-pulse" />
                    <div className="w-8 h-5 bg-slate-200 rounded animate-pulse" />
                    <div className="w-8 h-5 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
                <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2 md:col-span-2">
                      <Label
                        htmlFor="card-name"
                        className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                      >
                        Name on Card
                      </Label>
                      <Input
                        id="card-name"
                        placeholder="AS PRINTED ON CARD"
                        className="h-12 border-slate-200 focus-visible:ring-blue-500 rounded-xl bg-white shadow-sm font-medium uppercase placeholder:text-slate-300"
                        value={paymentInfo.cardName}
                        onChange={(e) =>
                          setPaymentInfo({
                            ...paymentInfo,
                            cardName: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label
                        htmlFor="card-number"
                        className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                      >
                        Card Number
                      </Label>
                      <div className="relative">
                        <Input
                          id="card-number"
                          placeholder="0000 0000 0000 0000"
                          className="h-12 pl-12 border-slate-200 focus-visible:ring-blue-500 rounded-xl bg-white shadow-sm font-mono text-lg tracking-wider"
                          value={paymentInfo.cardNumber}
                          onChange={(e) =>
                            setPaymentInfo({
                              ...paymentInfo,
                              cardNumber: e.target.value,
                            })
                          }
                        />
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="card-expiry"
                        className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                      >
                        Expiry Date
                      </Label>
                      <Input
                        id="card-expiry"
                        placeholder="MM / YY"
                        className="h-12 border-slate-200 focus-visible:ring-blue-500 rounded-xl bg-white shadow-sm font-mono text-center tracking-widest"
                        value={paymentInfo.expiry}
                        onChange={(e) =>
                          setPaymentInfo({
                            ...paymentInfo,
                            expiry: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="card-cvv"
                        className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                      >
                        CVC / CVV
                      </Label>
                      <div className="relative">
                        <Input
                          id="card-cvv"
                          placeholder="•••"
                          type="password"
                          className="h-12 border-slate-200 focus-visible:ring-blue-500 rounded-xl bg-white shadow-sm font-mono text-center tracking-widest"
                          value={paymentInfo.cvv}
                          onChange={(e) =>
                            setPaymentInfo({
                              ...paymentInfo,
                              cvv: e.target.value,
                            })
                          }
                        />
                        <Info className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 cursor-help" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100 flex flex-col gap-6">
                    <div className="flex items-center space-x-3 p-1">
                      <Checkbox
                        id="billing-same"
                        checked={paymentInfo.billingSameAsShipping}
                        onCheckedChange={(checked) =>
                          setPaymentInfo({
                            ...paymentInfo,
                            billingSameAsShipping: !!checked,
                          })
                        }
                        className="rounded-md border-slate-300 data-[state=checked]:bg-blue-600 h-5 w-5"
                      />
                      <Label
                        htmlFor="billing-same"
                        className="text-sm font-bold text-slate-600 cursor-pointer select-none"
                      >
                        Billing address same as shipping
                      </Label>
                    </div>

                    <AnimatePresence>
                      {!paymentInfo.billingSameAsShipping && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-200 ring-4 ring-slate-50">
                            <div className="md:col-span-2 space-y-2">
                              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Street Address
                              </Label>
                              <Input
                                placeholder="Enter street address"
                                className="h-11 bg-white border-slate-200 rounded-xl shadow-sm"
                                value={paymentInfo.billingAddress.street}
                                onChange={(e) =>
                                  setPaymentInfo({
                                    ...paymentInfo,
                                    billingAddress: {
                                      ...paymentInfo.billingAddress,
                                      street: e.target.value,
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                City
                              </Label>
                              <Input
                                placeholder="City"
                                className="h-11 bg-white border-slate-200 rounded-xl shadow-sm"
                                value={paymentInfo.billingAddress.city}
                                onChange={(e) =>
                                  setPaymentInfo({
                                    ...paymentInfo,
                                    billingAddress: {
                                      ...paymentInfo.billingAddress,
                                      city: e.target.value,
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                ZIP Code
                              </Label>
                              <Input
                                placeholder="Postal Code"
                                className="h-11 bg-white border-slate-200 rounded-xl shadow-sm"
                                value={paymentInfo.billingAddress.zip}
                                onChange={(e) =>
                                  setPaymentInfo({
                                    ...paymentInfo,
                                    billingAddress: {
                                      ...paymentInfo.billingAddress,
                                      zip: e.target.value,
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* 7. Review */}
            <section id="review" className="space-y-6">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-slate-200 group-hover:bg-blue-600 transition-colors">
                  07
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  Review & Confirm
                </h2>
              </div>
              <Card className="border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] ring-1 ring-slate-200/50 overflow-hidden">
                <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-200 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Final Summary
                  </span>
                </div>
                <CardContent className="p-8 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                        Shipping Destination
                      </p>
                      <div className="relative p-6 rounded-2xl bg-white border border-slate-200 shadow-sm ring-4 ring-slate-50 mt-2">
                        <MapPin className="absolute right-6 top-6 w-5 h-5 text-slate-200" />
                        <div className="text-sm text-slate-900 leading-relaxed font-bold">
                          {shippingAddress.name || (
                            <span className="text-slate-300 font-medium">
                              No Name Provided
                            </span>
                          )}
                          <br />
                          {shippingAddress.street || (
                            <span className="text-slate-300 font-medium">
                              No Street Provided
                            </span>
                          )}
                          <br />
                          <span className="text-slate-500 font-medium">
                            {shippingAddress.city}, {shippingAddress.zip}
                          </span>
                          <br />
                          <span className="inline-block mt-2 px-2 py-0.5 rounded bg-slate-100 text-[10px] font-black uppercase tracking-wider">
                            {shippingAddress.country}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                        Delivery Method
                      </p>
                      <div className="relative p-6 rounded-2xl bg-white border border-slate-200 shadow-sm ring-4 ring-slate-50 mt-2">
                        <Truck className="absolute right-6 top-6 w-5 h-5 text-slate-200" />
                        <div className="text-sm text-slate-900 leading-relaxed font-bold">
                          {shippingMethod.method === "ffp"
                            ? "FFP Standard Logistics"
                            : "Private Carrier Account"}
                          <br />
                          <span className="text-blue-600 font-bold">
                            Est. Delivery:{" "}
                            {estimatedDeliveryDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <br />
                          <span className="text-slate-400 text-xs font-medium block mt-1 italic">
                            Standard Lead Time Applies
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                        Line Items
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold border-slate-200"
                      >
                        {config.parts.length} Units
                      </Badge>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                              Part Info
                            </th>
                            <th className="text-center px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                              Qty
                            </th>
                            <th className="text-right px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                              Price
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {config.parts.map((part) => (
                            <tr
                              key={part.id}
                              className="hover:bg-slate-50/30 transition-colors"
                            >
                              <td className="px-6 py-5">
                                <p className="font-bold text-slate-900 text-sm">
                                  {part.fileName}
                                </p>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex gap-2 mt-1">
                                  <span>{part.material}</span>
                                  <span className="opacity-40">•</span>
                                  <span>{part.finish}</span>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-center font-bold text-slate-600">
                                {part.quantity}
                              </td>
                              <td className="px-6 py-5 text-right">
                                <p className="font-bold text-slate-900">
                                  $
                                  {part.finalPrice.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </p>
                                <p className="text-[10px] font-medium text-slate-400">
                                  $
                                  {(part.finalPrice / part.quantity).toFixed(2)}{" "}
                                  / unit
                                </p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {config.parts.some(
                    (p) => p.material.includes("cert") || true,
                  ) && (
                    <div className="p-6 bg-green-50/30 rounded-2xl border border-green-100/50 flex items-center justify-between group overflow-hidden relative">
                      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-green-100/20 to-transparent pointer-events-none" />
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white border border-green-100 flex items-center justify-center text-green-600 shrink-0 shadow-sm">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900">
                            Standard Compliance Docs
                          </p>
                          <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                            Certifications & reports provided upon shipment
                            completion.
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3 font-black text-[9px] tracking-widest">
                        ENABLED
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>

          {/* Right Section - Sticky Order Summary */}
          <div className="lg:col-span-4 lg:sticky lg:top-28 h-fit space-y-6">
            <Card className="border-slate-200 shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] overflow-hidden ring-1 ring-blue-500/10 bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6 pt-8 px-8">
                <CardTitle className="text-xl font-bold flex items-center justify-between">
                  <span className="tracking-tight text-slate-900">
                    Order Summary
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-700 font-black border-none text-[10px] tracking-widest px-2.5 py-1"
                  >
                    {config.parts.length}{" "}
                    {config.parts.length === 1 ? "ITEM" : "ITEMS"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-4 h-4" />
                      Lead Time
                    </div>
                    <span className="font-semibold text-slate-700">
                      {config.maxLeadTime} Business Days
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Truck className="w-4 h-4" />
                      Estimated Ship Date
                    </div>
                    <span className="font-semibold text-slate-700">
                      {estimatedShipDate.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Package className="w-4 h-4" />
                      Estimated Delivery
                    </div>
                    <span className="font-semibold text-slate-700">
                      {estimatedDeliveryDate.toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium font-mono">
                      ${subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Shipping</span>
                    <span className="text-green-600 font-semibold uppercase text-[10px] tracking-wider bg-green-50 px-2 py-0.5 rounded border border-green-100">
                      Free Standard
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Discount</span>
                    <span className="font-medium font-mono text-slate-400">
                      -$0.00
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tax</span>
                    <span className="font-medium font-mono">
                      ${tax.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <div className="flex justify-between items-baseline mb-6">
                    <span className="text-lg font-bold text-slate-900">
                      Total
                    </span>
                    <div className="text-right">
                      <span className="text-3xl font-black text-blue-600 tracking-tighter font-mono">
                        ${total.toFixed(2)}
                      </span>
                      <p className="text-[10px] text-slate-400 uppercase font-black mt-1">
                        USD
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div
                      className="flex items-start space-x-3 group cursor-pointer"
                      onClick={() => setTermsAccepted(!termsAccepted)}
                    >
                      <div className="pt-0.5">
                        <Checkbox
                          id="terms"
                          checked={termsAccepted}
                          onCheckedChange={(c) => setTermsAccepted(!!c)}
                          className="rounded-md border-slate-300 data-[state=checked]:bg-blue-600"
                        />
                      </div>
                      <Label
                        htmlFor="terms"
                        className="text-[11px] text-slate-500 leading-normal cursor-pointer select-none font-medium"
                      >
                        I agree to the{" "}
                        <span className="text-blue-600 font-bold hover:underline">
                          Terms of Service
                        </span>{" "}
                        and{" "}
                        <span className="text-blue-600 font-bold hover:underline">
                          Privacy Policy
                        </span>
                        . I confirm all configurations are accurate.
                      </Label>
                    </div>

                    <Button
                      className="w-full h-14 text-lg font-black bg-blue-600 hover:bg-blue-700 shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98] rounded-2xl group"
                      onClick={handlePlaceOrder}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                          Processing Transaction...
                        </>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>Place Your Order</span>
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </Button>

                    <div className="flex flex-col items-center gap-4 pt-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">
                        Secure 256-bit SSL Encrypted Payment
                      </p>
                      <div className="flex items-center gap-6 opacity-30 grayscale hover:opacity-60 transition-opacity">
                        <ShieldAlert className="w-5 h-5" />
                        <Building2 className="w-5 h-5" />
                        <Lock className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-start gap-4 ring-1 ring-blue-50">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-blue-900">
                  Frigate Manufacturing Guarantee
                </p>
                <p className="text-[11px] text-blue-700/70 font-medium leading-relaxed">
                  Every order is protected by our quality guarantee. On-time
                  delivery or your money back.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {orderPlaced && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", damping: 25 }}
              className="text-center max-w-lg px-12"
            >
              <div className="relative w-32 h-32 mx-auto mb-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", damping: 12 }}
                  className="w-full h-full bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200"
                >
                  <Check className="w-16 h-16 text-white stroke-[3px]" />
                </motion.div>
                <div className="absolute -inset-4 bg-blue-100/50 rounded-full -z-10 animate-ping opacity-20" />
              </div>

              <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">
                Success! Order Placed.
              </h2>
              <p className="text-lg text-slate-500 mb-10 leading-relaxed font-medium">
                We've received your request. A confirmation and invoice have
                been sent to{" "}
                <span className="text-slate-900 font-bold underline decoration-blue-500 decoration-2 underline-offset-4">
                  {shippingAddress.email}
                </span>
              </p>

              <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200/60 shadow-inner flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Transmission ID
                  </span>
                  <span className="font-mono text-xl font-bold text-blue-600 uppercase tracking-tight">
                    {Math.random().toString(36).substring(2, 10).toUpperCase()}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-400 mt-4 animate-pulse">
                  Redirecting to Dashboard...
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
