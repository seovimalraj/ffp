"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut, signIn } from "next-auth/react";
import { api } from "@/lib/api";
import CustomLoader from "@/components/ui/loader/CustomLoader";
import {
  User,
  LogOut,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  HelpCircle,
  ClipboardList,
} from "lucide-react";
import Logo from "@/components/ui/logo";
import Footer from "@/components/ui/footer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import TechnicalSupportModal from "../quote-config/components/technical-support-modal";
import { useMetaStore } from "@/components/store/title-store";
import { useRouter as useNextRouter } from "next/navigation";

const contactMethods = (
  setSupportOpen: (open: boolean) => void,
  onBookProduction: () => void,
) => [
  {
    image: "/support/email.webp",
    title: "Email Support",
    description:
      "Get in touch with our team for general inquiries and order updates.",
    value: "support@frigate.ai",
    icon: Mail,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    onClick: () => {
      window.location.href = "mailto:support@frigate.ai";
    },
  },
  {
    image: "/support/phone.webp",
    title: "Phone Support",
    description:
      "Speak directly with our support specialists for immediate assistance.",
    value: "+91 97890 22345",
    icon: Phone,
    color: "text-green-600",
    bgColor: "bg-green-50",
    onClick: () => {
      window.location.href = "tel:+919789022345";
    },
  },
  {
    image: "/support/book-a-call.webp",
    title: "Book a Call",
    description:
      "Arrange a dedicated session to discuss your project requirements.",
    value: "Schedule Consultation",
    icon: Calendar,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    onClick: () =>
      window?.open("https://frigate.ai/book-a-call/", "_blank")?.focus(),
  },
  {
    image: "/support/technical-support.webp",
    title: "Technical Support",
    description:
      "Expert guidance on CNC machining, sheet metal, and DFM optimization.",
    value: "DFM & Geometry Help",
    icon: ShieldCheck,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    onClick: () => {
      setSupportOpen(true);
    },
  },
  {
    image: "/support/faq.webp",
    title: "Help Center",
    description: "Browse through our comprehensive library of guides and FAQs.",
    value: "Search Knowledge Base",
    icon: HelpCircle,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    onClick: () => {},
  },
  {
    image: "/support/production-order.webp",
    title: "Book Production Order",
    description:
      "Ready to manufacture? Book a production order and we'll get your parts into production.",
    value: "Book Production Order",
    icon: ClipboardList,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    onClick: onBookProduction,
  },
];

