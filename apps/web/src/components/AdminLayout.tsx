"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppHeader from "@/layout/AppHeader";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Users,
  Building2,
  TruckIcon,
  BarChart3,
  FileCheck,
  Package,
  Settings,
  Database,
  Factory,
  Gauge,
  Palette,
  DollarSign,
  Award,
  Shield,
  UsersRound,
  Key,
  Webhook,
  Clipboard,
  MessageSquare,
  Target,
  ChevronLeft,
  Menu,
  LogOut,
} from "lucide-react";
import { Button } from "./ui/button";
import { signOut } from "next-auth/react";

interface AdminLayoutProps {
  readonly children: React.ReactNode;
}

const navigationGroups = [
  {
    name: "Main",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Quotes", href: "/admin/quotes", icon: FileText },
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
      { label: "RFQs & Bids", href: "/admin/rfqs", icon: Clipboard },
      { label: "Messages", href: "/admin/messages", icon: MessageSquare },
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Organizations", href: "/admin/organizations", icon: Building2 },
      { label: "Suppliers", href: "/admin/suppliers", icon: TruckIcon },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Invoices", href: "/admin/invoices", icon: FileCheck },
      { label: "Shipments", href: "/admin/shipments", icon: Package },
    ],
  },
  {
    name: "Catalog",
    items: [
      { label: "Materials", href: "/admin/catalog/materials", icon: Database },
      { label: "Tolerances", href: "/admin/tolerance", icon: Target },
      { label: "Machines", href: "/admin/machines", icon: Factory },
      { label: "Capacity", href: "/admin/capacity", icon: Gauge },
      { label: "Finishes", href: "/admin/catalog/finishes", icon: Palette },
      { label: "Pricing Engine", href: "/admin/pricing", icon: DollarSign },
      {
        label: "Certifications",
        href: "/admin/catalog/certifications",
        icon: Award,
      },
    ],
  },
  {
    name: "Settings",
    items: [
      {
        label: "Organization",
        href: "/admin/settings/organization",
        icon: Shield,
      },
      { label: "Team", href: "/admin/settings/team", icon: UsersRound },
      { label: "API Keys", href: "/admin/settings/api-keys", icon: Key },
      { label: "Webhooks", href: "/admin/settings/webhooks", icon: Webhook },
    ],
  },
];

export default function AdminLayout({ children }: Readonly<AdminLayoutProps>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-950 dark:via-slate-950 dark:to-gray-900">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white/80 backdrop-blur-xl dark:bg-gray-900/80 border-r border-gray-200/50 dark:border-gray-800/50 flex flex-col fixed top-0 left-0 h-full z-40 transition-all duration-300 shadow-xl",
          "lg:static lg:h-full",
          mobileOpen
            ? "translate-x-0 w-64"
            : "-translate-x-64 w-64 lg:translate-x-0",
          desktopOpen ? "lg:w-64" : "lg:w-[72px]",
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 font-bold text-lg tracking-tight border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-slate-700 to-gray-800 text-white shadow-lg">
          <div
            className={cn(
              "flex items-center gap-2 transition-all duration-300 overflow-hidden whitespace-nowrap",
              desktopOpen ? "opacity-100 w-auto" : "lg:opacity-0 lg:w-0",
            )}
          >
            <Settings size={24} className="animate-pulse flex-shrink-0" />
            <span>Admin Panel</span>
          </div>

          <button
            onClick={() => setDesktopOpen((o) => !o)}
            className={cn(
              "hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-all duration-200",
              !desktopOpen && "mx-auto",
            )}
            title={desktopOpen ? "Collapse" : "Expand"}
          >
            <ChevronLeft
              className={cn(
                "w-5 h-5 transition-transform duration-300",
                !desktopOpen && "rotate-180",
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 text-sm scrollbar-thin invisible-scrollbar scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
          {navigationGroups.map((group, idx) => (
            <div key={idx} className="mb-6">
              {desktopOpen && (
                <h3 className="px-6 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden">
                  {group.name}
                </h3>
              )}
              <ul className="space-y-1 px-3">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (pathname?.startsWith(item.href + "/") &&
                      item.href !== "/admin") ||
                    (item.href === "/admin" && pathname === "/admin");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-2.5 font-medium transition-all duration-200 group relative",
                          active
                            ? "bg-gradient-to-r from-slate-700 to-gray-800 text-white shadow-lg shadow-slate-500/30"
                            : "text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800/50 hover:shadow-md",
                          !desktopOpen && "lg:justify-center lg:px-2",
                        )}
                        title={!desktopOpen ? item.label : undefined}
                      >
                        <Icon
                          size={18}
                          className={cn("flex-shrink-0", !desktopOpen && "")}
                        />
                        <span
                          className={cn(
                            "transition-all duration-300 whitespace-nowrap overflow-hidden",
                            desktopOpen
                              ? "opacity-100 max-w-[200px]"
                              : "lg:opacity-0 lg:max-w-0 font-normal hidden lg:block",
                          )}
                        >
                          {item.label}
                        </span>
                        {/* Mobile label logic if needed, but 'lg:hidden' spans usually work naturally.
                            Actually, 'hidden lg:block' on the span might be too aggressive if we want it on mobile.
                            CustomerLayout uses 'lg:opacity-0 lg:max-w-0' which animates it out. */}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/50">
          <div
            className={cn(
              "flex items-center gap-2",
              desktopOpen ? "justify-between" : "flex-col justify-center",
            )}
          >
            {desktopOpen ? (
              <>
                <div className="flex flex-col gap-2 w-full">
                  <Button
                    onClick={() => signOut()}
                    variant="outline"
                    className="w-full justify-start gap-2 border-gray-200 dark:border-gray-700"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </Button>
                  <div className="flex items-center justify-between px-1">
                    <Link
                      href="/legal/privacy"
                      className="hover:text-slate-700 transition-colors"
                    >
                      Privacy
                    </Link>
                    <span>·</span>
                    <Link
                      href="/legal/terms"
                      className="hover:text-slate-700 transition-colors"
                    >
                      Terms
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <Button
                onClick={() => signOut()}
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-gray-500 hover:text-gray-900"
                title="Logout"
              >
                <LogOut size={20} />
              </Button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <AppHeader setOpen={() => setDesktopOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>

      {/* Mobile Toggle */}
      <button
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex lg:hidden items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-white shadow-lg border border-slate-700 hover:bg-slate-700 transition-all active:scale-95"
      >
        {mobileOpen ? <ChevronLeft /> : <Menu />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-30 lg:hidden transition-all duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
