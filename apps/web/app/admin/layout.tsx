import React from "react";
import AdminLayout from "@/components/AdminLayout";
import { MegaMenuProvider } from "@/hooks/use-mega-menu";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MegaMenuProvider>
      <AdminLayout>{children}</AdminLayout>;
    </MegaMenuProvider>
  );
}
