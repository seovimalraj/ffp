import { usePermissionsStore } from "../store/permissions-store";
import { RoleNames } from '@cnc-quote/shared';

/**
 * Custom hook for accessing permissions functionality
 * Provides a convenient interface for checking permissions
 */
export function usePermissions() {
  const store = usePermissionsStore();

  return {
    // State
    permissions: store.permissions,
    isLoading: store.isLoading,
    error: store.error,
    lastFetched: store.lastFetched,

    // Actions
    fetchPermissions: store.fetchPermissions,
    clearPermissions: store.clearPermissions,

    // Permission checks
    hasPermission: store.hasPermission,
    hasAnyPermission: store.hasAnyPermission,
    hasAllPermissions: store.hasAllPermissions,

    // Convenience methods for common permission checks
    isAdmin: () => store.hasPermission(RoleNames.Admin),
    isSupplier: () => store.hasPermission(RoleNames.Supplier),
    isCustomer: () => store.hasPermission(RoleNames.Customer),

    // Utility methods
    getPermissionCount: () => store.permissions.length,
    hasNoPermissions: () => store.permissions.length === 0,
  };
}
