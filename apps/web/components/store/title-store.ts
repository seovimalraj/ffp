import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MetaState {
  pageTitle: string;
  redirectUrl: string;
  setPageTitle: (title: string) => void;
  setRedirectUrl: (url: string) => void;
  resetTitle: () => void;
}

type Role = "admin" | "supplier" | "customer";

// Use 'Record' to ensure all roles are handled and provide a fallback
const ROLE_CONFIG: Record<Role, { allowed: RegExp[]; default: string }> = {
  admin: {
    allowed: [/^\/admin/],
    default: "/admin/dashboard",
  },
  supplier: {
    allowed: [/^\/supplier/],
    default: "/supplier/dashboard",
  },
  customer: {
    allowed: [/^\/customer/, /^\/portal/],
    default: "/portal/dashboard",
  },
};

export const formatUrlForRole = (url: string, role: string): string => {
  // 1. Guard against invalid roles passed from JS/External state
  if (!(role in ROLE_CONFIG)) {
    console.error(`Invalid role: ${role}`);
    return "/";
  }

  const currentRole = role as Role;
  const config = ROLE_CONFIG[currentRole];

  // 2. Scrub "undefined", "null", or malformed segments
  const isMalformed =
    !url || /\/(undefined|null|undefin)(\/|$)/.test(url) || url === "undefined";
  if (isMalformed) return config.default;

  // 3. Permission Check using Regex for all roles (more consistent)
  const isAllowed = config.allowed.some((regex) => regex.test(url));

  // 4. Final safety check: If it's an external URL, decide if you want to allow it.
  // This version assumes we only want internal routing.
  return isAllowed ? url : config.default;
};

export const useMetaStore = create<MetaState>()(
  persist(
    (set) => ({
      pageTitle: "",
      redirectUrl: "",
      setPageTitle: (title: string) => set({ pageTitle: title }),
      setRedirectUrl: (url: string) => set({ redirectUrl: url }),
      resetTitle: () => set({ pageTitle: "" }),
    }),
    {
      name: "meta-store",
      partialize: (state) => ({
        pageTitle: state.pageTitle,
        redirectUrl: state.redirectUrl,
      }),
    },
  ),
);
