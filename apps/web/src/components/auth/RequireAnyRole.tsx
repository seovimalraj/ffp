"use client";
import React from "react";

interface RequireAnyRoleProps {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// here-it-has-session-usage

export const RequireAnyRole: React.FC<RequireAnyRoleProps> = ({
  roles,
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
  if (!user || !roles.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
};
