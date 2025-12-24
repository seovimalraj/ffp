"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BellIcon,
  ArrowLeftIcon,
  EnvelopeIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import type { EmailPref } from "@/types/order";
import { trackEvent } from "@/lib/analytics/posthog";

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<EmailPref["events"]>({
    quote_sent: true,
    payment_succeeded: true,
    order_status_changed: true,
    weekly_digest: false,
  });

  // Load preferences
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.get<EmailPref>("/notifications/preferences");
      setPreferences(response.data.events);
      trackEvent("notifications_view");
    } catch (error: any) {
      console.error("Error loading preferences:", error);
      toast.error("Failed to load notification preferences");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put("/notifications/preferences", { events: preferences });
      toast.success("Notification preferences updated successfully");
      trackEvent("notifications_saved", { preferences });
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to update notification preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/portal/account")}
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Account
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Email Notifications
          </h1>
          <p className="text-gray-600 mt-2">
            Configure your email notification preferences for account activity.
          </p>
        </div>

        {/* Event Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EnvelopeIcon className="w-5 h-5" />
              Event Notifications
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Get notified about important account events and updates.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="quote-sent" className="text-base font-medium">
                  Quote sent to me
                </Label>
                <p className="text-sm text-gray-600">
                  Receive notifications when quotes are sent to your account
                </p>
              </div>
              <Switch
                id="quote-sent"
                checked={preferences.quote_sent}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, quote_sent: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label
                  htmlFor="payment-succeeded"
                  className="text-base font-medium"
                >
                  Payment succeeded
                </Label>
                <p className="text-sm text-gray-600">
                  Get notified when payments are processed successfully
                </p>
              </div>
              <Switch
                id="payment-succeeded"
                checked={preferences.payment_succeeded}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, payment_succeeded: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label
                  htmlFor="order-status-changed"
                  className="text-base font-medium"
                >
                  Order status updates
                </Label>
                <p className="text-sm text-gray-600">
                  Receive updates when your order status changes
                </p>
              </div>
              <Switch
                id="order-status-changed"
                checked={preferences.order_status_changed}
                onCheckedChange={(checked) =>
                  setPreferences({
                    ...preferences,
                    order_status_changed: checked,
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Digest Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="w-5 h-5" />
              Digests
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Receive periodic summaries of your account activity.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label
                  htmlFor="weekly-digest"
                  className="text-base font-medium"
                >
                  Weekly activity summary
                </Label>
                <p className="text-sm text-gray-600">
                  Get a weekly email with a summary of your account activity
                </p>
              </div>
              <Switch
                id="weekly-digest"
                checked={preferences.weekly_digest}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, weekly_digest: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <BellIcon className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900">
                  Notification Settings
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  You can update your notification preferences at any time.
                  Changes will take effect immediately for new notifications.
                </p>
                <div className="mt-3 text-xs text-gray-500">
                  <p>
                    • Instant notifications are sent within minutes of the event
                  </p>
                  <p>• Digest emails are sent on a weekly schedule</p>
                  <p>
                    • You can unsubscribe from individual notifications at any
                    time
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </div>
    </div>
  );
}
