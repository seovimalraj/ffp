"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPinIcon,
  Trash2,
  Plus,
  ArrowLeft,
  Phone,
  Mail,
  Home,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics/posthog";
import { useMetaStore } from "@/components/store/title-store";

export default function ShippingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<any[]>([]);
  const { setPageTitle, resetTitle } = useMetaStore();

  useEffect(() => {
    setPageTitle("Shipping Addresses");
    loadAddresses();
    return () => resetTitle();
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const response = await api.get("/orders/shipping_address");
      if (response.data && response.data.data) {
        setAddresses(response.data.data);
      }
      trackEvent("shipping_addresses_view", {
        count: response.data?.data?.length || 0,
      });
    } catch (error: any) {
      console.error("Error loading addresses:", error);
      toast.error("Failed to load shipping addresses");
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
      trackEvent("address_deleted", { address_id: id });
    } catch (error) {
      console.error("Failed to delete address:", error);
      toast.error("Failed to delete address");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-slate-500"
            onClick={() => router.push("/portal/account")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Account
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">
            Shipping Addresses
          </h1>
          <p className="text-slate-500 mt-1">
            Manage your delivery locations for orders and quotes.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200">
          <Plus className="w-4 h-4 mr-2" />
          Add New Address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <Card className="border-dashed border-2 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <MapPinIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              No addresses found
            </h3>
            <p className="text-slate-500 text-center max-w-sm mt-2">
              You haven&apos;t added any shipping addresses yet. Add one to
              speed up your checkout process.
            </p>
            <Button variant="outline" className="mt-6">
              <Plus className="w-4 h-4 mr-2" />
              Add your first address
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {addresses.map((addr) => (
            <Card
              key={addr.id}
              className="group hover:shadow-md transition-shadow border-slate-200 shadow-sm"
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Home className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base font-bold">
                    {addr.name || "Office"}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteAddress(addr.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-slate-600 space-y-0.5">
                    <p>{addr.street1}</p>
                    {addr.street2 && <p>{addr.street2}</p>}
                    <p>
                      {addr.city}, {addr.state} {addr.zip}
                    </p>
                    <p>{addr.country}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-col space-y-2">
                    {addr.phone && (
                      <div className="flex items-center text-xs text-slate-500">
                        <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" />
                        {addr.phone}
                      </div>
                    )}
                    {addr.email && (
                      <div className="flex items-center text-xs text-slate-500">
                        <Mail className="w-3.5 h-3.5 mr-2 text-slate-400" />
                        {addr.email}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
