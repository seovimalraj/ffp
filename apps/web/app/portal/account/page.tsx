"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { DashboardAPI, DashboardStats } from "@/lib/api/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Building2,
  MapPin,
  Users,
  Key,
  Bell,
  FileText,
  ShieldCheck,
  ChevronRight,
  Settings2,
  Package,
  TrendingUp,
  Clock,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics/posthog";
import { useMetaStore } from "@/components/store/title-store";
import { Button } from "@/components/ui/button";

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [organization, setOrganization] = useState<any | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const { setPageTitle, resetTitle } = useMetaStore();

  useEffect(() => {
    setPageTitle("Account Overview");
    return () => resetTitle();
  }, [setPageTitle, resetTitle]);

  const loadAccountData = useCallback(async () => {
    try {
      setLoading(true);

      const [profileRes, orgRes, statsRes] = await Promise.all([
        api.get("/auth/profile"),
        api.get("/org/current"),
        DashboardAPI.getStats().catch(() => null),
      ]);

      setProfile(profileRes.data);
      setOrganization(orgRes.data);
      if (statsRes) setStats(statsRes);

      trackEvent("account_overview_view", {
        has_profile: !!profileRes.data,
        has_org: !!orgRes.data,
      });
    } catch (error: any) {
      console.error("Error loading account data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  const navTiles = [
    {
      title: "Profile Settings",
      description:
        "Manage your personal information, contact details, and account preferences.",
      icon: User,
      href: "/portal/account/profile",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Organization",
      description:
        "Manage your company profile, industry details, and organizational settings.",
      icon: Building2,
      href: "/portal/account/organization",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Team Management",
      description:
        "Invite your colleagues, manage roles, and control team permissions.",
      icon: Users,
      href: "/portal/account/team",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Shipping Addresses",
      description:
        "Add and manage delivery locations for your orders and quotes.",
      icon: MapPin,
      href: "/portal/account/shipping",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "API Access",
      description:
        "Securely manage API tokens for third-party integrations and webhooks.",
      icon: Key,
      href: "/portal/account/api-tokens",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
    {
      title: "Documents & Templates",
      description: "Access your custom order templates and account documents.",
      icon: FileText,
      href: "/portal/account/templates",
      color: "text-rose-600",
      bgColor: "bg-rose-50",
    },
    {
      title: "Notifications",
      description:
        "Customize how you receive updates about your quotes and orders.",
      icon: Bell,
      href: "/portal/account/notifications",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8 animate-pulse">
          <div>
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl font-sans">
      {/* Hero Section */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Account Overview
        </h1>
        <p className="text-slate-500 mt-2 text-lg font-medium">
          Central hub for managing your personal profile, organization, and
          preferences.
        </p>
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Active Quotes Stats */}
        <Card className="border-none shadow-sm bg-blue-600 text-white overflow-hidden relative group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-blue-100 text-sm font-semibold uppercase tracking-wider">
                  Active Quotes
                </p>
                <h3 className="text-4xl font-black mt-1">
                  {stats?.activeQuotes || 0}
                </h3>
              </div>
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-blue-100 text-xs font-semibold relative z-10">
              <Clock className="h-3 w-3 mr-1" />
              <span>Live Tracking</span>
            </div>
            {/* Decorative background circle */}
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
          </CardContent>
        </Card>

        {/* Open Orders Stats */}
        <Card className="border-none shadow-sm bg-slate-900 text-white overflow-hidden relative group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                  Open Orders
                </p>
                <h3 className="text-4xl font-black mt-1">
                  {stats?.openOrders || 0}
                </h3>
              </div>
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                <Package className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-slate-400 text-xs font-semibold relative z-10">
              <Clock className="h-3 w-3 mr-1" />
              <span>Current Projects</span>
            </div>
            {/* Decorative background circle */}
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
          </CardContent>
        </Card>

        {/* User Profile Card */}
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden hover:border-blue-200 transition-all">
          <CardContent className="p-6">
            <div className="flex flex-col h-full justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-2xl overflow-hidden shadow-inner">
                  {profile?.name?.[0] || "U"}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 truncate text-lg tracking-tight">
                    {profile?.name || "User Name"}
                  </h3>
                  <p className="text-sm font-bold text-blue-600 truncate">
                    {organization?.name || "Individual"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Link href="/portal/account/profile" className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-bold h-9 rounded-lg"
                  >
                    <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Profile
                  </Button>
                </Link>
                <Link href="/portal/account/organization" className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-bold h-9 rounded-lg"
                  >
                    <Building2 className="h-3.5 w-3.5 mr-1.5" /> Org
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Section Header */}
      <div className="flex items-center space-x-4 mb-8">
        <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
          Account Management
        </span>
        <div className="h-px bg-slate-200 w-full" />
      </div>

      {/* Navigation Hub Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {navTiles.map((tile) => (
          <Link key={tile.title} href={tile.href} className="group flex">
            <Card className="flex-1 flex flex-col border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 hover:translate-y-[-4px] transition-all duration-300 relative overflow-hidden group">
              <CardContent className="p-7 relative z-10 h-full flex flex-col text-left">
                <div
                  className={`w-14 h-14 rounded-2xl ${tile.bgColor} ${tile.color} flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 shadow-inner group-hover:shadow-blue-100`}
                >
                  <tile.icon className="h-7 w-7 transition-all duration-500 group-hover:rotate-12" />
                </div>

                <h3 className="font-black text-slate-900 text-xl mb-3 flex items-center tracking-tight">
                  {tile.title}
                  <ChevronRight className="h-5 w-5 ml-auto opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-blue-600" />
                </h3>

                <p className="text-[15px] text-slate-500 leading-relaxed font-semibold">
                  {tile.description}
                </p>

                <div className="mt-auto pt-8 flex items-center text-sm font-black text-blue-600 opacity-60 group-hover:opacity-100 transition-all duration-300">
                  Configure Section{" "}
                  <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>

              {/* Glassmorphism decorative element */}
              <div
                className={`absolute -right-8 -bottom-8 w-32 h-32 ${tile.bgColor} rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-700 blur-3xl`}
              />
            </Card>
          </Link>
        ))}
      </div>

      {/* Support Section */}
      <div className="mt-20 bg-gradient-to-r from-slate-950 to-slate-900 rounded-[2.5rem] p-10 text-white flex flex-col lg:flex-row items-center justify-between gap-10 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 bg-white/10 rounded-3xl backdrop-blur-xl flex items-center justify-center flex-shrink-0 animate-pulse-slow">
            <ShieldCheck className="h-10 w-10 text-blue-400" />
          </div>
          <div className="text-center md:text-left">
            <h4 className="text-2xl font-black tracking-tight">
              Need Account Assistance?
            </h4>
            <p className="text-slate-400 text-lg mt-1 font-medium max-w-lg">
              Our dedicated support team is available 24/7 for security,
              billing, and account help.
            </p>
          </div>
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <Button className="w-full sm:w-auto h-14 px-10 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black shadow-lg shadow-blue-900/40 text-base">
            Contact Support
          </Button>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
      </div>
    </div>
  );
}
