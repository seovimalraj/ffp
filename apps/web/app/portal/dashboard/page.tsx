"use client";

import {
  FileText,
  ArrowRight,
  Rocket,
  MessageSquare,
  RefreshCw,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  Zap,
  CreditCard,
  Box,
} from "lucide-react";
import { StatusCards, StatusItem } from "@/components/ui/status-cards";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DashboardAPI,
  DashboardStats,
  RecentOrder,
  RecentQuote,
  Blog,
} from "@/lib/api/dashboard";
import { toast } from "sonner";
import CustomLoader from "@/components/ui/loader/CustomLoader";
import { useMetaStore } from "@/components/store/title-store";
import { motion, Variants } from "framer-motion";
import { buildUtmLink, cn, UtmMedium } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import StartProductionModal from "./components/StartProductionModal";
import { SocialLinks } from "@cnc-quote/shared";

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 15, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 110,
      damping: 15,
    },
  },
};

export default function CustomerDashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeQuotes: 0,
    openOrders: 0,
    totalSpent: "$0",
    avgLeadTime: "0 days",
  });
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [showProductionModal, setShowProductionModal] = useState(false);

  const { setPageTitle, resetTitle } = useMetaStore();

  useEffect(() => {
    setPageTitle("Home");
    return () => {
      resetTitle();
    };
  }, []);

  // Auto-open production modal when redirected from support page
  useEffect(() => {
    if (searchParams?.get("showProduction") === "true") {
      setShowProductionModal(true);
      // Clean the query param from the URL without a page reload
      const url = new URL(window.location.href);
      url.searchParams.delete("showProduction");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [statsData, quotesData, ordersData, blogsData] =
          await Promise.all([
            DashboardAPI.getStats(),
            DashboardAPI.getRecentQuotes(),
            DashboardAPI.getRecentOrders(),
            DashboardAPI.getBlogs(2),
          ]);

        setStats(statsData);
        setRecentQuotes(quotesData);
        setRecentOrders(ordersData);
        setBlogs(blogsData);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_review: "bg-amber-50 text-amber-700 border-amber-200",
      approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      draft: "bg-slate-50 text-slate-700 border-slate-200",
      in_production: "bg-blue-50 text-blue-700 border-blue-200",
      quality_check: "bg-violet-50 text-violet-700 border-violet-200",
      shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
    return colors[status] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  // Combine quotes and orders for the recent activity table
  const unifiedActivity = [
    ...recentQuotes.map((q) => ({
      id: q.id,
      code: q.rfq_code || q.id,
      type: "Quote",
      date: q.date,
      service: "Analysis Pending",
      parts: q.parts,
      status: q.status,
      href: `/quote-config/${q.id}`,
    })),
    ...recentOrders.map((o) => ({
      id: o.id,
      code: o.order_code || o.id,
      type: "Order",
      date: o.created_at || o.dueDate,
      service: "Manufacturing",
      parts: 1,
      status: o.status,
      href: `/portal/orders/${o.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <CustomLoader />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(" ")[0] || "there";

  const statsItems: StatusItem[] = [
    {
      label: "Active Quotes",
      value: stats.activeQuotes,
      icon: FileText,
      color: "blue",
    },
    {
      label: "Open Orders",
      value: stats.openOrders,
      icon: Box,
      color: "indigo",
    },
    {
      label: "Total Spent",
      value: stats.totalSpent,
      icon: CreditCard,
      color: "emerald",
    },
    {
      label: "Avg. Lead Time",
      value: stats.avgLeadTime,
      icon: Zap,
      color: "amber",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12 p-6 max-w-[1440px] mx-auto pb-24"
    >
      {/* Hello Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-slate-500 text-lg">
            Monitor your manufacturing projects and supply chain in real-time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/support">
            <Button
              variant="outline"
              className="h-11 px-6 rounded-xl border-slate-200 hover:bg-slate-50 shadow-sm text-slate-600 gap-2 font-medium transition-all"
            >
              <HelpCircle size={18} className="text-blue-500 mr-3" />
              Support
            </Button>
          </Link>
        </div>
      </section>

      {/* Stats Overview */}
      <section>
        <StatusCards items={statsItems} />
      </section>

      {/* Main Action Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            title: "Get a new quote",
            description: "Instant pricing for CNC and Sheet Metal.",
            icon: Rocket,
            href: "/instant-quote",
            action: "New Quote",
            color: "blue",
          },
          {
            title: "Production project",
            description:
              "Engage our team for high-volume orders and large-scale manufacturing.",
            icon: MessageSquare,
            href: "/support",
            action: "Start Project",
            color: "indigo",
            onClick: () => setShowProductionModal(true),
          },
          {
            title: "Reorder parts",
            description:
              "Easily reorder previously manufactured parts and access history.",
            icon: RefreshCw,
            href: "/portal/library",
            action: "Find Parts",
            color: "emerald",
          },
        ].map((card, idx) => {
          const content = (
            <div className="group flex flex-col h-full bg-white rounded-3xl p-8 border border-slate-200/60 shadow-sm hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 relative overflow-hidden">
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-colors duration-300",
                  card.color === "blue" &&
                    "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
                  card.color === "indigo" &&
                    "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white",
                  card.color === "emerald" &&
                    "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
                )}
              >
                <card.icon size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {card.title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-grow">
                {card.description}
              </p>

              <div className="flex items-center gap-1 text-xs font-bold text-blue-600 uppercase tracking-wider">
                {card.action} <ChevronRight size={14} />
              </div>

              {/* Decorative background element */}
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 group-hover:-rotate-12 group-hover:scale-110">
                <card.icon size={120} />
              </div>
            </div>
          );

          return (
            <motion.div key={idx} variants={itemVariants}>
              {card.onClick ? (
                <div onClick={card.onClick} className="cursor-pointer h-full">
                  {content}
                </div>
              ) : (
                <Link href={card.href} className="h-full">
                  {content}
                </Link>
              )}
            </motion.div>
          );
        })}
      </section>

      {/* Recent Activity Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
            Recent Activity
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/portal/quotes")}
            className="text-blue-600 font-semibold hover:bg-blue-50 rounded-lg group"
          >
            View All Activity{" "}
            <ArrowRight
              size={14}
              className="ml-2 group-hover:translate-x-1 transition-transform"
            />
          </Button>
        </div>

        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
        >
          <div className="overflow-x-auto text-nowrap">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Last Active
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    ID
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Type
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Service
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    Parts
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unifiedActivity.length > 0 ? (
                  unifiedActivity.map((act, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                      onClick={() => router.push(act.href)}
                    >
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            act.type === "Quote"
                              ? "bg-amber-400"
                              : "bg-blue-400",
                          )}
                        />
                        <span className="text-sm text-slate-600">
                          {act.date}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors uppercase">
                          {act.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider",
                            act.type === "Quote"
                              ? "bg-amber-50 text-amber-600 border border-amber-100"
                              : "bg-blue-50 text-blue-600 border border-blue-100",
                          )}
                        >
                          {act.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500">
                          {act.service}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-slate-700">
                          {act.parts}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border",
                            getStatusColor(act.status),
                          )}
                        >
                          {act.status?.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-400 text-sm"
                    >
                      No recent activity
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* Explore Section */}
      {blogs.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight px-1">
            Explore Manufacturing
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {blogs.map((blog) => (
              <motion.div key={blog.id} variants={itemVariants}>
                <Link
                  href={buildUtmLink(blog.link, UtmMedium.FFP)}
                  target="_blank"
                  className="group relative block aspect-[16/9] sm:aspect-[21/9] lg:aspect-auto lg:h-[320px] bg-black rounded-[2.5rem] overflow-hidden border border-white/10 shadow-sm transition-all duration-500"
                >
                  {/* Background Image */}
                  {blog.image_url && (
                    <img
                      src={blog.image_url}
                      alt={blog.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  )}

                  {/* Bottom Gradient for Title Readability - Always visible for better contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                  {/* Black Glass Overlay - Only on hover */}
                  <div className="absolute inset-0 bg-black/0 backdrop-blur-0 transition-all duration-500 ease-in-out group-hover:bg-black/60 group-hover:backdrop-blur-xl" />

                  {/* Content Overlay - Centered to fill space better */}
                  <div className="absolute inset-0 p-10 flex flex-col justify-center items-start z-10">
                    <div className="max-w-md w-full">
                      {blog.tag && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 delay-75">
                          <Zap size={10} /> {blog.tag}
                        </div>
                      )}

                      <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight leading-[1.2] transition-all duration-500 group-hover:mb-2 text-balance">
                        {blog.title}
                      </h3>

                      <p className="text-slate-300 text-sm leading-relaxed mb-8 line-clamp-2 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-150">
                        {blog.description}
                      </p>

                      <div className="flex items-center gap-4 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-300">
                        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                          <ArrowRight size={20} />
                        </div>
                        <span className="text-xs font-bold text-white uppercase tracking-[0.2em]">
                          Read Article
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Corner Indicator - Liquid glass effect */}
                  <div className="absolute top-8 right-8 w-14 h-14 liquid-glass group-hover:opacity-0 transition-all duration-500">
                    <ArrowRight
                      size={24}
                      className="-rotate-45 text-white/60 relative z-10"
                    />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Helpful Links */}
      <section className="bg-slate-900 rounded-[2.5rem] p-12 text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] -mr-40 -mt-40 transition-colors group-hover:bg-blue-500/20 duration-1000" />

        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">
              Network
            </h4>
            <ul className="space-y-2">
              {[
                {
                  label: "Frigate Network",
                  href: "https://frigate.ai/",
                  icon: ExternalLink,
                },
                {
                  label: "About Frigate",
                  href: "https://frigate.ai/about-frigate/",
                },
              ].map((link, idx) => (
                <li key={idx}>
                  <Link
                    href={link.href}
                    className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
                  >
                    {link.label}{" "}
                    {link.icon && (
                      <link.icon size={12} className="opacity-50" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">
              Resources
            </h4>
            <ul className="space-y-2">
              {[
                { label: "Platform Updates", href: "/updates" },
                {
                  label: "Manufacturing Blog",
                  href: "https://frigate.ai/blogs",
                },
                { label: "Help Center", href: "https://frigate.ai/faqs/" },
              ].map((link, idx) => (
                <li key={idx}>
                  <Link
                    href={link.href}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">
              Legal
            </h4>
            <ul className="space-y-2">
              {[
                {
                  label: "Conditions of Use",
                  href: "https://frigate.ai/policy/terms-and-conditions/",
                },
                {
                  label: "Privacy Policy",
                  href: "https://frigate.ai/policy/privacy-policy/",
                },
              ].map((link, idx) => (
                <li key={idx}>
                  <Link
                    href={link.href}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {/* <div className="space-y-4">
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">
              Compliance
            </h4>
            <ul className="space-y-2">
              {[
                {
                  label: "ISO Certifications",
                  href: "https://frigate.ai/certifications",
                  icon: Clock,
                },
                {
                  label: "Data Protection",
                  href: "https://frigate.ai/security",
                },
                {
                  label: "ITAR & EAR",
                  href: "https://frigate.ai/export-control",
                },
              ].map((link, idx) => (
                <li key={idx}>
                  <Link
                    href={link.href}
                    className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
                  >
                    {link.label}{" "}
                    {link.icon && (
                      <link.icon size={12} className="opacity-50" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div> */}
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest">
            © {new Date().getFullYear()} Frigate Engineering Services. All
            rights reserved.
          </p>
          <div className="flex gap-4">
            {[
              {
                name: "LinkedIn",
                imgUrl: "/logos/linkedinW.png",
                href: SocialLinks.LinkedinFFP,
              },
              {
                name: "YouTube",
                imgUrl: "/logos/ytIW.png",
                href: SocialLinks.YoutubeFFP,
              },
              {
                name: "X",
                imgUrl: "/logos/xW.png",
                href: SocialLinks.XFFP,
              },
            ].map((social, idx) => (
              <Link
                key={idx}
                href={social.href}
                className="group flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all duration-300"
                aria-label={social.name}
              >
                <img
                  src={social.imgUrl}
                  alt={social.name}
                  className="h-4 w-auto object-contain opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <StartProductionModal
        isOpen={showProductionModal}
        onClose={() => setShowProductionModal(false)}
      />
    </motion.div>
  );
}
