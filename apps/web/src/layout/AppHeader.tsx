"use client";

import { useSidebar } from "@/context/SidebarContext";
import Link from "next/link";
import React, { useEffect, useRef } from "react";
import Logo from "@/components/ui/logo";
import { Search, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMetaStore } from "@/components/store/title-store";
import { useMegaMenu } from "@/hooks/use-mega-menu";
import { cn } from "@/lib/utils";
import NotificationDropdown from "@/components/Header/NotificationDropdown";

interface AppHeaderProps {
  setOpen: () => void;
}

const AppHeader = ({ setOpen }: AppHeaderProps) => {
  const { toggleMobileSidebar } = useSidebar();
  const router = useRouter();
  const session = useSession();
  const { pageTitle } = useMetaStore();
  const { setIsOpen: setIsMegaMenuOpen } = useMegaMenu();

  const handleToggle = () => {
    setOpen();
    toggleMobileSidebar();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsMegaMenuOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [setIsMegaMenuOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8">
      <div className="flex items-center justify-around w-full">
        {/* Left section - Mobile Toggle & Logo */}
        <div className="flex items-center gap-4 lg:hidden">
          <button
            className="flex items-center justify-center w-10 h-10 text-slate-500 hover:bg-slate-50 rounded-xl transition-all active:scale-95"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <Link href="/portal/dashboard" className="flex-shrink-0">
            <div className="h-8 w-auto">
              <Logo classNames="h-full w-auto object-contain" />
            </div>
          </Link>
        </div>

        {/* Page Title with Premium Styling */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="relative">
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-violet-500 to-indigo-500 rounded-full animate-pulse" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 dark:from-slate-200 dark:via-slate-300 dark:to-slate-400 bg-clip-text text-transparent tracking-tight">
              {pageTitle}
            </h1>
          </div>
        </div>

        {/* Center section - Search Area */}
        <div className="hidden lg:flex flex-1 max-w-xl gap-4">
          <div className="relative w-full group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search
                className={cn(
                  "w-4 h-4 text-slate-400 transition-colors",
                  session.data?.user.role === "admin"
                    ? "group-focus-within:text-violet-500"
                    : "group-focus-within:text-blue-500",
                )}
              />
            </div>
            <input
              type="text"
              readOnly
              onClick={() => setIsMegaMenuOpen(true)}
              onFocus={() => setIsMegaMenuOpen(true)}
              className={cn(
                "block w-full h-10 pl-10 pr-12 text-sm text-slate-900 bg-slate-50 border border-transparent rounded-xl focus:bg-white transition-all outline-none cursor-pointer",
                session.data?.user.role === "admin"
                  ? "focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/30"
                  : "focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/30",
              )}
              placeholder="Search..."
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <kbd className="hidden sm:inline-flex items-center gap-1 h-5 px-1.5 font-sans text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded">
                <Command className="w-2.5 h-2.5" />
                <span>K</span>
              </kbd>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4 ml-auto">
          <NotificationDropdown />

          {session.data?.user.role === "customer" && (
            <div className="hidden lg:flex items-center gap-4">
              <div className="h-8 w-px bg-slate-200 mx-1" />
              <Button
                className="rounded-md"
                variant="cta"
                onClick={() => router.push("/instant-quote")}
              >
                New Quote
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
