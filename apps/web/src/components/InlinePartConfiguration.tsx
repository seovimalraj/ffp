"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

interface PartSpecs {
  quantity: number;
  process: "CNC" | "SheetMetal" | "InjectionMolding";
  material: string;
  finish: string;
  threadsInserts: string;
  tolerancePack: "Std" | "Tight" | "Critical";
  surfaceRoughness: string;
  partMarking: string;
  inspection: "Std" | "Formal" | "CMM" | "FAIR" | "Source" | "Custom";
  certificates: string[];
  notes: string;
}

interface PricingBreakdown {
  setup_time_min: number;
  cycle_time_min: number;
  machine_rate_per_hr: number;
  material_buy_cost: number;
  material_waste_factor: number;
  tooling_wear_cost: number;
  finish_cost: number;
  inspection_cost: number;
  risk_adder: number;
  overhead: number;
  margin: number;
  unit_price: number;
}

interface InlinePartConfigurationProps {
  quoteId: string;
  lineId: string;
  initialSpecs?: Partial<PartSpecs>;
  onSpecsChange?: (specs: PartSpecs) => void;
  onSave?: () => void;
}

const materials = [
  "Aluminum 6061-T6",
  "Aluminum 7075-T6",
  "Steel 1018",
  "Steel 4140",
  "Stainless Steel 304",
  "Stainless Steel 316",
  "Brass 360",
  "Copper 110",
  "Titanium Grade 2",
  "ABS",
  "Nylon 6/6",
  "PC (Polycarbonate)",
  "PEEK",
  "PTFE (Teflon)",
];

const finishes = [
  "None",
  "Anodized Clear",
  "Anodized Black",
  "Anodized Blue",
  "Powder Coat",
  "Plated Nickel",
  "Plated Chrome",
  "Plated Gold",
  "Polished",
];

const certificates = [
  "Material Test Report",
  "Certificate of Conformance",
  "First Article Inspection",
  "PPAP Level 1",
  "PPAP Level 2",
  "PPAP Level 3",
  "ISO 9001",
  "AS9100",
];

