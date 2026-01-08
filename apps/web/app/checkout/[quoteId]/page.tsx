"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
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
import {
  MapPin,
  Package,
  Clock,
  AlertCircle,
  Loader2,
  Truck,
  Check,
  Plus,
  ChevronRight,
  LayoutDashboard,
  Package2,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Logo from "@/components/ui/logo";
import { User } from "@/components/Layouts/sidebar/icons";
import Footer from "@/components/ui/footer";

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
  status: string;
  quoteId: string;
  totalPrice: number;
  maxLeadTime: number;
}

interface ShippingAddress {
  id: string;
  name: string;
  country: string;
  street1: string;
  street2?: string;
  street3?: string;
  city: string;
  zip: string;
  phone: string;
  phoneExt: string;
  email: string;
}

const COUNTRIES = [
  "United States",
  "India",
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

const SHIPPING_SERVICES = ["FedEx", "UPS", "DHL", "USPS"];

const SHIPPING_METHODS = [
  "Ground",
  "Standard",
  "Express",
  "Overnight",
  "Next Day Air",
  "2nd Day Air",
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
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("1");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<Omit<ShippingAddress, "id">>({
    name: "",
    country: "India",
    street1: "",
    street2: "",
    street3: "",
    city: "",
    zip: "",
    phone: "",
    phoneExt: "+91",
    email: "",
  });

  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  const handleAddAddress = async () => {
    if (
      !newAddress.name ||
      !newAddress.street1 ||
      !newAddress.city ||
      !newAddress.zip ||
      !newAddress.phone ||
      !newAddress.email
    ) {
      notify.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingAddressId) {
        setAddresses(
          addresses.map((a) =>
            a.id === editingAddressId ? { ...newAddress, id: a.id } : a,
          ),
        );
        setEditingAddressId(null);
        notify.success("Address updated successfully");
      } else {
        const response = await apiClient.post("/orders/shipping_address", {
          name: newAddress.name,
          street1: newAddress.street1,
          street2: newAddress.street2,
          city: newAddress.city,
          zip: newAddress.zip,
          country: newAddress.country,
          phone: newAddress.phone,
          email: newAddress.email,
        });

        // Refetch all addresses to ensure synchronization
        try {
          const addrRes = await apiClient.get("/orders/shipping_address");
          if (addrRes.data && addrRes.data.data) {
            const fetchedAddresses = addrRes.data.data.map((addr: any) => ({
              id: addr.id,
              name: addr.name,
              street1: addr.street1,
              street2: addr.street2,
              city: addr.city,
              zip: addr.zip,
              country: addr.country,
              phone: addr.phone,
              email: addr.email,
              phoneExt: addr.phoneExt || "+91",
              street3: addr.street3 || "",
            }));
            setAddresses(fetchedAddresses);
            
            // Set the newly added address as selected
            if (response.data && response.data.data) {
              const created = response.data.data;
              if (created && created.id) {
                setSelectedAddressId(created.id);
              }
            }
            notify.success("Address saved successfully");
          }
        } catch (fetchError) {
          console.error("Failed to refetch addresses:", fetchError);
          // Fallback to adding from response
          if (response.data && response.data.data) {
            const created = response.data.data[0];
            if (created) {
              const addedAddress: ShippingAddress = {
                id: created.id,
                name: created.name,
                street1: created.street1,
                street2: created.street2,
                city: created.city,
                zip: created.zip,
                country: created.country,
                phone: created.phone,
                email: created.email,
                phoneExt: "+91",
                street3: "",
              };
              setAddresses([...addresses, addedAddress]);
              setSelectedAddressId(created.id);
              notify.success("Address saved successfully");
            }
          }
        }
      }

      setShowAddressForm(false);
      setNewAddress({
        name: "",
        country: "India",
        street1: "",
        street2: "",
        street3: "",
        city: "",
        zip: "",
        phone: "",
        phoneExt: "+91",
        email: "",
      });
    } catch (error) {
      console.error("Failed to save address:", error);
      notify.error("Failed to save address");
    }
  };

  const handleEditAddress = (addr: ShippingAddress) => {
    setNewAddress({ ...addr });
    setEditingAddressId(addr.id);
    setShowAddressForm(true);
  };

  const handleCancelForm = () => {
    setShowAddressForm(false);
    setEditingAddressId(null);
    setNewAddress({
      name: "",
      country: "India",
      street1: "",
      street2: "",
      street3: "",
      city: "",
      zip: "",
      phone: "",
      phoneExt: "+91",
      email: "",
    });
  };

  // 4. Customs & Compliance Information (Restored with updated design)
  const [customsInfo, setCustomsInfo] = useState({
    type: "prototype" as "prototype" | "production",
    industry: "",
    partDescriptions: {} as Record<string, string>,
  });

  const [shippingMethod, setShippingMethod] = useState({
    method: "ffp" as "ffp" | "account",
    service: "",
    accountNumber: "",
    shippingMethod: "",
    instructions: "",
  });

  // 6. Payment

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [priceConcentAccepted, setPriceConcentAccepted] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(["1"]);

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

        console.log(data);

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
          status: data.rfq.status,
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

        // Fetch Shipping Addresses
        try {
          const addrRes = await apiClient.get("/orders/shipping_address");
          if (addrRes.data && addrRes.data.data) {
            const fetchedAddresses = addrRes.data.data.map((addr: any) => ({
              id: addr.id,
              name: addr.name,
              street1: addr.street1,
              street2: addr.street2,
              city: addr.city,
              zip: addr.zip,
              country: addr.country,
              phone: addr.phone,
              email: addr.email,
              phoneExt: "+91",
              street3: "",
            }));
            setAddresses(fetchedAddresses);
            if (fetchedAddresses.length > 0 && selectedAddressId === "1") {
              setSelectedAddressId(fetchedAddresses[0].id);
            }
          }
        } catch (addrError) {
          console.error("Failed to fetch addresses:", addrError);
          // Don't block the UI if addresses fail to load, just show empty
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

  const isStep1Valid = () => {
    if (!selectedAddress) return false;
    if (shippingMethod.method === "account") {
      return !!(
        shippingMethod.service &&
        shippingMethod.accountNumber &&
        shippingMethod.shippingMethod
      );
    }
    return true;
  };

  const isStep2Valid = () => {
    return !!customsInfo.industry;
  };

  const isStep3Valid = () => {
    return true; // PayPal is always valid as it's the only option
  };

  // console.log(config);
  const handleNextFromShipping = () => {
    if (!selectedAddress) {
      notify.error("Please select or add a shipping address");
      return;
    }
    if (shippingMethod.method === "account") {
      if (
        !shippingMethod.service ||
        !shippingMethod.accountNumber ||
        !shippingMethod.shippingMethod
      ) {
        notify.error("Please fill in all shipping account details");
        return;
      }
    }
    // Close current section and open next
    setSelectedKeys(["2"]);
    // Scroll to next section after state update with offset for sticky header
    setTimeout(() => {
      const element = document.getElementById("accordion-item-2");
      if (element) {
        const yOffset = -100; // Offset for sticky header
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 100);
  };

  const handleNextFromCustoms = () => {
    if (!isStep2Valid()) {
      notify.error("Please select an industry to proceed");
      return;
    }
    // Close current section and open next
    setSelectedKeys(["3"]);
    // Scroll to next section after state update with offset for sticky header
    setTimeout(() => {
      const element = document.getElementById("accordion-item-3");
      if (element) {
        const yOffset = -100; // Offset for sticky header
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 100);
  };

  const handleNextFromPayment = () => {
    if (!isStep3Valid()) {
      notify.error("Please fill in all payment details");
      return;
    }
    // Close current section and open next
    setSelectedKeys(["4"]);
    // Scroll to next section after state update with offset for sticky header
    setTimeout(() => {
      const element = document.getElementById("accordion-item-4");
      if (element) {
        const yOffset = -100; // Offset for sticky header
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 100);
  };
  // console.log(config, customsInfo, shippingMethod, paymentInfo);
  const createInternalOrder = async () => {
    if (!selectedAddress) {
      notify.error("Please select or add a shipping address");
      return null;
    }

    const orderParts = config?.parts.map((p: PartConfig) => ({
      rfq_part_id: p.id,
      part_name: p.fileName,
      quantity: p.quantity,
      unit_price: p.finalPrice,
      lead_time: p.leadTime,
      lead_time_type: p.leadTimeType,
    }));

    setIsProcessing(true);

    try {
      const response = await apiClient.post("/orders", {
        rfqId: quoteId,
        parts: orderParts,
        subtotal: total,
        shippingCost: 0,
        taxAmount: 0,
        customsInfo,
        internalNotes: "",
        addressSnapshot: selectedAddress,
        shippingMethod: shippingMethod.method,
        shippingInformation: shippingMethod,
      });

      if (!response?.data?.data) {
        throw new Error("Order creation failed");
      }
      return response.data.data; // orderId
    } catch (error: any) {
      console.error("Create order error:", error);
      notify.error(
        error?.response?.data?.message ?? "Failed to create order request",
      );
      setIsProcessing(false);
      return null;
    }
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
  const tax = 0; // mock 8% tax
  const total = subtotal + shippingCost;

  const estimatedShipDate = new Date();
  estimatedShipDate.setDate(estimatedShipDate.getDate() + config.maxLeadTime);

  const estimatedDeliveryDate = new Date(estimatedShipDate);
  estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);

  if (config && config.status === "paid") {
    notify.error("This quote has already been paid");
    router.push("/portal/orders");
    return null;
  }

  console.log(config);
  return (
    <PayPalScriptProvider
      options={{
        clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
        currency: "USD",
        intent: "capture",
        components: "buttons",
      }}
    >
      <div className="min-h-screen invisible-scrollbar bg-[#F0F4F8] relative font-sans text-slate-900">
        {/* Dynamic Background Elements */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-400/20 rounded-full blur-[100px] opacity-40"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-400/20 rounded-full blur-[100px] opacity-40"></div>
        </div>
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-white/80 backdrop-blur-xl shadow-sm supports-[backdrop-filter]:bg-white/60">
          <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4 py-3">
            {/* Left: Logo & Breadcrumbs */}
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-2 group transition-opacity hover:opacity-80"
              >
                <div className="h-12 w-auto relative">
                  <Logo classNames="h-full w-auto object-contain" />
                </div>
              </Link>
              <div className="hidden md:block w-px h-8 bg-slate-200"></div>

              <div className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-500">
                <Link
                  href="/instant-quote"
                  className="hover:text-blue-600 transition-colors"
                >
                  Instant Quote
                </Link>

                <ChevronRight className="w-4 h-4 text-slate-400" />
                <Link
                  href={`/quote-config/${quoteId}`}
                  className="hover:text-blue-600 transition-colors"
                >
                  Configuration
                </Link>

                <ChevronRight className="w-4 h-4 text-slate-400" />
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold uppercase tracking-wider border border-blue-100">
                  Checkout
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              {session.status === "authenticated" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full bg-slate-100 p-0 hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-200 hover:border-blue-200"
                    >
                      <User className="w-5 h-5" />
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-white"></span>
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-60 p-2 shadow-xl border-slate-100 rounded-xl"
                  >
                    <DropdownMenuLabel className="font-normal p-2">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-bold text-slate-900 leading-none">
                          {session?.data?.user?.name}
                        </p>
                        <p className="text-xs leading-none text-slate-500 truncate">
                          {session?.data?.user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-100 my-1" />
                    <DropdownMenuItem
                      onClick={() => signOut()}
                      className="text-slate-700 cursor-pointer rounded-lg focus:bg-slate-50 focus:text-blue-600 p-2"
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => signOut()}
                      className="text-slate-700 cursor-pointer rounded-lg focus:bg-slate-50 focus:text-blue-600 p-2"
                    >
                      <Package2 className="w-4 h-4 mr-2" />
                      Orders
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-100 my-1" />
                    <DropdownMenuItem
                      onClick={() => signOut()}
                      className="text-red-600 cursor-pointer rounded-lg focus:bg-red-50 focus:text-red-700 p-2"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2 pl-2">
                  <Link href="/login">
                    <Button
                      variant="ghost"
                      className="text-slate-600 hover:text-blue-600 font-medium"
                    >
                      Sign In
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Section - Accordion Form */}
            <div className="lg:col-span-8">
              <Accordion
                activeKey={selectedKeys}
                onToggle={(key) => {
                  // Prevent opening later steps if previous aren't valid
                  if (key === "2" && !isStep1Valid()) {
                    notify.error("Please complete the shipping section first");
                    return;
                  }
                  if (key === "3" && (!isStep1Valid() || !isStep2Valid())) {
                    notify.error("Please complete the previous sections first");
                    return;
                  }
                  if (
                    key === "4" &&
                    (!isStep1Valid() || !isStep2Valid() || !isStep3Valid())
                  ) {
                    notify.error(
                      "Please complete all sections before reviewing",
                    );
                    return;
                  }

                  setSelectedKeys((prev) =>
                    prev.includes(key)
                      ? prev.filter((k) => k !== key)
                      : [...prev, key],
                  );
                }}
                className="gap-4"
                allowMultiple={true}
              >
                {/* Step 1: Shipping Address */}
                <AccordionItem
                  id="1"
                  title={
                    <div id="accordion-item-1" className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                        1
                      </div>
                      <span>Shipping Address</span>
                    </div>
                  }
                >
                  <div className="space-y-6 pt-2">
                    {!showAddressForm ? (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <Label className="text-base font-semibold text-slate-800">
                            Your Addresses
                          </Label>
                          <div className="space-y-3">
                            {addresses.map((addr) => (
                              <div
                                key={addr.id}
                                onClick={() => setSelectedAddressId(addr.id)}
                                className={cn(
                                  "flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer",
                                  selectedAddressId === addr.id
                                    ? "border-blue-600 bg-blue-50/30"
                                    : "border-transparent hover:bg-slate-50",
                                )}
                              >
                                <div className="pt-0.5">
                                  <div
                                    className={cn(
                                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                      selectedAddressId === addr.id
                                        ? "border-blue-600 bg-blue-600"
                                        : "border-slate-300 bg-white",
                                    )}
                                  >
                                    {selectedAddressId === addr.id && (
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                    <p className="font-bold text-slate-900 mb-1">
                                      {addr.name}
                                    </p>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditAddress(addr);
                                      }}
                                      className="text-blue-600 font-semibold h-auto p-0 hover:no-underline"
                                    >
                                      Edit
                                    </Button>
                                  </div>
                                  <div className="text-sm text-slate-600 leading-relaxed font-medium">
                                    <p className="truncate">
                                      {[
                                        addr.street1,
                                        addr.street2,
                                        addr.street3,
                                        addr.city + ",",
                                        addr.zip,
                                      ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    </p>
                                    <p>{addr.country}</p>
                                    <p className="mt-1">{addr.phone}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => setShowAddressForm(true)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 -ml-2 gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Shipping Address</span>
                          </Button>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                          <Label className="mb-4 block font-bold text-slate-800">
                            Shipping Method
                          </Label>
                          <RadioGroup
                            value={shippingMethod.method}
                            onValueChange={(v: any) =>
                              setShippingMethod({
                                ...shippingMethod,
                                method: v,
                              })
                            }
                            className="grid grid-cols-1 md:grid-cols-2 gap-4"
                          >
                            {[
                              {
                                id: "ffp",
                                title: "FFP Standard",
                                sub: "Standard shipping handled by us",
                                iconType: "truck" as const,
                              },
                              {
                                id: "account",
                                title: "Collector / My Account",
                                sub: "Use your own shipping account",
                                iconType: "organization" as const,
                              },
                            ].map((opt) => (
                              <label
                                key={opt.id}
                                className={cn(
                                  "flex items-center gap-4 p-4 rounded-xl cursor-pointer border-2 transition-all",
                                  shippingMethod.method === opt.id
                                    ? "border-blue-600 bg-blue-50/50"
                                    : "border-slate-100 hover:border-slate-200",
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                    shippingMethod.method === opt.id
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-100 text-slate-400",
                                  )}
                                >
                                  {opt.iconType === "truck" ? (
                                    <Truck className="w-5 h-5" />
                                  ) : (
                                    <img
                                      src="/icons/organzation.svg"
                                      alt=""
                                      className={`w-10 h-10 ${shippingMethod.method === opt.id ? "invert" : ""}`}
                                    />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-slate-900">
                                    {opt.title}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {opt.sub}
                                  </p>
                                </div>
                                <RadioGroupItem
                                  value={opt.id}
                                  className="sr-only"
                                />
                              </label>
                            ))}
                          </RadioGroup>

                          {shippingMethod.method === "account" && (
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl border border-blue-100 bg-blue-50/30 animate-in fade-in slide-in-from-top-4 duration-300">
                              <div className="space-y-2">
                                <Label htmlFor="shipping-service">
                                  Shipping Service
                                </Label>
                                <Select
                                  value={shippingMethod.service}
                                  onValueChange={(v) =>
                                    setShippingMethod({
                                      ...shippingMethod,
                                      service: v,
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    id="shipping-service"
                                    className="bg-white border-slate-200"
                                  >
                                    <SelectValue placeholder="Select Service" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SHIPPING_SERVICES.map((s) => (
                                      <SelectItem
                                        key={s}
                                        value={s.toLowerCase()}
                                      >
                                        {s}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="account-number">
                                  Shipping Account Number
                                </Label>
                                <Input
                                  id="account-number"
                                  placeholder="Enter account number"
                                  className="bg-white border-slate-200"
                                  value={shippingMethod.accountNumber}
                                  onChange={(e) =>
                                    setShippingMethod({
                                      ...shippingMethod,
                                      accountNumber: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="shipping-method">
                                  Shipping Method
                                </Label>
                                <Select
                                  value={shippingMethod.shippingMethod}
                                  onValueChange={(v) =>
                                    setShippingMethod({
                                      ...shippingMethod,
                                      shippingMethod: v,
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    id="shipping-method"
                                    className="bg-white border-slate-200"
                                  >
                                    <SelectValue placeholder="Select Shipping Method" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SHIPPING_METHODS.map((m) => (
                                      <SelectItem
                                        key={m}
                                        value={m.toLowerCase()}
                                      >
                                        {m}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end pt-8">
                          <Button
                            onClick={handleNextFromShipping}
                            className="bg-blue-600 hover:bg-blue-700 min-w-[120px] h-11 px-8 rounded-lg font-bold shadow-lg shadow-blue-200"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-slate-900">
                            {editingAddressId
                              ? "Edit Shipping Address"
                              : "New Shipping Address"}
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelForm}
                            className="text-slate-500"
                          >
                            Cancel
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="ship-name">Full Name</Label>
                            <Input
                              id="ship-name"
                              placeholder="John Doe"
                              value={newAddress.name}
                              onChange={(e) =>
                                setNewAddress({
                                  ...newAddress,
                                  name: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="ship-country">Country</Label>
                            <Select
                              value={newAddress.country}
                              onValueChange={(v) =>
                                setNewAddress({ ...newAddress, country: v })
                              }
                            >
                              <SelectTrigger>
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
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="ship-street1">Street Address</Label>
                            <div className="space-y-2">
                              <Input
                                id="ship-street1"
                                placeholder="Line 1"
                                value={newAddress.street1}
                                onChange={(e) =>
                                  setNewAddress({
                                    ...newAddress,
                                    street1: e.target.value,
                                  })
                                }
                              />
                              <Input
                                id="ship-street2"
                                placeholder="Line 2"
                                value={newAddress.street2}
                                onChange={(e) =>
                                  setNewAddress({
                                    ...newAddress,
                                    street2: e.target.value,
                                  })
                                }
                              />
                              <Input
                                id="ship-street3"
                                placeholder="Line 3"
                                value={newAddress.street3}
                                onChange={(e) =>
                                  setNewAddress({
                                    ...newAddress,
                                    street3: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="ship-city">City</Label>
                            <Input
                              id="ship-city"
                              placeholder="City"
                              value={newAddress.city}
                              onChange={(e) =>
                                setNewAddress({
                                  ...newAddress,
                                  city: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="ship-zip">Zip Code</Label>
                            <Input
                              id="ship-zip"
                              placeholder="12345"
                              value={newAddress.zip}
                              onChange={(e) =>
                                setNewAddress({
                                  ...newAddress,
                                  zip: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="md:col-span-2 pt-4">
                            <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                              Contact Information
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="ship-phone">Phone Number</Label>
                                <Input
                                  id="ship-phone"
                                  value={newAddress.phone}
                                  onChange={(e) =>
                                    setNewAddress({
                                      ...newAddress,
                                      phone: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="ship-ext">Phone Ext</Label>
                                <Input
                                  id="ship-ext"
                                  value={newAddress.phoneExt}
                                  onChange={(e) =>
                                    setNewAddress({
                                      ...newAddress,
                                      phoneExt: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="ship-email">Email</Label>
                                <Input
                                  id="ship-email"
                                  value={newAddress.email}
                                  onChange={(e) =>
                                    setNewAddress({
                                      ...newAddress,
                                      email: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={handleAddAddress}
                          className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl font-bold"
                        >
                          {editingAddressId
                            ? "Update Address"
                            : "Save and Use This Address"}
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionItem>

                {/* Step 2: Customs Information */}
                <AccordionItem
                  id="2"
                  title={
                    <div id="accordion-item-2" className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                        2
                      </div>
                      <span>Customs & Industry</span>
                    </div>
                  }
                >
                  <div className="space-y-6 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="part-type">Part Type</Label>
                        <Select
                          value={customsInfo.type}
                          onValueChange={(v) =>
                            setCustomsInfo({ ...customsInfo, type: v as any })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="prototype">Prototype</SelectItem>
                            <SelectItem value="production">
                              Production
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="industry">Industry</Label>
                        <Select
                          value={customsInfo.industry}
                          onValueChange={(v) =>
                            setCustomsInfo({ ...customsInfo, industry: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                          <SelectContent>
                            {INDUSTRIES.map((i) => (
                              <SelectItem key={i} value={i}>
                                {i}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <p className="text-sm font-semibold text-slate-700">
                        Part Descriptions
                      </p>
                      <div className="space-y-3">
                        {config.parts.map((part) => (
                          <div
                            key={part.id}
                            className="flex gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                          >
                            <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                              <Package className="w-6 h-6 text-slate-400" />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs font-bold text-slate-500 truncate mb-1 block">
                                {part.fileName}
                              </Label>
                              <Input
                                placeholder="e.g. Aluminum engine casing"
                                className="h-9 bg-white"
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
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button
                        onClick={handleNextFromCustoms}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Continue to Payment
                      </Button>
                    </div>
                  </div>
                </AccordionItem>

                {/* Step 3: Payment */}
                <AccordionItem
                  id="3"
                  title={
                    <div id="accordion-item-3" className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                        3
                      </div>
                      <span>Payment Method</span>
                    </div>
                  }
                >
                  <div className="p-6 rounded-2xl border-2 border-blue-600 bg-blue-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#003087] flex items-center justify-center">
                        <img
                          src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg"
                          alt="PayPal"
                          className="h-6"
                        />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-lg leading-tight">
                          PayPal
                        </p>
                        <p className="text-sm text-slate-500 font-medium">
                          The safer, easier way to pay
                        </p>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
                    <p className="text-slate-600 font-medium">
                      You will be redirected to PayPal in the next step to
                      complete your payment securely.
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleNextFromPayment}
                      className="bg-blue-600 hover:bg-blue-700 font-bold h-11 px-8 rounded-lg shadow-lg shadow-blue-200"
                    >
                      Review Order
                    </Button>
                  </div>
                </AccordionItem>

                {/* Step 4: Final Review */}
                <AccordionItem
                  id="4"
                  title={
                    <div id="accordion-item-4" className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                        4
                      </div>
                      <span>Review Order</span>
                    </div>
                  }
                >
                  <div className="space-y-8 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 rounded-2xl bg-slate-50/50 border border-slate-100">
                      <div className="space-y-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5" /> Shipping
                          Destination
                        </p>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 text-base">
                            {selectedAddress?.name || "Enter Name"}
                          </p>
                          <p className="text-slate-600 text-sm">
                            {selectedAddress?.street1 || "Enter Street"}
                          </p>
                          {selectedAddress?.street2 && (
                            <p className="text-slate-600 text-sm">
                              {selectedAddress.street2}
                            </p>
                          )}
                          {selectedAddress?.street3 && (
                            <p className="text-slate-600 text-sm">
                              {selectedAddress.street3}
                            </p>
                          )}
                          <p className="text-slate-600 text-sm">
                            {selectedAddress?.city
                              ? `${selectedAddress.city}, `
                              : ""}
                            {selectedAddress?.zip
                              ? `${selectedAddress.zip} `
                              : ""}
                            {selectedAddress?.country}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5" /> Logistic Details
                        </p>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 text-base uppercase">
                            {shippingMethod.method === "ffp"
                              ? "FFP Standard"
                              : `${shippingMethod.service?.toUpperCase()} (${shippingMethod.shippingMethod?.charAt(0).toUpperCase()}${shippingMethod.shippingMethod?.slice(1)})`}
                          </p>
                          {shippingMethod.method === "account" && (
                            <p className="text-xs text-slate-500 font-medium">
                              Account: {shippingMethod.accountNumber}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                            <Clock className="w-4 h-4" />
                            Est. Delivery:{" "}
                            {estimatedDeliveryDate.toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          Order Manifest ({config.parts.length} Components)
                        </p>
                      </div>
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                        {config.parts.map((part) => (
                          <div
                            key={part.id}
                            className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex gap-4 items-center">
                              <div className="w-12 h-12 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-center">
                                <Package className="w-6 h-6 text-slate-300" />
                              </div>
                              <div>
                                <Link
                                  href={`/quote-config/${quoteId}?partId=${part.id}`}
                                  className="text-sm font-bold text-slate-900 hover:text-blue-600 hover:underline transition-colors"
                                >
                                  {part.fileName}
                                </Link>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge
                                    variant="secondary"
                                    className="bg-slate-100 text-slate-600 border-none text-[10px] px-1.5 py-0 h-4"
                                  >
                                    {part.material}
                                  </Badge>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    Qty: {part.quantity}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-900 font-mono">
                                ${part.finalPrice.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                Unit Cost
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 mt-6 border-t border-slate-100">
                      <div
                        className="flex items-center space-x-3 group cursor-pointer p-5 rounded-[2rem] bg-slate-50 border border-slate-200 hover:border-blue-200 transition-all duration-300 shadow-inner"
                        onClick={() =>
                          setPriceConcentAccepted(!priceConcentAccepted)
                        }
                      >
                        <div className="pt-1">
                          <Checkbox
                            id="review-terms"
                            checked={priceConcentAccepted}
                            onCheckedChange={(c) =>
                              setPriceConcentAccepted(!!c)
                            }
                            className="h-6 w-6 rounded-lg border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 shadow-sm transition-all"
                          />
                        </div>
                        <Label
                          htmlFor="review-terms"
                          className="text-sm text-slate-600 leading-relaxed cursor-pointer select-none font-semibold"
                        >
                          I confirm that I have reviewed the pricing for this
                          parts and agree to the final price.
                        </Label>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-200">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="text-lg font-bold">
                            Total Commitment
                          </h3>
                          <p className="text-blue-100 text-xs">
                            Includes all parts and shipping
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-black tracking-tighter font-mono">
                            ${total.toFixed(2)}
                          </span>
                          <p className="text-[10px] text-blue-100 uppercase font-black">
                            USD
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Right Section - Sticky Order Summary */}
            <div className="lg:col-span-4 lg:sticky lg:top-28 h-fit space-y-6">
              <Card className="border-slate-200 shadow-2xl shadow-slate-200/50 rounded-3xl overflow-hidden ring-1 ring-slate-200/50 bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6 pt-8 px-8">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-xl font-black tracking-tight text-slate-900">
                        Order Summary
                      </span>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Pricing Breakdown
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-blue-50 text-blue-600 font-black border-blue-100 text-[10px] tracking-widest px-3 py-1 rounded-lg"
                    >
                      {config.parts.length}{" "}
                      {config.parts.length === 1 ? "PART" : "PARTS"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Production Timeline
                    </p>
                    <div className="space-y-3">
                      {config.parts.map((p) => (
                        <div
                          key={p.id}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="text-slate-500 font-medium truncate max-w-[150px]">
                            {p.fileName}
                          </span>
                          <div className="flex items-center gap-2 font-bold text-slate-900">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            {p.leadTime} Days
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                        <Truck className="w-4 h-4 text-slate-400" />
                        Estimated Shipping
                      </div>

                      <span className="font-semibold text-slate-800 self-end">
                        Our team will reach out to confirm timelines.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-slate-500 font-medium">
                        Subtotal
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        $
                        {subtotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-slate-500 font-medium">
                        Shipping & Logistics
                      </span>
                      <span className="text-emerald-600 font-bold uppercase text-[10px] tracking-widest bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 shadow-sm">
                        Complimentary
                      </span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-slate-500 font-medium">
                        Estimated Tax
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        ${tax.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100">
                    <div className="flex justify-between items-end mb-8">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Total Payable
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                          Currency in USD
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-4xl font-black text-blue-600 tracking-tighter font-mono">
                          $
                          {total.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div
                        className="flex items-start space-x-3 group cursor-pointer p-4 rounded-2xl bg-slate-50/50 border border-transparent hover:border-slate-200 transition-all"
                        onClick={() => setTermsAccepted(!termsAccepted)}
                      >
                        <div className="pt-0.5">
                          <Checkbox
                            id="terms"
                            checked={termsAccepted}
                            onCheckedChange={(c) => setTermsAccepted(!!c)}
                            className="rounded-md border-slate-300 data-[state=checked]:bg-blue-600 shadow-sm"
                          />
                        </div>
                        <Label
                          htmlFor="terms"
                          className="text-[11px] text-slate-500 leading-relaxed cursor-pointer select-none font-medium"
                        >
                          I agree to the{" "}
                          <span className="text-blue-600 font-bold hover:underline transition-all">
                            Terms of Service
                          </span>{" "}
                          and{" "}
                          <span className="text-blue-600 font-bold hover:underline transition-all">
                            Manufacturing Guidelines
                          </span>
                          .
                        </Label>
                      </div>

                      <div className="space-y-4">
                        <PayPalButtons
                          style={{
                            layout: "vertical",
                            color: "blue",
                            shape: "rect",
                            label: "pay",
                            height: 55,
                          }}
                          disabled={isProcessing}
                          onClick={(data, actions) => {
                            if (!termsAccepted || !priceConcentAccepted) {
                              notify.error(
                                "Please accept the terms and conditions in the summary",
                              );
                              return actions.reject();
                            }
                            return actions.resolve();
                          }}
                          createOrder={async (data, actions) => {
                            const orderId = await createInternalOrder();
                            if (!orderId) {
                              throw new Error("Order creation failed");
                            }
                            setOrderId(orderId);
                            return actions.order.create({
                              purchase_units: [
                                {
                                  amount: {
                                    currency_code: "USD",
                                    value: total.toFixed(2),
                                  },
                                  description: `Manufacturing Order ${orderId}`,
                                  custom_id: orderId,
                                },
                              ],
                              intent: "CAPTURE",
                            });
                          }}
                          onApprove={async (data) => {
                            try {
                              setIsProcessing(true);
                              const response = await apiClient.post(
                                `/orders/${orderId}/paypal-capture`,
                                { orderID: data.orderID },
                              );

                              if (response.data.success) {
                                notify.success("Payment successful");
                                setOrderPlaced(true);
                                router.push(`/portal/orders/${orderId}`);
                              } else {
                                notify.error("Payment not completed");
                              }
                            } catch (err) {
                              console.error("Capture error:", err);
                              notify.error("Payment capture failed");
                              await apiClient.post(
                                `/orders/${orderId}/failure`,
                              );
                            } finally {
                              setIsProcessing(false);
                            }
                          }}
                          onCancel={() => {
                            notify.error("Payment cancelled");
                            setIsProcessing(false);
                          }}
                          onError={(err) => {
                            console.error("PayPal error:", err);
                            notify.error("PayPal encountered an error");
                            setIsProcessing(false);
                          }}
                        />
                        <p className="text-[10px] text-slate-400 text-center font-medium">
                          Secure payment processing via PayPal. Your order
                          status will be automatically updated upon
                          confirmation.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        <Footer />

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
                    {selectedAddress?.email}
                  </span>
                </p>

                <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200/60 shadow-inner flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Transmission ID
                    </span>
                    <span className="font-mono text-xl font-bold text-blue-600 uppercase tracking-tight">
                      {Math.random()
                        .toString(36)
                        .substring(2, 10)
                        .toUpperCase()}
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
    </PayPalScriptProvider>
  );
}
