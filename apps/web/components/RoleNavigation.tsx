"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Package,
  FileText,
  TrendingUp,
  Users,
  Settings,
  ShoppingCart,
  Kanban,
  Clock,
  LogOut,
  Newspaper as NewspaperIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: any;
  badge?: number;
}

interface RoleNavigationProps {
  role: "customer" | "supplier" | "admin";
}

export default function RoleNavigation({ role }: RoleNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();

  const navigationConfig: Record<string, NavItem[]> = {
    customer: [
      { label: "Home", path: "/", icon: Home },
      { label: "New Quote", path: "/instant-quote-v2", icon: ShoppingCart },
      { label: "My Orders", path: "/portal/orders", icon: Package },
      { label: "Quotes", path: "/portal/quotes", icon: FileText },
    ],
    supplier: [
      { label: "Dashboard", path: "/supplier", icon: Home },
      { label: "RFQs", path: "/supplier/rfqs", icon: FileText, badge: 3 },
      { label: "My Orders", path: "/supplier/orders", icon: Package },
      { label: "Production", path: "/supplier/production", icon: Kanban },
    ],
    admin: [
      { label: "Dashboard", path: "/admin", icon: Home },
      { label: "Orders", path: "/admin/orders", icon: Package },
      { label: "Blogs", path: "/admin/blogs", icon: NewspaperIcon },
      { label: "Bids", path: "/admin/bids", icon: Clock, badge: 5 },
      { label: "Analytics", path: "/admin/analytics", icon: TrendingUp },
      { label: "Customers", path: "/admin/customers", icon: Users },
      {
        label: "Settings",
        path: "/admin/settings/organization",
        icon: Settings,
      },
    ],
  };

  const navItems = navigationConfig[role] || [];
  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(path + "/");

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">F</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Frigate</h1>
              <p className="text-xs text-gray-500 capitalize">{role} Portal</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Button
                  key={item.path}
                  variant={active ? "default" : "ghost"}
                  onClick={() => router.push(item.path)}
                  className={`relative ${active ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                  {item.badge && item.badge > 0 && (
                    <Badge className="ml-2 bg-red-500 text-white border-0 px-1.5 py-0 text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/")}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Switch Role
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center gap-1 pb-3 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Button
                key={item.path}
                variant={active ? "default" : "ghost"}
                size="sm"
                onClick={() => router.push(item.path)}
                className={`relative flex-shrink-0 ${active ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              >
                <Icon className="w-4 h-4 mr-1" />
                {item.label}
                {item.badge && item.badge > 0 && (
                  <Badge className="ml-1 bg-red-500 text-white border-0 px-1 py-0 text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
