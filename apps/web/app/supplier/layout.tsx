import React from "react";
import SupplierLayout from "@/components/SupplierLayout";
import { MegaMenuProvider } from "@/hooks/use-mega-menu";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MegaMenuProvider>
      <SupplierLayout>{children}</SupplierLayout>;
    </MegaMenuProvider>
  );
}
