"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  HomeIcon,
  CubeIcon,
  ChartBarIcon,
  UserGroupIcon,
  CogIcon,
  ClipboardDocumentListIcon,
  BuildingOffice2Icon,
  ArrowLeftOnRectangleIcon,
  XMarkIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

interface SidebarLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({
  href,
  icon: Icon,
  label,
  isActive,
  onClick,
}) => (
  <Link
    href={href}
    onClick={onClick}
    className={`relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 ${
      isActive && "!bg-graydark dark:!bg-meta-4"
    }`}
  >
    <Icon className="w-5 h-5" />
    {label}
  </Link>
);

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Define menu items based on user role
  const getMenuItems = () => {
    if (!user) return [];

    // const commonItems = [
    //   { href: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
    // ];

    if (user.role === "admin") {
      return [
        { href: "/admin", icon: BuildingOffice2Icon, label: "Admin Dashboard" },
        {
          href: "/admin/customers",
          icon: UserGroupIcon,
          label: "Customer Management",
        },
        { href: "/admin/analytics", icon: ChartBarIcon, label: "Analytics" },
        { href: "/admin/settings", icon: CogIcon, label: "Settings" },
      ];
    } else {
      return [
        { href: "/dashboard", icon: HomeIcon, label: "Dashboard" },
        {
          href: "/orders",
          icon: ClipboardDocumentListIcon,
          label: "My Orders",
        },
        { href: "/settings", icon: CogIcon, label: "Settings" },
      ];
    }
  };

  const menuItems = getMenuItems();

  const handleLogout = async () => {
    await logout();
    setSidebarOpen(false);
  };

  return (
    <>
      {/* Sidebar backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`absolute left-0 top-0 z-30 flex h-screen w-72.5 flex-col overflow-y-hidden bg-black duration-300 ease-linear dark:bg-boxdark lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between gap-2 px-6 py-5.5 lg:py-6.5">
          <Link href="/">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <CubeIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">CNC Quote</span>
            </div>
          </Link>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="block lg:hidden"
          >
            <XMarkIcon className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Sidebar Menu */}
        <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
          {/* User Profile Section */}
          {user && (
            <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-black dark:text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.company?.name || user.email}
                  </p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    }`}
                  >
                    {user.role === "admin" ? "Administrator" : "Customer"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <nav className="mt-5 py-4 px-4 lg:mt-9 lg:px-6">
            <div>
              <h3 className="mb-4 ml-4 text-sm font-semibold text-bodydark2">
                MENU
              </h3>
              <ul className="mb-6 flex flex-col gap-1.5">
                {menuItems.map((item) => (
                  <li key={item.href}>
                    <SidebarLink
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      isActive={
                        pathname === item.href ||
                        pathname?.startsWith(item.href + "/")
                      }
                      onClick={() => setSidebarOpen(false)}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {user && (
              <div>
                <h3 className="mb-4 ml-4 text-sm font-semibold text-bodydark2">
                  ACCOUNT
                </h3>
                <ul className="mb-6 flex flex-col gap-1.5">
                  <li>
                    <button
                      onClick={handleLogout}
                      className="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 w-full text-left"
                    >
                      <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
