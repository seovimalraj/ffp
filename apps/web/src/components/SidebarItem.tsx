"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface SidebarItemProps {
  item: {
    label: string;
    route: string;
    icon: React.ReactNode;
  };
  pageName: string;
  setPageName: (pageName: string) => void;
}

const SidebarItem = ({ item, setPageName }: SidebarItemProps) => {
  const pathname = usePathname();

  const handleClick = () => {
    const updatedPageName =
      item.label.toLowerCase() === "dashboard"
        ? "dashboard"
        : item.label.toLowerCase();
    setPageName(updatedPageName);
  };

  return (
    <>
      <li>
        <Link
          href={item.route}
          onClick={handleClick}
          className={`group relative flex items-center gap-2.5 rounded-sm px-4 py-2 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 ${
            pathname === item.route ? "bg-graydark dark:bg-meta-4" : ""
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      </li>
    </>
  );
};

export default SidebarItem;