export default function InlinePartConfiguration({
  quoteId,
  lineId,
  initialSpecs,
  onSpecsChange,
  onSave,
}: InlinePartConfigurationProps) {
  const [specs, setSpecs] = useState<PartSpecs>({
    quantity: 1,
    process: "CNC",
    material: "",
    finish: "None",
    threadsInserts: "",
    tolerancePack: "Std",
    surfaceRoughness: "125",
    partMarking: "",
    inspection: "Std",
    certificates: [],
    notes: "",
    ...initialSpecs,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [pricePreview, setPricePreview] = useState<PricingBreakdown | null>(
    null,
  );

  useEffect(() => {
    // Autosave when specs change
    const timeoutId = setTimeout(() => {
      handleAutosave();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [specs]);

  const handleAutosave = async () => {
    try {
      setIsSaving(true);

      // Update line specs
      await fetch(`/api/quotes/${quoteId}/lines/${lineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(specs),
      });

      // Trigger re-pricing
      const priceResponse = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: quoteId,
          line_id: lineId,
          specs,
        }),
      });

      if (priceResponse.ok) {
        const newPricing = await priceResponse.json();
        setPricePreview(newPricing);
      }

      setLastSaved(new Date());
      onSpecsChange?.(specs);
    } catch (error) {
      console.error("Autosave failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSpecChange = (field: keyof PartSpecs, value: any) => {
    setSpecs((prev) => ({ ...prev, [field]: value }));
  };

  const handleCertificateToggle = (certificate: string) => {
    setSpecs((prev) => ({
      ...prev,
      certificates: prev.certificates.includes(certificate)
        ? prev.certificates.filter((c) => c !== certificate)
        : [...prev.certificates, certificate],
    }));
  };

  const handleSave = () => {
    handleAutosave();
    onSave?.();
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Part Configuration</span>
          <div className="flex items-center space-x-2">
            {lastSaved && (
              <span className="text-sm text-green-600 flex items-center">
                <CheckCircleIcon className="w-4 h-4 mr-1" />
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {isSaving && (
              <div className="flex items-center text-sm text-blue-600">
                <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quantity and Process Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={specs.quantity}
              onChange={(e) =>
                handleSpecChange("quantity", parseInt(e.target.value) || 1)
              }
            />
          </div>
          <div>
            <Label htmlFor="process">Process</Label>
            <Select
              value={specs.process}
              onValueChange={(value) => handleSpecChange("process", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CNC">CNC Machining</SelectItem>
                <SelectItem value="SheetMetal">Sheet Metal</SelectItem>
                <SelectItem value="InjectionMolding">
                  Injection Molding
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Material and Finish Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="material">Material</Label>
            <Select
              value={specs.material}
              onValueChange={(value) => handleSpecChange("material", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {materials.map((material) => (
                  <SelectItem key={material} value={material}>
                    {material}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="finish">Finish</Label>
            <Select
              value={specs.finish}
              onValueChange={(value) => handleSpecChange("finish", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {finishes.map((finish) => (
                  <SelectItem key={finish} value={finish}>
                    {finish}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tolerance and Surface Roughness Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="tolerancePack">Tolerance Package</Label>
            <Select
              value={specs.tolerancePack}
              onValueChange={(value) =>
                handleSpecChange("tolerancePack", value as any)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Std">Standard (±0.005")</SelectItem>
                <SelectItem value="Tight">Tight (±0.002")</SelectItem>
                <SelectItem value="Critical">Critical (±0.001")</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="surfaceRoughness">Surface Roughness (µin)</Label>
            <Select
              value={specs.surfaceRoughness}
              onValueChange={(value) =>
                handleSpecChange("surfaceRoughness", value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="125">125 µin (Standard)</SelectItem>
                <SelectItem value="63">63 µin (Fine)</SelectItem>
                <SelectItem value="32">32 µin (Very Fine)</SelectItem>
                <SelectItem value="16">16 µin (Mirror)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Part Marking and Inspection Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="partMarking">Part Marking</Label>
            <Input
              id="partMarking"
              placeholder="Serial numbers, logos, etc."
              value={specs.partMarking}
              onChange={(e) => handleSpecChange("partMarking", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="inspection">Inspection Level</Label>
            <Select
              value={specs.inspection}
              onValueChange={(value) =>
                handleSpecChange("inspection", value as any)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Std">Standard</SelectItem>
                <SelectItem value="Formal">Formal</SelectItem>
                <SelectItem value="CMM">CMM Inspection</SelectItem>
                <SelectItem value="FAIR">
                  First Article Inspection Report
                </SelectItem>
                <SelectItem value="Source">Source Inspection</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Threads & Inserts */}
        <div>
          <Label htmlFor="threadsInserts">Threads & Inserts</Label>
          <Textarea
            id="threadsInserts"
            placeholder="Specify any threads, inserts, or special features..."
            value={specs.threadsInserts}
            onChange={(e) => handleSpecChange("threadsInserts", e.target.value)}
            rows={2}
          />
        </div>

        {/* Certificates */}
        <div>
          <Label>Certificates & Documentation</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {certificates.map((certificate) => (
              <div key={certificate} className="flex items-center space-x-2">
                <Checkbox
                  id={certificate}
                  checked={specs.certificates.includes(certificate)}
                  onCheckedChange={() => handleCertificateToggle(certificate)}
                />
                <Label htmlFor={certificate} className="text-sm">
                  {certificate}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Any special instructions or requirements..."
            value={specs.notes}
            onChange={(e) => handleSpecChange("notes", e.target.value)}
            rows={2}
          />
        </div>

        {/* Price Preview */}
        {pricePreview && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Price Preview</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Unit Price</p>
                <p className="text-lg font-semibold text-green-600">
                  ${pricePreview.unit_price.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Price</p>
                <p className="text-lg font-semibold">
                  ${(pricePreview.unit_price * specs.quantity).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Cycle Time</p>
                <p className="text-sm font-medium">
                  {pricePreview.cycle_time_min} min
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            <CheckIcon className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
