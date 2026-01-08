"use client";

import { useSidebar } from "@/context/SidebarContext";
import Link from "next/link";
import React, { useEffect, useRef } from "react";
import Logo from "@/components/ui/logo";
import { Search, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface AppHeaderProps {
  setOpen: () => void;
}

const AppHeader = ({ setOpen }: AppHeaderProps) => {
  const { toggleMobileSidebar } = useSidebar();
  const router = useRouter();
  const session = useSession();

  const handleToggle = () => {
    setOpen();
    toggleMobileSidebar();
  };
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8">
      <div className="flex items-center justify-between w-full">
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

        {/* Center section - Search Area */}
        <div className="hidden lg:flex flex-1 max-w-xl">
          <div className="relative w-full group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              ref={inputRef}
              type="text"
              className="block w-full h-10 pl-10 pr-12 text-sm text-slate-900 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all outline-none"
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

        {/* Right Section - Page Title or Contextual info */}
        {session.data?.user.role === "customer" && (
          <div className="hidden lg:flex items-center gap-4">
            <div className="h-8 w-px bg-slate-200 mx-2" />
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
    </header>
  );
};

export default AppHeader;
