"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const NotificationDropdown = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={cn(
          "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 outline-none",
          dropdownOpen
            ? "bg-blue-50 text-blue-600 ring-2 ring-blue-500/20"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
        )}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {/* <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span> */}
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 lg:left-auto lg:right-0 bottom-full mb-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 z-[60] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-900">
              Notifications
            </h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              New
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto py-2">
            <div className="px-4 py-8 text-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell size={20} className="text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-900">
                All caught up!
              </p>
              <p className="text-xs text-slate-500 mt-1">
                No new notifications at the moment.
              </p>
            </div>
          </div>

          <div className="p-3 border-t border-slate-50 bg-slate-50/50">
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors w-full text-center">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
