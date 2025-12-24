"use client";
import React from "react";

interface RequireRoleProps {
  role: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// here-it-has-session-usage
export const RequireRole: React.FC<RequireRoleProps> = ({
  role,
  children,
  fallback = null,
}) => {
  const loading = false;
  const user = { email: "something@gmail.com", role: "admin" };
  if (loading)
    return (
      <div className="text-xs text-gray-500 animate-pulse">
        Checking access…
      </div>
    );
  if (!user || user.role !== role) return <>{fallback}</>;
  return <>{children}</>;
};
