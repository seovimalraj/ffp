"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface OrgMember {
  id: string;
  role: "admin" | "engineer" | "buyer";
  users: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  orgs: {
    id: string;
    name: string;
    domain?: string;
  };
}

export function OrgSwitcher() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMemberships();
    }
  }, [user]);

  const fetchMemberships = async () => {
    try {
      const response = await fetch("/api/orgs/members");
      if (response.ok) {
        const data = await response.json();
        setMemberships(data);
      }
    } catch (error) {
      console.error("Failed to fetch memberships:", error);
    } finally {
      setLoading(false);
    }
  };

  const switchOrg = async (orgId: string) => {
    // In a real implementation, you'd update the user's current org context
    // For now, just log it
    console.log("Switching to org:", orgId);
  };

  if (loading) {
    return <div>Loading organizations...</div>;
  }

  if (memberships.length <= 1) {
    return null; // Don't show switcher if user only has one org
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">Organization:</span>
      <Select onValueChange={switchOrg} defaultValue={user?.org?.id}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select organization" />
        </SelectTrigger>
        <SelectContent>
          {memberships.map((membership) => (
            <SelectItem key={membership.orgs.id} value={membership.orgs.id}>
              {membership.orgs.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
