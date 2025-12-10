"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppHeader from "@/layout/AppHeader";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Factory,
  TrendingUp,
  Settings,
  FileText,
  Users,
  Calendar,
  Clipboard,
  MessageSquare,
  Award,
  Palette,
  Key,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { KeyIcon } from "@heroicons/react/24/outline";
import { usePermissions } from "@/components/hooks/use-permissions";
import { PermissionsNames } from "@cnc-quote/shared";
import MegaMenu from "@/components/ui/mega-menu";
import { useMegaMenu } from "@/hooks/use-mega-menu";
import { useActiveMenuSection } from "@/lib/hooks/use-active-menu-section";

interface SupplierLayoutProps {
  readonly children: React.ReactNode;
}

const BASE_PRIMARY_NAV = [
  { label: "Dashboard", route: "/supplier/dashboard", icon: LayoutDashboard },
  { label: "RFQs", route: "/supplier/rfqs", icon: Clipboard },
  { label: "Orders", route: "/supplier/orders", icon: Package },
  { label: "Messages", route: "/supplier/messages", icon: MessageSquare },
  { label: "Capacity", route: "/supplier/capacity", icon: Factory },
  { label: "Certifications", route: "/supplier/certifications", icon: Award },
  { label: "Finishes", route: "/supplier/finishes", icon: Palette },
  { label: "Warehouse", route: "/supplier/warehouse", icon: FileText },
  { label: "Analytics", route: "/supplier/analytics", icon: TrendingUp },
  { label: "Schedule", route: "/supplier/schedule", icon: Calendar },
  { label: "Settings", route: "/supplier/settings", icon: Settings },
];

export default function SupplierLayout({
  children,
}: Readonly<SupplierLayoutProps>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const { isOpen: isMegaMenuOpen, setIsOpen: setIsMegaMenuOpen } =
    useMegaMenu();
  const { hasPermission, isLoading } = usePermissions();
  const filteredNav = useActiveMenuSection();

  // Avoid mutating module-level arrays. Compute nav items per-render and
  // only append the admin/organization item when the user has access.
  const canAccessPermissions = hasPermission(
    PermissionsNames.organizationFullAccess,
  );
  const navItems = useMemo(() => {
    return filteredNav.section?.items || [];
  }, [canAccessPermissions, filteredNav]);

  if (isLoading) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 dark:from-gray-950 dark:via-emerald-950 dark:to-teal-950">
      <aside
        className={cn(
          "bg-white/80 backdrop-blur-xl dark:bg-gray-900/80 border-r border-gray-200/50 dark:border-gray-800/50 flex flex-col fixed top-0 left-0 h-full z-40 transition-all duration-300 shadow-xl",
          "lg:static lg:h-full",
          mobileOpen
            ? "translate-x-0 w-64"
            : "-translate-x-64 w-64 lg:translate-x-0",
          desktopOpen ? "lg:w-64" : "lg:w-0 lg:overflow-hidden",
        )}
      >
        <div className="h-16 flex items-center px-6 font-bold text-lg tracking-tight border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-emerald-600 to-teal-600 whitespace-nowrap">
          <Link
            href="/supplier/dashboard"
            className="text-white flex items-center gap-2"
          >
            <Factory size={24} />
            <span>Frigate Fast Parts</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {/* Mobile: close button inside sidebar header */}
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 transition"
            >
              <X size={16} />
            </button>

            {/* Desktop: collapse / expand the sidebar */}
            <button
              onClick={() => setDesktopOpen((o) => !o)}
              aria-label="Toggle sidebar"
              className="hidden lg:inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 transition"
            >
              {desktopOpen ? (
                <ChevronLeft size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 text-sm scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 invisible-scrollbar">
          {filteredNav.section && (
            <div className="px-6 pb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {filteredNav.section.title}
              </h2>
            </div>
          )}

          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const active =
                pathname === item.route ||
                pathname?.startsWith(item.route + "/");
              const Icon = item.icon;

              return (
                <li key={item.route}>
                  <Link
                    href={item.route}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-2.5 font-medium transition-all duration-200",
                      active
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                        : "text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800/50 hover:shadow-md",
                    )}
                  >
                    <Icon size={18} className="size-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/50">
          <p className="font-semibold">
            &copy; {new Date().getFullYear()} Frigate Fast Parts
          </p>
          <p className="mt-2 space-x-2">
            <Link
              href="/legal/privacy"
              className="hover:text-emerald-600 transition-colors"
            >
              Privacy
            </Link>
            <span>·</span>
            <Link
              href="/legal/terms"
              className="hover:text-emerald-600 transition-colors"
            >
              Terms
            </Link>
          </p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 w-full">
        <AppHeader
          setOpen={() => setDesktopOpen((o) => !o)}
          isMegaMenuOpen={isMegaMenuOpen}
          setIsMegaMenuOpen={setIsMegaMenuOpen}
        />
        <main className="flex-1 overflow-y-auto w-full p-6 md:p-8">
          {children}
        </main>
      </div>

      <button
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed bottom-6 left-6 z-50 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-2xl px-6 py-3 lg:hidden hover:shadow-emerald-500/50 transition-all duration-300 hover:scale-105 font-medium"
      >
        {mobileOpen ? "Close" : "Menu"}
      </button>

      <button
        onClick={() => setDesktopOpen((o) => !o)}
        className="hidden lg:fixed lg:flex bottom-6 left-6 right-auto z-50 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-2xl px-4 py-3 hover:shadow-emerald-500/50 transition-all duration-300 hover:scale-105"
        title="Toggle sidebar"
      >
        {desktopOpen ? "→" : "←"}
      </button>

      <MegaMenu
        isOpen={isMegaMenuOpen}
        onClose={() => setIsMegaMenuOpen(false)}
      />
    </div>
  );
}
