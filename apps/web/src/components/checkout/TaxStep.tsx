"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CalculatorIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@/lib/format/currency";

interface TaxStepProps {
  readonly quote: any;
  readonly onSave: (data: any) => void;
  readonly saving: boolean;
}

export function TaxStep({ quote, onSave, saving }: TaxStepProps) {
  const [taxId, setTaxId] = useState("");
  const [exemptToggle, setExemptToggle] = useState(false);
  const [uploadedCertificate, setUploadedCertificate] = useState<File | null>(
    null,
  );
  const currency = quote.currency ?? "USD";

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a PDF, PNG, or JPG file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      alert("File size must be less than 10MB.");
      return;
    }

    setUploadedCertificate(file);
  };

  const handleSave = () => {
    // Basic validation
    if (taxId && !isValidTaxId(taxId)) {
      alert("Please enter a valid tax ID format.");
      return;
    }

    if (exemptToggle && !uploadedCertificate) {
      alert("Please upload a tax exemption certificate.");
      return;
    }

    onSave({
      tax: {
        tax_id_value: taxId,
        exempt_toggle: exemptToggle,
        certificate_file_id: uploadedCertificate?.name, // In real implementation: file upload response
      },
    });
  };

  const isValidTaxId = (id: string) => {
    // Basic validation - in real implementation: server-side validation by region
    const cleanId = id.replace(/[^a-zA-Z0-9]/g, "");
    return cleanId.length >= 5 && cleanId.length <= 20;
  };

  const getTaxIdPlaceholder = () => {
    // In real implementation: based on shipping address country
    return "US: EIN or Resale Cert; EU: VAT; CA: GST/HST";
  };

  const getTaxIdHelp = () => {
    // In real implementation: based on shipping address country
    return "Validated server-side by region-specific regex/API.";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CalculatorIcon className="h-5 w-5" />
          <span>Tax ID / Exemption</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Tax Identification */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Tax Identification</h3>

          <div className="space-y-2">
            <Label htmlFor="tax-id">Tax/VAT/GST ID</Label>
            <Input
              id="tax-id"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder={getTaxIdPlaceholder()}
              maxLength={50}
            />
            <p className="text-sm text-gray-600">{getTaxIdHelp()}</p>
          </div>
        </div>

        {/* Tax Exemption */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Tax Exemption</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="exempt-toggle" className="text-sm font-medium">
                  Claim tax exemption for this order
                </Label>
                <p className="text-sm text-gray-600">
                  Upload a valid tax exemption certificate if claiming
                  exemption.
                </p>
              </div>
              <Switch
                id="exempt-toggle"
                checked={exemptToggle}
                onCheckedChange={setExemptToggle}
              />
            </div>

            {exemptToggle && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <CloudArrowUpIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {uploadedCertificate
                        ? "Certificate uploaded"
                        : "Drop certificate here or click to browse"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Supported: PDF, PNG, JPG (max 10MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                    id="certificate-upload"
                  />
                  <label htmlFor="certificate-upload">
                    <Button variant="outline" className="mt-4" asChild>
                      <span>
                        {uploadedCertificate ? "Change File" : "Browse Files"}
                      </span>
                    </Button>
                  </label>
                </div>

                {uploadedCertificate && (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center space-x-3">
                      <DocumentTextIcon className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="text-sm font-medium text-green-800">
                          {uploadedCertificate.name}
                        </div>
                        <div className="text-xs text-green-600">
                          {(uploadedCertificate.size / 1024 / 1024).toFixed(2)}{" "}
                          MB
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadedCertificate(null)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tax Calculation Preview */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Tax Calculation Preview
          </h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(quote.item_subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping:</span>
              <span>{formatCurrency(quote.estimated_shipping, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Tax:</span>
              <span className={exemptToggle ? "text-green-600" : ""}>
                {exemptToggle
                  ? `${formatCurrency(0, currency)} (exempt)`
                  : formatCurrency(quote.estimated_tax, currency)}
              </span>
            </div>
            <div className="border-t pt-1 mt-2">
              <div className="flex justify-between font-medium">
                <span>Total:</span>
                <span>
                  {formatCurrency(
                    quote.item_subtotal +
                      quote.estimated_shipping +
                      (exemptToggle ? 0 : quote.estimated_tax),
                    currency,
                  )}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Final tax calculation will be performed at order processing based on
            exact shipping address and exemption validation.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline">Back</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save & Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
