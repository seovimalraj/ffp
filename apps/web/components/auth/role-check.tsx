"use client";

import { useSession } from "next-auth/react";
import React from "react";

type Role = "admin" | "supplier" | "customer"; // extend as needed

interface RoleCheckProps {
  roles: Role[]; // allow multiple roles
  children: React.ReactNode;
  fallback?: React.ReactNode; // optional fallback UI
}

const RoleCheck: React.FC<RoleCheckProps> = ({
  roles,
  children,
  fallback = null,
}) => {
  const { data: session, status } = useSession();

  // Handle loading state
  if (status === "loading") {
    return null; // or a loader
  }

  const userRole = session?.user?.role as Role | undefined;

  if (!userRole || !roles.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RoleCheck;
