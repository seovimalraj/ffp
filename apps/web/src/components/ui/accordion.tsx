"use client";

import React, { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface AccordionItemProps {
  id: string;
  title: React.ReactNode;
  children: React.ReactNode;
  status?: "pass" | "warning" | "blocker" | "running";
  isOpen?: boolean;
  onToggle?: (id: string) => void;
}

const AccordionContext = React.createContext<{
  openItems: Set<string>;
  handleToggle: (id: string) => void;
} | null>(null);

export const AccordionItem = ({
  id,
  title,
  children,
  isOpen: propsIsOpen,
  onToggle: propsOnToggle,
}: AccordionItemProps) => {
  const context = React.useContext(AccordionContext);

  const isOpen = context ? context.openItems.has(id) : !!propsIsOpen;
  const onToggle = context ? context.handleToggle : propsOnToggle;

  const handleToggle = () => {
    onToggle?.(id);
  };

  return (
    <div
      className={cn(
        "transition-all duration-300 border border-slate-200 rounded-2xl overflow-hidden mb-4",
        isOpen
          ? "bg-white shadow-xl shadow-slate-200/50 border-blue-200 ring-1 ring-blue-50"
          : "bg-white/50 hover:bg-white hover:border-slate-300 shadow-sm",
      )}
    >
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-6 text-left transition-colors group"
      >
        <div className="flex-1">
          {typeof title === "string" ? (
            <span className="font-bold text-lg text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">
              {title}
            </span>
          ) : (
            title
          )}
        </div>
        <div
          className={cn(
            "ml-4 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
            isOpen
              ? "bg-blue-600 text-white rotate-180"
              : "bg-slate-100 text-slate-400 group-hover:bg-slate-200",
          )}
        >
          <ChevronDownIcon className="h-5 w-5 stroke-[2.5]" />
        </div>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-500 ease-in-out",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="px-6 pb-8 pt-0 border-t border-slate-50">
          {children}
        </div>
      </div>
    </div>
  );
};

interface AccordionProps {
  items?: Omit<AccordionItemProps, "onToggle" | "isOpen">[];
  children?: React.ReactNode;
  allowMultiple?: boolean;
  activeKey?: string | string[];
  onToggle?: (key: string) => void;
  className?: string;
}

export const Accordion = ({
  items,
  children,
  allowMultiple = true,
  activeKey,
  onToggle,
  className,
}: AccordionProps) => {
  const [internalOpenItems, setInternalOpenItems] = useState<Set<string>>(
    new Set(),
  );

  const isControlled = activeKey !== undefined;
  const openItems = isControlled
    ? Array.isArray(activeKey)
      ? new Set(activeKey)
      : new Set([activeKey])
    : internalOpenItems;

  const handleToggle = (id: string) => {
    if (onToggle) {
      if (isControlled && !allowMultiple && Array.from(openItems)[0] === id) {
        onToggle("");
      } else {
        onToggle(id);
      }
    }

    if (!isControlled) {
      setInternalOpenItems((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          if (!allowMultiple) {
            newSet.clear();
          }
          newSet.add(id);
        }
        return newSet;
      });
    }
  };

  return (
    <AccordionContext.Provider value={{ openItems, handleToggle }}>
      <div className={cn("space-y-2", className)}>
        {items
          ? items.map((item) => <AccordionItem key={item.id} {...item} />)
          : children}
      </div>
    </AccordionContext.Provider>
  );
};
