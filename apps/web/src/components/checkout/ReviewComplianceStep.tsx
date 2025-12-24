"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@/lib/format/currency";

interface ReviewComplianceStepProps {
  readonly quote: any;
  readonly onSave: (data: any) => void;
  readonly saving: boolean;
}

export function ReviewComplianceStep({
  quote,
  onSave,
  saving,
}: ReviewComplianceStepProps) {
  const [compliance, setCompliance] = useState({
    itar_onshore_only: false,
    dfars_materials: false,
    export_ack: false,
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const currency = quote.currency ?? "USD";

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleSave = () => {
    if (!compliance.export_ack) {
      alert("Please acknowledge the export certification.");
      return;
    }

    onSave({
      compliance: {
        ...compliance,
        uploaded_files: uploadedFiles,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DocumentTextIcon className="h-5 w-5" />
          <span>Review & Compliance Acknowledgements</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Quote Snapshot */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Quote Snapshot</h3>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <PencilIcon className="h-4 w-4" />
              <span>Edit Quote</span>
            </Button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Quote ID:</span>
                <div className="font-medium">{quote.id}</div>
              </div>
              <div>
                <span className="text-gray-600">Parts:</span>
                <div className="font-medium">{quote.parts_count} parts</div>
              </div>
              <div>
                <span className="text-gray-600">Lead Time:</span>
                <div className="font-medium">
                  {quote.selected_lead_time.business_days} business days
                </div>
              </div>
              <div>
                <span className="text-gray-600">Total:</span>
                <div className="font-medium">
                  {formatCurrency(quote.total_due, currency)}
                </div>
              </div>
            </div>
          </div>

          {/* Parts Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Finish</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Price/Unit</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.lines.map((line: any) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">
                    {line.file_name}
                  </TableCell>
                  <TableCell>{line.material}</TableCell>
                  <TableCell>{line.finish}</TableCell>
                  <TableCell>{line.quantity}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{line.lead_option}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatCurrency(line.price_per_unit, currency)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(line.line_total, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Compliance */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Compliance</h3>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="itar_onshore_only"
                checked={compliance.itar_onshore_only}
                onCheckedChange={(checked) =>
                  setCompliance((prev) => ({
                    ...prev,
                    itar_onshore_only: checked as boolean,
                  }))
                }
              />
              <div className="space-y-1">
                <Label
                  htmlFor="itar_onshore_only"
                  className="text-sm font-medium"
                >
                  ITAR/EAR-Controlled Data
                </Label>
                <p className="text-sm text-gray-600">
                  This order contains ITAR/EAR-controlled data. Route to U.S.
                  suppliers only.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="dfars_materials"
                checked={compliance.dfars_materials}
                onCheckedChange={(checked) =>
                  setCompliance((prev) => ({
                    ...prev,
                    dfars_materials: checked as boolean,
                  }))
                }
              />
              <div className="space-y-1">
                <Label
                  htmlFor="dfars_materials"
                  className="text-sm font-medium"
                >
                  DFARS-Compliant Materials
                </Label>
                <p className="text-sm text-gray-600">
                  DFARS-compliant materials required.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="export_ack"
                checked={compliance.export_ack}
                onCheckedChange={(checked) =>
                  setCompliance((prev) => ({
                    ...prev,
                    export_ack: checked as boolean,
                  }))
                }
              />
              <div className="space-y-1">
                <Label htmlFor="export_ack" className="text-sm font-medium">
                  Export Authorization
                </Label>
                <p className="text-sm text-gray-600">
                  I certify I am authorized to export/import these items (where
                  applicable).
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Selecting ITAR disables international
              lead-time options and shipping addresses outside approved regions.
            </p>
          </div>
        </div>

        {/* Document Upload */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Attach Documentation (optional)
          </h3>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <CloudArrowUpIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-gray-500">
                Supported: PDF, TIFF, DXF (max 50MB each)
              </p>
            </div>
            <input
              type="file"
              multiple
              accept=".pdf,.tif,.tiff,.dxf"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              id="doc-upload"
            />
            <label htmlFor="doc-upload">
              <Button variant="outline" className="mt-4" asChild>
                <span>Browse Files</span>
              </Button>
            </label>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Uploaded Files:</h4>
              {uploadedFiles.map((file) => {
                const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
                return (
                  <div
                    key={fileKey}
                    className="flex items-center justify-between bg-gray-50 p-2 rounded"
                  >
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline">Back to Quote</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !compliance.export_ack}
          >
            {saving ? "Saving..." : "Save & Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
