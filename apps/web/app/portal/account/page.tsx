"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserIcon,
  BuildingOfficeIcon,
  UsersIcon,
  KeyIcon,
  BellIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import type { UserProfile, Organization, Member } from "@/types/order";
import { trackEvent } from "@/lib/analytics/posthog";

const ITEMS_PER_PAGE = 25;

export default function AccountPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [_profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [_members, setMembers] = useState<Member[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);

  // Determine active tab from pathname
  useEffect(() => {
    const pathSegments = pathname?.split("/") || [];
    const lastSegment = pathSegments[pathSegments.length - 1];

    if (lastSegment === "account") {
      setActiveTab("profile");
    } else if (
      [
        "profile",
        "organization",
        "team",
        "api-tokens",
        "notifications",
        "templates",
      ].includes(lastSegment)
    ) {
      setActiveTab(lastSegment);
    }
  }, [pathname]);

  // Load initial data
  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    try {
      setLoading(true);

      const [profileRes, orgRes, membersRes] = await Promise.all([
        api.get<UserProfile>("/auth/profile"),
        api.get<Organization>("/org/current"),
        api.get<{ members: Member[]; total: number }>(
          `/org/members?limit=${ITEMS_PER_PAGE}`,
        ),
      ]);

      setProfile(profileRes.data);
      setOrganization(orgRes.data);
      setMembers(membersRes.data.members);
      setMembersTotal(membersRes.data.total);

      trackEvent("account_home_view", {
        has_profile: !!profileRes.data,
        has_org: !!orgRes.data,
        member_count: membersRes.data.total,
      });
    } catch (error: any) {
      console.error("Error loading account data:", error);
      toast.error("Failed to load account data");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/portal/account/${value === "profile" ? "" : value}`);
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case "profile":
        return <UserIcon className="w-4 h-4" />;
      case "organization":
        return <BuildingOfficeIcon className="w-4 h-4" />;
      case "team":
        return <UsersIcon className="w-4 h-4" />;
      case "api-tokens":
        return <KeyIcon className="w-4 h-4" />;
      case "notifications":
        return <BellIcon className="w-4 h-4" />;
      case "templates":
        return <DocumentTextIcon className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Account & Organization
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your profile, organization settings, team members, and
            preferences.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Organization
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {organization?.name || "Not set"}
                  </p>
                </div>
                <BuildingOfficeIcon className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Team Members
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {membersTotal}
                  </p>
                </div>
                <UsersIcon className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Default Currency
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {organization?.default_currency || "USD"}
                  </p>
                </div>
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-bold text-sm">
                    {organization?.default_currency?.[0] || "$"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Compliance Mode
                  </p>
                  <div className="flex gap-2 mt-1">
                    {organization?.itar_mode && (
                      <Badge variant="destructive" className="text-xs">
                        ITAR
                      </Badge>
                    )}
                    {organization?.onshore_only && (
                      <Badge variant="secondary" className="text-xs">
                        Onshore
                      </Badge>
                    )}
                    {!organization?.itar_mode &&
                      !organization?.onshore_only && (
                        <Badge variant="outline" className="text-xs">
                          Standard
                        </Badge>
                      )}
                  </div>
                </div>
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 font-bold text-sm">!</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              {getTabIcon("profile")}
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="organization"
              className="flex items-center gap-2"
            >
              {getTabIcon("organization")}
              Organization
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              {getTabIcon("team")}
              Team & Roles
            </TabsTrigger>
            <TabsTrigger value="api-tokens" className="flex items-center gap-2">
              {getTabIcon("api-tokens")}
              API Tokens
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex items-center gap-2"
            >
              {getTabIcon("notifications")}
              Notifications
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              {getTabIcon("templates")}
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Configure your personal profile and authentication settings.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => router.push("/portal/account/profile")}
                >
                  Manage Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organization" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Manage your organization's details, defaults, and compliance
                  settings.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => router.push("/portal/account/organization")}
                >
                  Manage Organization
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Invite team members and manage roles and permissions.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => router.push("/portal/account/team")}
                >
                  Manage Team
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api-tokens" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>API Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Create and manage API tokens for programmatic access.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => router.push("/portal/account/api-tokens")}
                >
                  Manage API Tokens
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Configure your email notification preferences.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => router.push("/portal/account/notifications")}
                >
                  Manage Notifications
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Saved Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Manage your saved material, finish, and inspection templates.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => router.push("/portal/account/templates")}
                >
                  Manage Templates
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
