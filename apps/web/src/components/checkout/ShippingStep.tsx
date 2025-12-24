"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  TruckIcon,
  ClockIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

interface ShippingStepProps {
  readonly quote: any;
  readonly onSave: (data: any) => void;
  readonly saving: boolean;
}

interface Address {
  readonly company?: string;
  readonly attention?: string;
  readonly street1: string;
  readonly street2?: string;
  readonly city: string;
  readonly state_province?: string;
  readonly postal_code: string;
  readonly country: string;
  readonly phone?: string;
}

interface ShippingRate {
  readonly id: string;
  readonly carrier: string;
  readonly service: string;
  readonly eta: string;
  readonly cost_estimate: number;
  readonly business_days: number;
}

export function ShippingStep({ onSave, saving }: ShippingStepProps) {
  const [shippingAddress, setShippingAddress] = useState<Address>({
    company: "",
    attention: "",
    street1: "",
    street2: "",
    city: "",
    state_province: "",
    postal_code: "",
    country: "US",
    phone: "",
  });

  const [incoterm, setIncoterm] = useState("DAP");
  const [selectedShippingRate, setSelectedShippingRate] = useState<string>("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);

  // Mock shipping rates
  const mockShippingRates: ShippingRate[] = [
    {
      id: "rate-1",
      carrier: "FedEx",
      service: "Ground",
      eta: "3-5 business days",
      cost_estimate: 45.0,
      business_days: 5,
    },
    {
      id: "rate-2",
      carrier: "UPS",
      service: "Ground",
      eta: "2-3 business days",
      cost_estimate: 65.0,
      business_days: 3,
    },
    {
      id: "rate-3",
      carrier: "FedEx",
      service: "Express",
      eta: "1-2 business days",
      cost_estimate: 125.0,
      business_days: 2,
    },
  ];

  useEffect(() => {
    // Load shipping rates when address is filled
    if (
      shippingAddress.street1 &&
      shippingAddress.city &&
      shippingAddress.postal_code
    ) {
      loadShippingRates();
    }
  }, [shippingAddress]);

  const loadShippingRates = async () => {
    setLoadingRates(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setShippingRates(mockShippingRates);
    setLoadingRates(false);
  };

  const handleAddressChange = (field: keyof Address, value: string) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const handleUseBillingAddress = () => {
    // In real implementation: copy from billing address
    setShippingAddress({
      company: "Acme Manufacturing Corp",
      attention: "John Doe",
      street1: "123 Industrial Blvd",
      street2: "Suite 100",
      city: "Springfield",
      state_province: "IL",
      postal_code: "62701",
      country: "US",
      phone: "+1-555-0123",
    });
  };

  const handleSaveAddress = () => {
    // In real implementation: POST to save address
    alert("Address saved to address book");
  };

  const handleSave = () => {
    // Basic validation
    if (
      !shippingAddress.street1 ||
      !shippingAddress.city ||
      !shippingAddress.postal_code ||
      !shippingAddress.country
    ) {
      alert("Please fill in all required shipping address fields.");
      return;
    }

    if (shippingAddress.country === "US" && !shippingAddress.state_province) {
      alert("State is required for US addresses.");
      return;
    }

    if (!selectedShippingRate) {
      alert("Please select a shipping method.");
      return;
    }

    onSave({
      shipping: {
        address: shippingAddress,
        incoterm,
        shipping_rate_id: selectedShippingRate,
        delivery_notes: deliveryNotes,
      },
    });
  };

  const getIncotermDescription = (term: string) => {
    const descriptions: Record<string, string> = {
      EXW: "Ex Works - Seller makes goods available at their location",
      FOB: "Free on Board - Seller delivers to port of shipment",
      DAP: "Delivered at Place - Seller delivers to buyer's location (no import duties)",
      DDP: "Delivered Duty Paid - Seller handles everything including import duties",
    };
    return descriptions[term] || "";
  };

  const renderShippingRates = () => {
    if (loadingRates) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading shipping rates...</p>
        </div>
      );
    }

    if (shippingRates.length > 0) {
      return (
        <RadioGroup
          value={selectedShippingRate}
          onValueChange={setSelectedShippingRate}
        >
          <div className="space-y-3">
            {shippingRates.map((rate) => (
              <div
                key={rate.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedShippingRate === rate.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value={rate.id} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">
                          {rate.carrier} {rate.service}
                        </span>
                        <Badge variant="secondary">
                          {rate.business_days} days
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          ${rate.cost_estimate.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="h-4 w-4" />
                        <span>{rate.eta}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <CurrencyDollarIcon className="h-4 w-4" />
                        <span>${rate.cost_estimate.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>
      );
    }

    return (
      <div className="text-center py-8 text-gray-500">
        <TruckIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>Fill in shipping address to load rates</p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TruckIcon className="h-5 w-5" />
          <span>Shipping Address / Methods / Incoterms</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Shipping Address */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Shipping Address</h3>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUseBillingAddress}
              >
                Use Billing Address
              </Button>
              <Button variant="outline" size="sm" onClick={handleSaveAddress}>
                Save to Address Book
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ship-company">Company</Label>
              <Input
                id="ship-company"
                value={shippingAddress.company}
                onChange={(e) => handleAddressChange("company", e.target.value)}
                placeholder="Company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ship-attention">Attention</Label>
              <Input
                id="ship-attention"
                value={shippingAddress.attention}
                onChange={(e) =>
                  handleAddressChange("attention", e.target.value)
                }
                placeholder="Contact person"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ship-street1">Street Address *</Label>
              <Input
                id="ship-street1"
                value={shippingAddress.street1}
                onChange={(e) => handleAddressChange("street1", e.target.value)}
                placeholder="Street address"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ship-street2">Street Address 2</Label>
              <Input
                id="ship-street2"
                value={shippingAddress.street2}
                onChange={(e) => handleAddressChange("street2", e.target.value)}
                placeholder="Apartment, suite, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ship-city">City *</Label>
              <Input
                id="ship-city"
                value={shippingAddress.city}
                onChange={(e) => handleAddressChange("city", e.target.value)}
                placeholder="City"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ship-state">State/Province</Label>
              <Input
                id="ship-state"
                value={shippingAddress.state_province}
                onChange={(e) =>
                  handleAddressChange("state_province", e.target.value)
                }
                placeholder="State or Province"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ship-postal">Postal Code *</Label>
              <Input
                id="ship-postal"
                value={shippingAddress.postal_code}
                onChange={(e) =>
                  handleAddressChange("postal_code", e.target.value)
                }
                placeholder="Postal code"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ship-country">Country *</Label>
              <Select
                value={shippingAddress.country}
                onValueChange={(value) => handleAddressChange("country", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="DE">Germany</SelectItem>
                  <SelectItem value="FR">France</SelectItem>
                  <SelectItem value="JP">Japan</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ship-phone">Phone</Label>
              <Input
                id="ship-phone"
                value={shippingAddress.phone}
                onChange={(e) => handleAddressChange("phone", e.target.value)}
                placeholder="Phone number"
                type="tel"
              />
            </div>
          </div>
        </div>

        {/* Incoterms */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Incoterms</h3>

          <div className="space-y-2">
            <Select value={incoterm} onValueChange={setIncoterm}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Select incoterm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXW">EXW - Ex Works</SelectItem>
                <SelectItem value="FOB">FOB - Free on Board</SelectItem>
                <SelectItem value="DAP">DAP - Delivered at Place</SelectItem>
                <SelectItem value="DDP">DDP - Delivered Duty Paid</SelectItem>
              </SelectContent>
            </Select>

            <p className="text-sm text-gray-600">
              {getIncotermDescription(incoterm)}
            </p>

            {incoterm === "DDP" && shippingAddress.country !== "US" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> DDP includes import duties and
                  brokerage fees that will be added to your invoice.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Shipping Methods */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Shipping Method</h3>

          {renderShippingRates()}
        </div>

        {/* Delivery Notes */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Delivery Notes (optional)</h3>

          <div className="space-y-2">
            <Textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Any special delivery instructions..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500">
              {deliveryNotes.length}/500 characters
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline">Back</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedShippingRate}
          >
            {saving ? "Saving..." : "Save & Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