const SupportPage = () => {
  const session = useSession();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [methods, setMethods] = useState(contactMethods(() => {}, () => {}));
  const [isLoading, setIsLoading] = useState(true);
  const { setRedirectUrl } = useMetaStore();
  const router = useNextRouter();

  const handleBookProduction = () => {
    const PRODUCTION_REDIRECT = "/portal/dashboard?showProduction=true";
    if (session.status === "authenticated") {
      router.push(PRODUCTION_REDIRECT);
    } else {
      setRedirectUrl(PRODUCTION_REDIRECT);
      router.push("/signin?intent=production-order");
    }
  };

  useEffect(() => {
    const fetchSupportContacts = async () => {
      try {
        const response = await api.get("/system", {
          params: { keys: ["support_email", "support_phone"] },
        });

        if (response.data.success && response.data.configData) {
          const configData = response.data.configData;
          const emailConfig = configData.find(
            (c: any) => c.key === "support_email",
          );
          const phoneConfig = configData.find(
            (c: any) => c.key === "support_phone",
          );

          setMethods((prevMethods) => {
            return prevMethods.map((method) => {
              if (method.title === "Email Support" && emailConfig) {
                return {
                  ...method,
                  value: emailConfig.value,
                  onClick: () =>
                    (window.location.href = `mailto:${emailConfig.value}`),
                };
              }
              if (method.title === "Phone Support" && phoneConfig) {
                return {
                  ...method,
                  value: formatPhoneNumberIntl(phoneConfig.value),
                  onClick: () =>
                    (window.location.href = `tel:${phoneConfig.value}`),
                };
              }
              return method;
            });
          });
        }
      } catch (error) {
        console.error("Failed to fetch support contacts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    setMethods(contactMethods(setIsSupportOpen, handleBookProduction));
    fetchSupportContacts();
  }, []);

  if (isLoading) {
    return <CustomLoader fullScreen />;
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 font-sans selection:bg-blue-100">
        {/* Header - Same as instant-quote */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-blue-50 h-16 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-16 px-3 rounded flex items-center justify-center">
                <Logo classNames="aspect-video w-full h-full object-contain" />
              </div>
            </Link>

            {session.status === "authenticated" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="font-medium text-sm transition-all duration-300 text-slate-700 hover:bg-slate-100"
                  >
                    <User className="w-4 h-4 mr-2" />
                    {session.data.user.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.data.user.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session.data.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="text-red-600 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                onClick={() => signIn()}
                className="font-medium text-sm transition-all duration-300 text-blue-700 hover:text-blue-800 hover:bg-blue-50"
              >
                Sign In
              </Button>
            )}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Hero Section */}
          <section className="text-center mb-20">
            <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
              How can we{" "}
              <span className="text-blue-600 font-normal">help you?</span>
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto font-light animate-in fade-in slide-in-from-top-6 duration-700">
              Our team of manufacturing experts is here to assist you with
              quotes, technical DFM feedback, and order management.
            </p>
          </section>

          {/* Contact Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {methods.map((method, index) => (
              <div
                key={index}
                className="group bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex flex-col items-center text-center animate-in fade-in zoom-in-95"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Image Container */}
                <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden mb-6 bg-slate-50 relative shadow-inner">
                  <img
                    src={method.image}
                    alt={method.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  {/* <div
                  className={`absolute top-4 right-4 p-2.5 rounded-xl backdrop-blur-md bg-white/90 shadow-sm ${method.color}`}
                >
                  <method.icon className="w-5 h-5" />
                </div> */}
                </div>

                {/* Content */}
                <div className="space-y-2 flex-grow">
                  <h3 className="text-xl font-semibold text-slate-800">
                    {method.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {method.description}
                  </p>
                  <Button
                    onClick={() => method.onClick()}
                    variant="blueCta"
                    className="mt-4 w-full h-12 rounded-2xl"
                  >
                    {method.value}
                  </Button>
                </div>
              </div>
            ))}
          </section>

          {/* CTA Section */}
          <section className="mb-24 bg-[#0B0F1A] rounded-[40px] p-8 md:p-16 text-white relative overflow-hidden group shadow-2xl border border-slate-900/50 selection:bg-blue-500/30">
            {/* Glowing Blobs */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/[0.12] rounded-full blur-[140px] -mr-48 -mt-48 transition-all duration-700 group-hover:bg-blue-500/[0.18]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/[0.08] rounded-full blur-[100px] -ml-24 -mb-24" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="max-w-xl text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium mb-6 border border-blue-500/20 shadow-lg shadow-blue-500/5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Technical DFM Support
                </div>
                <h2 className="text-3xl md:text-4xl font-light mb-4">
                  Need optimization help?
                </h2>
                <p className="text-slate-400 font-light text-lg leading-relaxed">
                  Our technical support team can help you optimize your parts
                  for manufacturing and reduce costs through detailed DFM
                  analysis before you place an order.
                </p>
              </div>
              <Button
                size="lg"
                onClick={() =>
                  window
                    ?.open("https://frigate.ai/book-a-call/", "_blank")
                    ?.focus()
                }
                className="bg-white text-slate-900 hover:bg-blue-50 px-10 py-7 text-lg rounded-2xl shadow-xl shadow-white/5 transition-all hover:scale-105 active:scale-95 group/live border-0"
              >
                Book a Call
                <div className="ml-3 w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              </Button>
            </div>
          </section>
        </main>
      </div>
      <TechnicalSupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />
      <Footer />
    </>
  );
};

export default SupportPage;
