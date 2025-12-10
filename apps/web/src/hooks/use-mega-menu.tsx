"use client";

import { create } from "zustand";
import { createContext, useContext, ReactNode } from "react";

// Store types
interface MegaMenuState {
  isOpen: boolean;
  activeMenuId: string | null;
  setIsOpen: (isOpen: boolean) => void;
  setActiveMenuId: (menuId: string | null) => void;
  reset: () => void;
}

// Create Zustand store
const createMegaMenuStore = () =>
  create<MegaMenuState>((set) => ({
    isOpen: false,
    activeMenuId: null,
    setIsOpen: (isOpen: boolean) => set({ isOpen }),
    setActiveMenuId: (menuId: string | null) => set({ activeMenuId: menuId }),
    reset: () => set({ isOpen: false, activeMenuId: null }),
  }));

// Create context
const MegaMenuContext = createContext<ReturnType<
  typeof createMegaMenuStore
> | null>(null);

// Provider component
export function MegaMenuProvider({ children }: { children: ReactNode }) {
  const store = createMegaMenuStore();
  return (
    <MegaMenuContext.Provider value={store}>
      {children}
    </MegaMenuContext.Provider>
  );
}

// Custom hook
export function useMegaMenu(): MegaMenuState {
  const store = useContext(MegaMenuContext);
  if (!store) {
    throw new Error("useMegaMenu must be used within MegaMenuProvider");
  }
  return store();
}
