'use client'

import { useSession } from "next-auth/react";
import { usePermissions } from "./hooks/use-permissions";
import { useEffect, useState } from 'react'

interface PermissionsGuardProps {
    children: React.ReactNode;
    permissions?: string | string[];
    requireAll?: boolean;
    fallback?: React.ReactNode;
    loading?: React.ReactNode;
    roleCheck?: string;
}

/**
 * PermissionsGuard component that conditionally renders children based on user permissions
 * 
 * @param children - Content to render if user has required permissions
 * @param permissions - Single permission or array of permissions to check
 * @param requireAll - If true, user must have ALL permissions. If false, user needs ANY permission (default: false)
 * @param fallback - Content to render if user doesn't have required permissions
 * @param loading - Content to render while permissions are loading
 */
export function PermissionsGuard({
    children,
    permissions,
    requireAll = false,
    fallback = null,
    loading = null,
    roleCheck = undefined
}: PermissionsGuardProps) {

    // Ensure hooks order is stable — call session hook at top-level
    const { data, status } = useSession();
    const { isLoading, hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

    // Avoid hydration mismatch by waiting for client mount before rendering
    // client-only derived state (permissions/session) dependent UI.
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // While not mounted, render the provided `loading` or `fallback` to keep
    // server and client HTML consistent and avoid hydration errors.
    if (!mounted || status === 'loading') {
        return <>{loading ?? fallback ?? null}</>;
    }

    // Show loading state if permissions are being fetched (after mount)
    if (isLoading && loading) {
        return <>{loading}</>;
    }

    // If no permissions specified, always render children
    if (!permissions) {
        return <>{children}</>;
    }

    if (roleCheck) {
        const hasRequiredRole = data?.user?.role === roleCheck;
        if (!hasRequiredRole) {
            return <>{fallback}</>;
        }
    }
    // Convert single permission to array for consistent handling
    const permissionArray = Array.isArray(permissions) ? permissions : [permissions];

    // Check permissions based on requireAll flag
    const hasRequiredPermissions = requireAll
        ? hasAllPermissions(permissionArray)
        : permissionArray.length === 1
            ? hasPermission(permissionArray[0])
            : hasAnyPermission(permissionArray);

    // Render children if user has required permissions, otherwise render fallback
    return hasRequiredPermissions ? <>{children}</> : <>{fallback}</>;
}

interface CommonCheckProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function AdminOnly({ children, fallback }: CommonCheckProps) {
    return (
        <PermissionsGuard roleCheck="admin" fallback={fallback}>
            {children}
        </PermissionsGuard>
    )
}
export function SupplierOnly({ children, fallback }: CommonCheckProps) {
    return (
        <PermissionsGuard roleCheck="supplier" fallback={fallback}>
            {children}
        </PermissionsGuard>
    )
}
export function CustomerOnly({ children, fallback }: CommonCheckProps) {
    return (
        <PermissionsGuard roleCheck="customer" fallback={fallback}>
            {children}
        </PermissionsGuard>
    )
}
