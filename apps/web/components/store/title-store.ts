import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MetaState {
  pageTitle: string;
  setPageTitle: (title: string) => void;

  resetTitle: () => void;
}

export const useMetaStore = create<MetaState>()(
  persist(
    (set) => ({
      pageTitle: "",
      setPageTitle: (title: string) => set({ pageTitle: title }),
      resetTitle: () => set({ pageTitle: "" }),
    }),
    {
      name: "meta-store",
      partialize: (state) => ({
        pageTitle: state.pageTitle,
      }),
    },
  ),
);
