"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type MenuItemProps = {
  item: {
    title: string;
    url?: string;
    items?: { title: string; url: string }[];
  };
  icon?: React.ComponentType<any>;
};

export function MenuItem({ item, icon: Icon }: MenuItemProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = item.url === pathname || item.items?.some(subItem => subItem.url === pathname);

  if (item.items && item.items.length > 0) {
    return (
      <li>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
            isActive && "bg-primary text-white hover:bg-primary/90"
          )}
        >
          <div className="flex items-center gap-3">
            {Icon && <Icon className="h-5 w-5" />}
            <span>{item.title}</span>
          </div>
          <svg
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {isOpen && (
          <ul className="mt-1 space-y-1 pl-8">
            {item.items.map((subItem) => (
              <li key={subItem.url}>
                <Link
                  href={subItem.url}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
                    pathname === subItem.url && "bg-primary text-white hover:bg-primary/90"
                  )}
                >
                  {subItem.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.url!}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
          isActive && "bg-primary text-white hover:bg-primary/90"
        )}
      >
        {Icon && <Icon className="h-5 w-5" />}
        <span>{item.title}</span>
      </Link>
    </li>
  );
}
