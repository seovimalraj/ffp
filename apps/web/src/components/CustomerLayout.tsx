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
  User,
  Zap,
  Menu,
  ChevronLeft,
  Library,
} from "lucide-react";
import Logo from "@/components/ui/logo";
import UserDropdown from "@/components/Header/UserDropdown";
import NotificationDropdown from "@/components/Header/NotificationDropdown";

interface CustomerLayoutProps {
  readonly children: React.ReactNode;
}

const primaryNav = [
  { label: "Dashboard", href: "/portal/dashboard", icon: LayoutDashboard },
  { label: "Quotes", href: "/portal/quotes", icon: FileText },
  { label: "Orders", href: "/portal/orders", icon: ShoppingCart },
  { label: "Account", href: "/portal/account", icon: User },
  {
    label: "Part Library",
    href: "/portal/library",
    icon: Library,
  },
  {
    label: "Instant Quote",
    href: "/instant-quote",
    icon: Zap,
  },
];

// const secondaryNav = [

// ];

export default function CustomerLayout({
  children,
}: Readonly<CustomerLayoutProps>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white border-r border-slate-200 flex flex-col fixed top-0 left-0 h-full z-40 transition-all duration-300 ease-in-out shadow-[1px_0_10px_rgba(0,0,0,0.02)]",
          "lg:static lg:h-full",
          mobileOpen
            ? "translate-x-0 w-64"
            : "-translate-x-64 w-64 lg:translate-x-0",
          desktopOpen ? "lg:w-64" : "lg:w-[72px]",
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-50">
          <Link
            href="/portal/dashboard"
            className={cn(
              "flex items-center gap-2 transition-all duration-300 overflow-hidden",
              desktopOpen ? "opacity-100 w-auto" : "lg:opacity-0 lg:w-0",
            )}
          >
            <div className="h-10 w-auto flex-shrink-0">
              <Logo classNames="h-full w-auto object-contain" />
            </div>
          </Link>

          <button
            onClick={() => setDesktopOpen((o) => !o)}
            className={cn(
              "hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all duration-200",
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

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 scrollbar-hide">
          {/* Main Nav Group */}
          <div>
            <nav className="space-y-1">
              {primaryNav.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname?.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200 group relative",
                      active
                        ? "bg-blue-50/50 text-blue-600 shadow-[0_1px_2px_rgba(59,130,246,0.05)]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                      !desktopOpen && "lg:justify-center lg:px-0",
                    )}
                    title={!desktopOpen ? item.label : undefined}
                  >
                    <Icon
                      size={20}
                      className={cn(
                        "flex-shrink-0 transition-colors",
                        active
                          ? "text-blue-600"
                          : "text-slate-400 group-hover:text-slate-600",
                      )}
                    />
                    <span
                      className={cn(
                        "transition-all duration-300 whitespace-nowrap overflow-hidden text-ellipsis",
                        desktopOpen
                          ? "opacity-100 max-w-[200px]"
                          : "lg:opacity-0 lg:max-w-0 font-normal",
                      )}
                    >
                      {item.label}
                    </span>
                    {active && desktopOpen && (
                      <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Action Group */}
          {/* <div>
            {desktopOpen && (
              <p className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Actions
              </p>
            )}
            <nav className="space-y-1">
              {secondaryNav.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200 group relative",
                      item.highlight
                        ? "bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-200"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                      !desktopOpen && "lg:justify-center lg:px-0",
                    )}
                    title={!desktopOpen ? item.label : undefined}
                  >
                    <Icon
                      size={20}
                      className={cn(
                        "flex-shrink-0",
                        item.highlight ? "text-blue-400" : "text-slate-400",
                      )}
                    />
                    <span
                      className={cn(
                        "transition-all duration-300 whitespace-nowrap overflow-hidden text-ellipsis",
                        desktopOpen
                          ? "opacity-100 max-w-[200px]"
                          : "lg:opacity-0 lg:max-w-0",
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div> */}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 mt-auto border-t border-slate-50 bg-slate-50/30">
          <div
            className={cn(
              "flex items-center gap-2",
              desktopOpen ? "justify-between" : "flex-col justify-center",
            )}
          >
            <div className="flex items-center gap-2">
              <UserDropdown />
              {desktopOpen && (
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold text-slate-900 truncate">
                    My Account
                  </span>
                  <span className="text-[11px] text-slate-500 truncate">
                    Settings & Profile
                  </span>
                </div>
              )}
            </div>
            <NotificationDropdown />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 w-full overflow-hidden">
        <AppHeader setOpen={() => setDesktopOpen((o) => !o)} />

        <main className="flex-1 overflow-y-auto scroll-smooth bg-[#F8FAFC]">
          <div className="max-w-[1600px] mx-auto p-4 lg:p-8">{children}</div>
        </main>
      </div>

      {/* Mobile Toggle */}
      <button
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex lg:hidden items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
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
