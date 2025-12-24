/**
 * Organization Switcher Component
 *
 * Allows users to switch between organizations they belong to.
 * Works with multi-tenant RBAC system.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export default function OrgSwitcher() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's organizations on mount
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        setLoading(true);
        const response = await fetch("/api/organizations/my-orgs");
        if (!response.ok) throw new Error("Failed to fetch organizations");

        const data = await response.json();
        setOrganizations(data.organizations || []);

        // Set current org from session or first org
        const currentOrg =
          (session as any)?.user?.org_id || data.organizations[0]?.id;
        setCurrentOrgId(currentOrg);
      } catch (err) {
        console.error("Error fetching organizations:", err);
        setError("Failed to load organizations");
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchOrganizations();
    }
  }, [session]);

  // Switch to a different organization
  async function switchOrg(orgId: string) {
    if (orgId === currentOrgId) return; // Already on this org

    try {
      setLoading(true);

      // Update session on backend
      const response = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId }),
      });

      if (!response.ok) throw new Error("Failed to switch organization");

      // Update session in NextAuth
      await updateSession({
        ...session,
        user: {
          ...(session?.user || {}),
          org_id: orgId,
        },
      });

      setCurrentOrgId(orgId);

      // Refresh the page to reload org-specific data
      router.refresh();
    } catch (err) {
      console.error("Error switching organization:", err);
      setError("Failed to switch organization");
    } finally {
      setLoading(false);
    }
  }

  if (loading && organizations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        Loading...
      </div>
    );
  }

  if (error) {
    return <div className="px-3 py-2 text-sm text-red-600">{error}</div>;
  }

  if (organizations.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-gray-500">No organizations</div>
    );
  }

  if (organizations.length === 1) {
    // Single org: just display the name
    return (
      <div className="px-3 py-2 text-sm font-medium text-gray-900">
        {organizations[0].name}
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={currentOrgId || ""}
        onChange={(e) => switchOrg(e.target.value)}
        disabled={loading}
        className="block w-full px-3 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Select organization"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name} {org.role && `(${org.role})`}
          </option>
        ))}
      </select>

      {loading && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for sidebar or mobile
 */
export function OrgSwitcherCompact() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch("/api/organizations/my-orgs");
        if (!response.ok) throw new Error("Failed to fetch organizations");

        const data = await response.json();
        setOrganizations(data.organizations || []);

        const currentOrg =
          (session as any)?.user?.org_id || data.organizations[0]?.id;
        setCurrentOrgId(currentOrg);
      } catch (err) {
        console.error("Error fetching organizations:", err);
      }
    }

    if (session) {
      fetchOrganizations();
    }
  }, [session]);

  async function switchOrg(orgId: string) {
    if (orgId === currentOrgId) {
      setIsOpen(false);
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId }),
      });

      if (!response.ok) throw new Error("Failed to switch organization");

      await updateSession({
        ...session,
        user: {
          ...(session?.user || {}),
          org_id: orgId,
        },
      });

      setCurrentOrgId(orgId);
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Error switching organization:", err);
    } finally {
      setLoading(false);
    }
  }

  if (organizations.length <= 1) return null;

  const currentOrg = organizations.find((org) => org.id === currentOrgId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span className="truncate flex-1 text-left">
          {currentOrg?.name || "Select org"}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-64 overflow-y-auto">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => switchOrg(org.id)}
                disabled={loading}
                className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 disabled:opacity-50 ${
                  org.id === currentOrgId
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-900"
                }`}
              >
                <div className="font-medium">{org.name}</div>
                {org.role && (
                  <div className="text-xs text-gray-500 mt-0.5">{org.role}</div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
