import React from "react";
import CustomerLayout from "@/components/CustomerLayout";

export default function PortalLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <CustomerLayout>{children}</CustomerLayout>;
}
