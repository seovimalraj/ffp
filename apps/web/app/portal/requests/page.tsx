"use client";

import TechSupportRequestsTable from "@/components/requests/tech-support-requests-table";
import { useEffect } from "react";
import { useMetaStore } from "@/components/store/title-store";

export default function CustomerRequestsPage() {
  const { setPageTitle, resetTitle } = useMetaStore();

  useEffect(() => {
    setPageTitle("My Support Requests");
    return () => resetTitle();
  }, []);

  return (
    <div className="min-h-screen space-y-4">
      <TechSupportRequestsTable role="customer" rfqId="all" />
    </div>
  );
}
