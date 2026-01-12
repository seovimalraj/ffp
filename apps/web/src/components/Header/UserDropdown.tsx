"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserRound, LogOut, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const UserDropdown = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "unauthenticated") {
    router.push("/signin");
    return null;
  }

  const userInitial = session?.user?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 outline-none",
          dropdownOpen
            ? "bg-blue-50 text-blue-600 ring-2 ring-blue-500/20"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        )}
        aria-label="User menu"
      >
        <span className="text-xs font-bold leading-none">{userInitial}</span>
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 z-[60] py-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-4 py-3 border-b border-slate-50 mb-1">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {session?.user?.email || "Guest User"}
            </p>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
              {(session?.user as any)?.role || "Customer"}
            </p>
          </div>

          <div className="px-2 space-y-0.5">
            <button
              onClick={() => {
                router.push("/portal/account");
                setDropdownOpen(false);
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <UserRound size={16} className="text-slate-400" />
              Profile Settings
            </button>
            <button className="flex items-center gap-3 w-full px-3 py-2 text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors">
              <LayoutGrid size={16} className="text-slate-400" />
              Dashboard
            </button>
          </div>

          <div className="mx-2 my-2 border-t border-slate-50" />

          <div className="px-2">
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="flex items-center gap-3 w-full px-3 py-2 text-[13px] font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
