import React from "react";
import CustomerLayout from "@/components/CustomerLayout";
import { MegaMenuProvider } from "@/hooks/use-mega-menu";

export default function PortalLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <MegaMenuProvider>
      <CustomerLayout>{children}</CustomerLayout>
    </MegaMenuProvider>
  );
}
