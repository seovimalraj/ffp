"use client";

import Image from "next/image";
import SidebarItem from "./SidebarItem";
import ClickOutside from "@/components/ClickOutside";
import useLocalStorage from "@/hooks/useLocalStorage";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (arg: boolean) => void;
}

const menuGroups = [
  {
    name: "Menu",
    menuItems: [
      {
        icon: (
          <svg
            className="fill-current"
            width="18"
            height="18"
            viewBox="0 0 18 18"
          >
            <path d="M6.10322 0.956299H2.53135C1.5751 0.956299 0.787598 1.7438 0.787598 2.70005V6.27192C0.787598 7.22817 1.5751 8.01567 2.53135 8.01567H6.10322C7.05947 8.01567 7.84697 7.22817 7.84697 6.27192V2.70005C7.84697 1.7438 7.05947 0.956299 6.10322 0.956299Z" />
            <path d="M15.4689 0.956299H11.8971C10.9408 0.956299 10.1533 1.7438 10.1533 2.70005V6.27192C10.1533 7.22817 10.9408 8.01567 11.8971 8.01567H15.4689C16.4252 8.01567 17.2127 7.22817 17.2127 6.27192V2.70005C17.2127 1.7438 16.4252 0.956299 15.4689 0.956299Z" />
            <path d="M6.10322 9.92822H2.53135C1.5751 9.92822 0.787598 10.7157 0.787598 11.672V15.2438C0.787598 16.2001 1.5751 16.9876 2.53135 16.9876H6.10322C7.05947 16.9876 7.84697 16.2001 7.84697 15.2438V11.672C7.84697 10.7157 7.05947 9.92822 6.10322 9.92822Z" />
            <path d="M15.4689 9.92822H11.8971C10.9408 9.92822 10.1533 10.7157 10.1533 11.672V15.2438C10.1533 16.2001 10.9408 16.9876 11.8971 16.9876H15.4689C16.4252 16.9876 17.2127 16.2001 17.2127 15.2438V11.672C17.2127 10.7157 16.4252 9.92822 15.4689 9.92822Z" />
          </svg>
        ),
        label: "Dashboard",
        route: "/",
      },
      {
        icon: (
          <svg
            className="fill-current"
            width="18"
            height="19"
            viewBox="0 0 18 19"
          >
            <path d="M15.7501 0.55835H2.2501C1.29385 0.55835 0.506348 1.34585 0.506348 2.3021V15.8083C0.506348 16.7646 1.29385 17.5521 2.2501 17.5521H15.7501C16.7063 17.5521 17.4938 16.7646 17.4938 15.8083V2.3021C17.4938 1.34585 16.7063 0.55835 15.7501 0.55835Z" />
          </svg>
        ),
        label: "Tables",
        route: "/tables",
      },
      {
        icon: (
          <svg className="fill-current" width="18" height="18">
            <path d="M9.0002 7.79065C9.3022 7.79065 9.5492 8.03765 9.5492 8.33965V13.6693L13.6402 11.8773C13.8822 11.7653 14.1542 11.8963 14.2662 12.1383C14.3782 12.3803 14.2472 12.6523 14.0052 12.7643L9.7632 14.5833C9.6032 14.6543 9.4212 14.6543 9.2612 14.5833L4.9972 12.7643C4.7552 12.6523 4.6242 12.3803 4.7362 12.1383C4.8482 11.8963 5.1202 11.7653 5.3622 11.8773L9.0002 13.6693V8.33965C9.0002 8.03765 9.2472 7.79065 9.5492 7.79065H9.0002Z" />
          </svg>
        ),
        label: "Forms",
        route: "/forms",
      },
    ],
  },
];

const Sidebar = ({ sidebarOpen, setSidebarOpen }: SidebarProps) => {
  const [pageName, setPageName] = useLocalStorage("selectedMenu", "dashboard");

  return (
    <ClickOutside onClick={() => setSidebarOpen(false)}>
      <aside
        className={`fixed left-0 top-0 z-[9999] flex h-screen w-64 flex-col bg-gray-900 text-gray-200 border-r border-gray-800 transition-all duration-300 
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <Link href="/">
            <Image
              width={150}
              height={28}
              src="/images/logo/logo.svg"
              alt="Logo"
            />
          </Link>

          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <svg width="20" height="18" className="fill-current">
              <path d="M19 8.175H2.98748L9.36248 1.6875C9.69998 1.35 9.69998 0.825 9.36248 0.4875C9.02498 0.15 8.49998 0.15 8.16248 0.4875L0.399976 8.3625C0.0624756 8.7 0.0624756 9.225 0.399976 9.5625L8.16248 17.4375C8.53748 17.7 8.98748 17.7 9.36248 17.475C9.69998 17.1375 9.69998 16.6125 9.36248 16.275L3.02498 9.8625H19C19.45 9.8625 19.825 9.4875 19.825 9.0375C19.825 8.55 19.45 8.175 19 8.175Z" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {menuGroups.map((group, idx) => (
            <div key={idx} className="mb-7">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                {group.name}
              </h3>

              <ul className="space-y-1">
                {group.menuItems.map((item, i) => (
                  <SidebarItem
                    key={i}
                    item={item}
                    pageName={pageName}
                    setPageName={setPageName}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </ClickOutside>
  );
};

export default Sidebar;
