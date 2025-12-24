import { create } from "zustand"
import { persist } from "zustand/middleware"
import { apiClient } from "@/lib/api"
import { PERMISSION_ALIASES, PermissionsNames } from "@cnc-quote/shared";

export interface Permission {
    code: string,
    name?: string,
    description?: string
}

interface PermissionsState {
  permissions: string[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  
  // Actions
  fetchPermissions: () => Promise<void>;
  clearPermissions: () => void;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  hasAllPermissions: (permissionCodes: string[]) => boolean;
}

export const usePermissionsStore = create<PermissionsState>()(
  persist(
    (set, get) => ({
      permissions: [],
      isLoading: false,
      error: null,
      lastFetched: null,

      fetchPermissions: async () => {
        const state = get();
        
        // Avoid fetching if already loading
        if (state.isLoading) return;

        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get('/permissions/me');
          const permissions = response.data.permissions || [];
          
          set({
            permissions,
            isLoading: false,
            error: null,
            lastFetched: Date.now(),
          });
        } catch (error: any) {
          console.error('Failed to fetch permissions:', error);
          set({
            isLoading: false,
            error: error.response?.data?.message || error.message || 'Failed to fetch permissions',
          });
        }
      },

      clearPermissions: () => {
        set({
          permissions: [],
          error: null,
          lastFetched: null,
        });
      },

      hasPermission: (permissionCode: string) => {
        const { permissions } = get();

        const aliases = PERMISSION_ALIASES[permissionCode] || [];

        // Global bypass: admin or org full access grants everything
        if (permissions.includes(PermissionsNames.adminFullAccess) || permissions.includes(PermissionsNames.organizationFullAccess)) {
          return true;
        }

        // Direct permission present
        if (permissions.includes(permissionCode)) return true;

        // If any alias for this permission is held by the user (e.g. warehouse.access.allmight),
        // consider the permission granted. This handles domain-level "allmight" entries.
        
        if (aliases.some((alias) => permissions.includes(alias))) return true;

        return false;
      },

      hasAnyPermission: (permissionCodes: string[]) => {
        // Use `hasPermission` for each code so aliases and all-mighty checks are applied consistently.
        return permissionCodes.some((code) => get().hasPermission(code));
      },

      hasAllPermissions: (permissionCodes: string[]) => {
        // Use `hasPermission` for each code so aliases and all-mighty checks are applied consistently.
        return permissionCodes.every((code) => get().hasPermission(code));
      },
    }),
    {
      name: 'permissions-store',
      partialize: (state) => ({
        permissions: state.permissions,
        lastFetched: state.lastFetched,
      }),
    }
  )
);
