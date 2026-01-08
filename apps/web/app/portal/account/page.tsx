"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserIcon,
  BuildingOfficeIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { trackEvent } from "@/lib/analytics/posthog";
import { Trash2 } from "lucide-react";

export default function AccountPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [organization, setOrganization] = useState<any | null>(null);
  const [addresses, setAddresses] = useState<any[]>([]);

  // Determine active tab from pathname
  useEffect(() => {
    const pathSegments = pathname?.split("/") || [];
    const lastSegment = pathSegments[pathSegments.length - 1];

    if (lastSegment === "account") {
      setActiveTab("profile");
    } else if (["profile", "organization", "shipping"].includes(lastSegment)) {
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

      const [profileRes, orgRes, addressRes] = await Promise.all([
        api.get("/profile"), // Changed from /auth/profile to /profile
        api.get("/org/current"),
        api.get("/orders/shipping_address"),
      ]);

      setProfile(profileRes.data);
      setOrganization(orgRes.data);
      if (addressRes.data && addressRes.data.data) {
        setAddresses(addressRes.data.data);
      }

      trackEvent("account_home_view", {
        has_profile: !!profileRes.data,
        has_org: !!orgRes.data,
      });
    } catch (error: any) {
      console.error("Error loading account data:", error);
      toast.error("Failed to load account data");
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;

    try {
      await api.delete(`/orders/shipping_address/${id}`);
      setAddresses(addresses.filter((a) => a.id !== id));
      toast.success("Address deleted successfully");
    } catch (error) {
      console.error("Failed to delete address:", error);
      toast.error("Failed to delete address");
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
      case "shipping":
        return <MapPinIcon className="w-4 h-4" />;
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">User</p>
                  <p className="text-xl font-bold text-gray-900 truncate">
                    {profile?.name || "Loading..."}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {profile?.email}
                  </p>
                </div>
                <UserIcon className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Organization
                  </p>
                  <p className="text-xl font-bold text-gray-900 truncate">
                    {organization?.name || "Not set"}
                  </p>
                </div>
                <BuildingOfficeIcon className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Addresses</p>
                  <p className="text-xl font-bold text-gray-900">
                    {addresses.length}
                  </p>
                </div>
                <MapPinIcon className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
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
            <TabsTrigger value="shipping" className="flex items-center gap-2">
              {getTabIcon("shipping")}
              Shipping Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-gray-500">Full Name</p>
                      <p className="font-medium">{profile?.name || "-"}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{profile?.email || "-"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organization" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-gray-500">Organization Name</p>
                      <p className="font-medium">{organization?.name || "-"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shipping" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Shipping Addresses</CardTitle>
              </CardHeader>
              <CardContent>
                {addresses.length === 0 ? (
                  <p className="text-gray-500">No shipping addresses found.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {addresses.map((addr: any) => (
                      <div
                        key={addr.id}
                        className="flex justify-between items-start p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-bold">{addr.name}</p>
                          <p className="text-sm text-gray-600">
                            {[
                              addr.street1,
                              addr.street2,
                              addr.city,
                              addr.state,
                              addr.zip,
                              addr.country,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {addr.phone} {addr.email && `• ${addr.email}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAddress(addr.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
