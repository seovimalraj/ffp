"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

export default function AdminOrganizationSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Organization Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your organization details and preferences
        </p>
      </div>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="orgName">Organization Name</Label>
              <Input id="orgName" defaultValue="CNC Quote Platform" />
            </div>
            <div>
              <Label htmlFor="orgDomain">Domain</Label>
              <Input id="orgDomain" defaultValue="app.frigate.ai" />
            </div>
            <div>
              <Label htmlFor="orgEmail">Contact Email</Label>
              <Input
                id="orgEmail"
                type="email"
                defaultValue="admin@frigate.ai"
              />
            </div>
            <div>
              <Label htmlFor="orgPhone">Phone Number</Label>
              <Input id="orgPhone" defaultValue="+1 (555) 123-4567" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="orgAddress">Address</Label>
              <Input
                id="orgAddress"
                defaultValue="123 Manufacturing St, Industrial Park"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
