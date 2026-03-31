"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AppHeader from "@/layout/AppHeader";
import { cn } from "@/lib/utils";
import { adminMenuSections } from "@/lib/menu-data";
import { ChevronLeft, X, LogOut, Menu, Search } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Logo from "@/components/ui/logo";
import UserDropdown from "@/components/Header/UserDropdown";
import NotificationDropdown from "@/components/Header/NotificationDropdown";
import MegaMenu from "@/components/ui/mega-menu";
import { useMegaMenu } from "@/hooks/use-mega-menu";

interface AdminLayoutProps {
  readonly children: React.ReactNode;
}

export default function AdminLayout({ children }: Readonly<AdminLayoutProps>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const { data: session, status } = useSession();
  const { isOpen: isMegaMenuOpen, setIsOpen: setIsMegaMenuOpen } =
    useMegaMenu();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/signin");
      return;
    }
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push(`/${session?.user?.role}`);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle MegaMenu on '/' key if not in an input
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setIsMegaMenuOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session, status, router, setIsMegaMenuOpen]);

  // Block render until session is resolved
  if (status === "loading") {
    return null;
  }

  // Never render children if check would redirect
  if (status !== "authenticated" || session?.user?.role !== "admin") {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-gray-50 via-zinc-50 to-slate-50 dark:from-gray-950 dark:via-zinc-950 dark:to-gray-900">
      <aside
        className={cn(
          "bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed top-0 left-0 h-full z-40 transition-all duration-300 ease-in-out shadow-[1px_0_10px_rgba(0,0,0,0.02)]",
          "lg:static lg:h-full",
          mobileOpen
            ? "translate-x-0 w-64 shadow-2xl"
            : "-translate-x-64 w-64 lg:translate-x-0",
          desktopOpen ? "lg:w-64" : "lg:w-[72px]",
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-50 dark:border-zinc-900">
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-2 transition-all duration-300 overflow-hidden",
              desktopOpen ? "opacity-100 w-auto" : "lg:opacity-0 lg:w-0",
            )}
          >
            <div className="h-10 w-auto flex-shrink-0">
              <Logo classNames="h-full w-auto object-contain" />
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                mobileOpen ? setMobileOpen(false) : setDesktopOpen((o) => !o)
              }
              aria-label={desktopOpen ? "Collapse sidebar" : "Expand sidebar"}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-600 transition-all duration-200",
                !desktopOpen && "mx-auto lg:flex hidden",
                mobileOpen && "lg:hidden flex",
              )}
            >
              {mobileOpen ? (
                <X size={18} />
              ) : (
                <ChevronLeft
                  size={18}
                  className={cn(
                    "transition-transform duration-300",
                    !desktopOpen && "rotate-180",
                  )}
                />
              )}
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8 scrollbar-none invisible-scrollbar">
          {adminMenuSections.map((group) => (
            <div key={group.title}>
              {desktopOpen && (
                <div className="px-3 mb-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {group.title}
                  </h2>
                </div>
              )}

              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    pathname === item.route ||
                    (pathname?.startsWith(item.route + "/") &&
                      item.route !== "/admin") ||
                    (item.route === "/admin" && pathname === "/admin");
                  const Icon = item.icon;

                  return (
                    <li key={item.route}>
                      <Link
                        href={item.route}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200 group relative",
                          active
                            ? "bg-violet-50/50 dark:bg-violet-900/10 text-violet-900 dark:text-violet-400"
                            : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100",
                          !desktopOpen && "lg:justify-center lg:px-0",
                        )}
                        title={!desktopOpen ? item.label : undefined}
                      >
                        <Icon
                          size={20}
                          className={cn(
                            "flex-shrink-0 transition-colors",
                            active
                              ? "text-violet-900 dark:text-violet-400"
                              : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300",
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
                          <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-1 h-6 bg-violet-600 rounded-r-full" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3 mt-auto border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/30">
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
                  <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {session?.user?.name || "Admin"}
                  </span>
                  <span className="text-[11px] text-zinc-500 truncate">
                    Admin Portal
                  </span>
                </div>
              )}
            </div>
            {desktopOpen && (
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            )}
            <NotificationDropdown />
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 w-full overflow-hidden">
        <AppHeader setOpen={() => setDesktopOpen((o) => !o)} />

        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-[1600px] mx-auto p-4 lg:p-8">{children}</div>
        </main>
      </div>

      {/* Mobile Floating Menu Button */}
      <button
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex lg:hidden items-center justify-center w-12 h-12 rounded-full bg-violet-600 text-white shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all active:scale-95"
      >
        {mobileOpen ? <ChevronLeft /> : <Menu />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-zinc-900/20 backdrop-blur-[2px] z-30 lg:hidden transition-all duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <MegaMenu
        isOpen={isMegaMenuOpen}
        onClose={() => setIsMegaMenuOpen(false)}
      />
    </div>
  );
}
