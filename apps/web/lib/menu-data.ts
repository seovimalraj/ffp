import {
  Warehouse,
  Package,
  Cog,
  Sparkles,
  LayoutDashboard,
  Users,
  Shield,
  KeyRound,
  FolderKanban,
  FileQuestion,
  ShoppingCart,
  Gavel,
  GitCompare,
  History,
  Boxes,
  CalendarClock,
  ClipboardList,
  BadgeCheck,
  Receipt,
  CreditCard,
  TrendingUp,
  PiggyBank,
  Settings,
  Plug,
  ScrollText,
  LucideIcon,
} from "lucide-react";

export interface MenuItem {
  label: string;
  slug: string;
  route: string;
  icon: LucideIcon;
}

export interface MenuSection {
  title: string;
  slug: string;
  icon: LucideIcon;
  items: MenuItem[];
}

export const menuSections: MenuSection[] = [
  {
    title: "Material Store",
    slug: "material-store",
    icon: Package,
    items: [
      {
        label: "Warehouses",
        slug: "warehouse",
        route: "/supplier/warehouse",
        icon: Warehouse,
      },
      {
        label: "Materials",
        slug: "materials",
        route: "/supplier/warehouse/materials",
        icon: Package,
      },
      {
        label: "Machines",
        slug: "machines",
        route: "/404?dev=true",
        icon: Cog,
      },
      {
        label: "Finishes",
        slug: "finishes",
        route: "/supplier/finishes",
        icon: Sparkles,
      },
      {
        label: "Dashboard",
        slug: "dashboard",
        route: "/supplier/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Capacity Management",
    slug: "capacity",
    icon: CalendarClock,
    items: [
      {
        label: "Machine Details",
        slug: "machine-details",
        route: "/supplier/capacity/machines",
        icon: Cog,
      },
      {
        label: "Tolerance",
        slug: "machine-details",
        route: "/supplier/capacity/tolerance",
        icon: Cog,
      },
      {
        label: "Inspection",
        slug: "inspection",
        route: "/supplier/capacity/inspection",
        icon: BadgeCheck,
      }
    ],
  },
    {
    title: "RFQ & Procurement",
    slug: "rfq-procurement",
    icon: FileQuestion,
    items: [
      {
        label: "RFQs",
        slug: "rfqs",
        route: "/supplier/rfqs",
        icon: FileQuestion,
      },
      {
        label: "Purchase Orders",
        slug: "purchase-orders",
        route: "/rfq-procurement/purchase-orders",
        icon: ShoppingCart,
      },
      {
        label: "Live Auctions",
        slug: "auctions",
        route: "/rfq-procurement/auctions",
        icon: Gavel,
      },
      {
        label: "Vendor Comparison",
        slug: "vendor-comparison",
        route: "/rfq-procurement/vendor-comparison",
        icon: GitCompare,
      },
      {
        label: "Quote History",
        slug: "quote-history",
        route: "/rfq-procurement/quote-history",
        icon: History,
      },
    ],
  },
  {
    title: "Internal Management",
    slug: "internal-management",
    icon: Users,
    items: [
      {
        label: "Members",
        slug: "members",
        route: "/internal-management/members",
        icon: Users,
      },
      {
        label: "Roles",
        slug: "roles",
        route: "/internal-management/roles",
        icon: Shield,
      },
      {
        label: "Permissions",
        slug: "permissions",
        route: "/supplier/permissions",
        icon: KeyRound,
      },
      {
        label: "Projects",
        slug: "projects",
        route: "/internal-management/projects",
        icon: FolderKanban,
      },
    ],
  },
  {
    title: "Operations",
    slug: "operations",
    icon: Boxes,
    items: [
      {
        label: "Inventory",
        slug: "inventory",
        route: "/operations/inventory",
        icon: Boxes,
      },
      {
        label: "Production Schedule",
        slug: "production",
        route: "/operations/production",
        icon: CalendarClock,
      },
      {
        label: "Work Orders",
        slug: "work-orders",
        route: "/operations/work-orders",
        icon: ClipboardList,
      },
      {
        label: "Quality Control",
        slug: "quality-control",
        route: "/operations/quality-control",
        icon: BadgeCheck,
      },
    ],
  },
  {
    title: "Finance",
    slug: "finance",
    icon: Receipt,
    items: [
      {
        label: "Invoices",
        slug: "invoices",
        route: "/finance/invoices",
        icon: Receipt,
      },
      {
        label: "Payments",
        slug: "payments",
        route: "/finance/payments",
        icon: CreditCard,
      },
      {
        label: "Cost Tracking",
        slug: "cost-tracking",
        route: "/finance/cost-tracking",
        icon: TrendingUp,
      },
      {
        label: "Budgeting",
        slug: "budgeting",
        route: "/finance/budgeting",
        icon: PiggyBank,
      },
    ],
  },
  {
    title: "Settings",
    slug: "settings",
    icon: Settings,
    items: [
      {
        label: "General Settings",
        slug: "settings",
        route: "/supplier/settings",
        icon: Settings,
      },
      {
        label: "Integrations",
        slug: "integrations",
        route: "/settings/integrations",
        icon: Plug,
      },
      {
        label: "Audit Logs",
        slug: "audit-logs",
        route: "/settings/audit-logs",
        icon: ScrollText,
      },
    ],
  },
];

export function findSectionBySlug(
  sectionSlug: string,
): MenuSection | undefined {
  return menuSections.find((s) => s.slug === sectionSlug);
}

export function findSectionByItemSlug(
  itemSlug: string,
): MenuSection | undefined {
  return menuSections.find((s) =>
    s.items.some((item) => item.slug === itemSlug),
  );
}

export function findItemBySlug(itemSlug: string): MenuItem | undefined {
  for (const section of menuSections) {
    const item = section.items.find((i) => i.slug === itemSlug);
    if (item) return item;
  }
  return undefined;
}

/* -------------------------------------------------------
   FAST LOOKUP: itemSlug → section (O(1) constant time)
-------------------------------------------------------- */

// Precompute lookup map
const itemToSectionMap: Record<string, MenuSection> = {};

for (const section of menuSections) {
  for (const item of section.items) {
    itemToSectionMap[item.slug] = section;
  }
}

// Exported fast lookup function
export function getSectionByItemSlugFast(
  itemSlug: string,
): MenuSection | undefined {
  return itemToSectionMap[itemSlug];
}
