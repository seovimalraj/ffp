"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { usePermissionsStore } from "@/components/store/permissions-store"

interface PermissionsProviderProps {
    children:  React.ReactNode
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const { data: session, status } = useSession();
  const fetchPermissions = usePermissionsStore((state) => state.fetchPermissions);
  const clearPermissions = usePermissionsStore((state) => state.clearPermissions);

  useEffect(() => {
    if (status === 'loading') return;

    if (session?.user) {
      // User is logged in, fetch permissions
      fetchPermissions();
    } else {
      // User is not logged in, clear permissions
      clearPermissions();
    }
  }, [session?.user?.id, status, fetchPermissions, clearPermissions]);

  return <>{children}</>;
}
