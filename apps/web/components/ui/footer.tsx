"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/ui/logo";
import { Shield, ChevronRight, Mail, Phone } from "lucide-react";
import { SocialLinks } from "@cnc-quote/shared";
import { api } from "@/lib/api";
import { formatPhoneNumberIntl } from "react-phone-number-input";

const services = [
  {
    label: "Heavy Engineering",
    href: "https://frigate.co.in/",
  },
  {
    label: "Casting",
    href: "https://frigate.ai/capabilities/casting-services/",
  },
  {
    label: "CNC Machining",
    href: "https://frigate.ai/capabilities/cnc-machining-services/",
  },
  {
    label: "Sheet Metal Fabrication",
    href: "https://frigate.ai/capabilities/sheet-metal-fabrication-services/",
  },
  {
    label: "Forging",
    href: "https://frigate.ai/capabilities/forging-services/",
  },
  {
    label: "Injection Molding",
    href: "https://frigate.ai/capabilities/injection-molding-services/",
  },
  {
    label: "Stamping",
    href: "https://frigate.ai/capabilities/stamping-services/",
  },
];

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [contactInfo, setContactInfo] = useState({
    email: "manufacture@frigate.ai",
    phone: "+91 96778 64606",
    show_inhouse_footer: false,
    isLoading: true,
  });

  useEffect(() => {
    const fetchSupportContacts = async () => {
      try {
        const response = await api.get("/system", {
          params: {
            keys: ["support_email", "support_phone", "show_inhouse_footer"],
          },
        });

        if (response.data.success && response.data.configData) {
          const configData = response.data.configData;
          const emailConfig = configData.find(
            (c: any) => c.key === "support_email",
          );
          const phoneConfig = configData.find(
            (c: any) => c.key === "support_phone",
          );
          const inhouseConfig = configData.find(
            (c: any) => c.key === "show_inhouse_footer",
          );

          console.log(inhouseConfig);

          setContactInfo({
            email: emailConfig?.value || "support@frigate.ai",
            phone: phoneConfig
              ? formatPhoneNumberIntl(phoneConfig.value)
              : "+91 97890 22345",
            show_inhouse_footer: Boolean(inhouseConfig?.value),
            isLoading: false,
          });
        }
      } catch (error) {
        console.error("Failed to fetch footer support contacts:", error);
        setContactInfo((prev) => ({ ...prev, isLoading: false }));
      }
    };

    fetchSupportContacts();
  }, []);

  const quickLinks = [
    { label: "About Us", href: "https://frigate.ai/about-frigate/" },
    { label: "Locations", href: "https://frigate.ai/locations/" },
    { label: "Instant Quote", href: "/instant-quote" },
    { label: "Technical Support", href: "/support" },
  ];

  console.log(contactInfo);

  return (
    <footer className="relative bg-white border-t border-slate-100 overflow-hidden font-sans">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-50/50 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-50/30 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-12">
          {/* Brand Column - Span 4 */}
          <div className="lg:col-span-4 space-y-8">
            <Link
              href="/"
              className="inline-block transition-all duration-300 hover:scale-105"
            >
              <Logo classNames="h-10 w-auto object-contain" />
            </Link>
            <p className="max-w-sm text-slate-500 font-light leading-relaxed text-[14px]">
              Frigate Fast Parts is an instant quote platform for CNC Machining
              and Sheet Metal Fabrication that delivers transparent pricing and
              fast turnaround, simplifying the manufacturing procurement
              process.
            </p>

            {/* Social Links */}
            <div className="space-y-4">
              <h5 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                Connect with us
              </h5>
              <div className="flex items-center gap-4">
                <a
                  href={SocialLinks.LinkedinFFP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center transition-all duration-300 group shadow-sm hover:shadow-blue-200"
                >
                  <img
                    src="/logos/linkedin.png"
                    alt="LinkedIn"
                    className="w-6 h-6"
                  />
                </a>
                <a
                  href={SocialLinks.YoutubeFFP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center transition-all duration-300 group shadow-sm hover:shadow-red-200"
                >
                  <img src="/logos/ytI.png" alt="YouTube" className="w-7 h-7" />
                </a>
                <a
                  href={SocialLinks.XFFP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center  transition-all duration-300 group shadow-sm hover:shadow-slate-300"
                >
                  <img src="/logos/xB.png" alt="X" className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Services Section - Span 4 (split in two columns) */}
          <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <h4 className="text-slate-900 font-bold text-xs tracking-[0.2em] uppercase">
                Services
              </h4>
              <ul className="grid grid-cols-1 gap-y-3">
                {services.slice(0, 4).map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      target="_blank"
                      className="text-slate-500 hover:text-blue-600 transition-all duration-300 flex items-center group text-[13px] font-light"
                    >
                      <span className="relative overflow-hidden inline-flex items-center">
                        <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300 mr-1 text-blue-600" />
                        {link.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-5 lg:pt-8">
              <ul className="grid grid-cols-1 gap-y-3">
                {services.slice(4).map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      target="_blank"
                      className="text-slate-500 hover:text-blue-600 transition-all duration-300 flex items-center group text-[13px] font-light"
                    >
                      <span className="relative overflow-hidden inline-flex items-center">
                        <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300 mr-1 text-blue-600" />
                        {link.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Resources Column - Span 2 */}
          <div className="lg:col-span-2 space-y-5">
            <h4 className="text-slate-900 font-bold text-xs tracking-[0.2em] uppercase">
              Resources
            </h4>
            <ul className="grid grid-cols-1 gap-y-3">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : "_self"}
                    className="text-slate-500 hover:text-blue-600 transition-all duration-300 flex items-center group text-[13px] font-light"
                  >
                    <span className="relative overflow-hidden inline-flex items-center">
                      <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300 mr-1 text-blue-600" />
                      {link.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Column - Span 2 */}
          <div className="lg:col-span-2 space-y-5">
            <h4 className="text-slate-900 font-bold text-xs tracking-[0.2em] uppercase">
              Support
            </h4>
            <ul className="space-y-4">
              <li className="group cursor-pointer">
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="flex items-start gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-50/50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 text-blue-600 shadow-sm border border-blue-100/30">
                    <Mail className="w-3 h-3" />
                  </div>
                  <div className="space-y-0">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      Email
                    </p>
                    {contactInfo.isLoading ? (
                      <div className="h-4 w-24 bg-slate-100 animate-pulse rounded mt-1" />
                    ) : (
                      <p className="text-[12px] text-slate-600 font-normal truncate max-w-[150px]">
                        {contactInfo.email}
                      </p>
                    )}
                  </div>
                </a>
              </li>
              <li className="group cursor-pointer">
                <a
                  href={`tel:${contactInfo.phone.replace(/\s+/g, "")}`}
                  className="flex items-start gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-50/50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 text-emerald-600 shadow-sm border border-emerald-100/30">
                    <Phone className="w-3 h-3" />
                  </div>
                  <div className="space-y-0">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      Sales
                    </p>
                    {contactInfo.isLoading ? (
                      <div className="h-4 w-28 bg-slate-100 animate-pulse rounded mt-1" />
                    ) : (
                      <p className="text-[12px] text-slate-600 font-normal">
                        {contactInfo.phone}
                      </p>
                    )}
                  </div>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Simplified Dark Bottom Bar */}
      {/* Premium Dark Bottom Bar with Glow Blobs */}
      <div className="bg-[#0B0F1A] py-6 relative z-10 border-t border-slate-900/50 overflow-hidden">
        {/* Decorative Glow Blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/[0.05] rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/[0.03] rounded-full blur-[60px] -ml-24 -mb-24 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <p className="text-[11px] text-slate-500 font-medium tracking-wide">
                © {currentYear} Frigate Engineering Services Pvt Ltd.
              </p>
              <div className="flex items-center gap-6">
                <Link
                  href="#"
                  className="text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="#"
                  className="text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  Terms of Use
                </Link>
              </div>
            </div>

            {/* Compact Branding Badge */}
            {contactInfo.show_inhouse_footer && (
              <div className="flex flex-col items-center lg:items-end gap-1.5 px-8 md:px-12 py-2 border-x border-slate-800/30 md:border-y-0 relative group">
                <span className="text-[9px] text-slate-600 font-extrabold uppercase tracking-[0.4em] mb-1 group-hover:text-blue-500 transition-colors duration-500">
                  Developed by
                </span>
                <img
                  src="https://frigate.ai/wp-content/uploads/2024/03/frigate_whitelogo.svg"
                  alt="Frigate Engineering Services"
                  className="h-6 w-auto mx-auto opacity-80 brightness-110 transition-all group-hover:opacity-100 group-hover:scale-105"
                />
              </div>
            )}

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 group cursor-default">
                <Shield className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-500 transition-colors" />
                <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors tracking-widest uppercase">
                  Secure Data
                </span>
              </div>
              <div className="text-[10px] text-slate-600 font-bold tracking-widest uppercase border border-slate-800/80 hover:border-blue-500/50 px-3 py-1.5 rounded-[10px] transition-colors">
                NDA PROTECTED
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Bottom Accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-200/40 to-transparent" />

      <style jsx>{`
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 8s ease infinite;
        }
      `}</style>
    </footer>
  );
};

export default Footer;
