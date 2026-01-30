import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MetaState {
  pageTitle: string;
  redirectUrl: string;
  setPageTitle: (title: string) => void;
  setRedirectUrl: (url: string) => void;
  resetTitle: () => void;
}

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
