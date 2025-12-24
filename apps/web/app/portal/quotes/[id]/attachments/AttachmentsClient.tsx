"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ChevronLeftIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PaperClipIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { posthog } from "posthog-js";

// Types based on specification
interface Attachment {
  id: string;
  quote_id: string;
  line_id: string | null;
  name: string;
  type: "PDF" | "DXF" | "TIFF" | "PNG" | "JPG" | "OTHER";
  size_bytes: number;
  url: string;
  uploaded_at: string;
}

interface QuoteLine {
  id: string;
  file_name: string;
}

export default function AttachmentsManagerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = (params?.id as string) || "";
  const lineId = searchParams?.get("line") || "";

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Mock data
  const mockAttachments: Attachment[] = [
    {
      id: "att-1",
      quote_id: quoteId,
      line_id: "line-1",
      name: "bracket-drawing.pdf",
      type: "PDF",
      size_bytes: 512000,
      url: "/api/attachments/att-1",
      uploaded_at: "2024-09-12T10:30:00Z",
    },
    {
      id: "att-2",
      quote_id: quoteId,
      line_id: "line-1",
      name: "bracket-dimensions.dxf",
      type: "DXF",
      size_bytes: 245760,
      url: "/api/attachments/att-2",
      uploaded_at: "2024-09-12T10:35:00Z",
    },
    {
      id: "att-3",
      quote_id: quoteId,
      line_id: null,
      name: "assembly-notes.pdf",
      type: "PDF",
      size_bytes: 128000,
      url: "/api/attachments/att-3",
      uploaded_at: "2024-09-12T11:00:00Z",
    },
  ];

  const mockQuoteLines: QuoteLine[] = [
    { id: "line-1", file_name: "bracket.step" },
    { id: "line-2", file_name: "housing.iges" },
  ];

  useEffect(() => {
    // Track page view
    posthog.capture("attachments_view", { quote_id: quoteId, line_id: lineId });

    // Simulate API call
    const fetchData = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setAttachments(mockAttachments);
      setQuoteLines(mockQuoteLines);
      setLoading(false);
    };

    fetchData();
  }, [quoteId, lineId]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        const allowedTypes = [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/tiff",
          "application/dxf",
        ];
        if (
          !allowedTypes.includes(file.type) &&
          !file.name.toLowerCase().endsWith(".dxf")
        ) {
          alert(`File type not allowed: ${file.name}`);
          continue;
        }

        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
          alert(`File too large: ${file.name} (max 50MB)`);
          continue;
        }

        // In real implementation: upload file to server
        const newAttachment: Attachment = {
          id: `att-${Date.now()}-${i}`,
          quote_id: quoteId,
          line_id: lineId,
          name: file.name,
          type: getFileType(file),
          size_bytes: file.size,
          url: `/api/attachments/${file.name}`,
          uploaded_at: new Date().toISOString(),
        };

        setAttachments((prev) => [...prev, newAttachment]);

        posthog.capture("attachment_uploaded", {
          quote_id: quoteId,
          line_id: lineId,
          file_type: newAttachment.type,
          file_size: file.size,
        });
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleLinkToPart = async (attachmentId: string, newLineId: string) => {
    try {
      // In real implementation: PUT /api/attachments/:id { line_id: newLineId }
      setAttachments((prev) =>
        prev.map((att) =>
          att.id === attachmentId ? { ...att, line_id: newLineId } : att,
        ),
      );
    } catch (error) {
      console.error("Failed to link attachment:", error);
    }
  };

  const handlePreview = (attachment: Attachment) => {
    // In real implementation: open viewer modal or new window
    if (attachment.type === "PDF") {
      window.open(attachment.url, "_blank");
    } else {
      // Open image viewer modal
    }
  };

  const handleDownload = (attachment: Attachment) => {
    // In real implementation: trigger download with signed URL
    const link = document.createElement("a");
    link.href = attachment.url;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm("Are you sure you want to delete this attachment?")) return;

    try {
      // In real implementation: DELETE /api/attachments/:id
      setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));

      posthog.capture("attachment_deleted", {
        quote_id: quoteId,
        attachment_id: attachmentId,
      });
    } catch (error) {
      console.error("Failed to delete attachment:", error);
    }
  };

  const getFileType = (file: File): Attachment["type"] => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "PDF";
      case "dxf":
        return "DXF";
      case "tiff":
      case "tif":
        return "TIFF";
      case "png":
        return "PNG";
      case "jpg":
      case "jpeg":
        return "JPG";
      default:
        return "OTHER";
    }
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case "PDF":
        return <DocumentTextIcon className="h-5 w-5 text-red-500" />;
      case "PNG":
      case "JPG":
      case "TIFF":
        return <PhotoIcon className="h-5 w-5 text-blue-500" />;
      case "DXF":
        return <DocumentTextIcon className="h-5 w-5 text-green-500" />;
      default:
        return <PaperClipIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <button
                onClick={() => router.push("/portal/dashboard")}
                className="hover:text-gray-900"
              >
                Dashboard
              </button>
              <ChevronLeftIcon className="h-4 w-4" />
              <button
                onClick={() => router.push("/portal/quotes")}
                className="hover:text-gray-900"
              >
                Quotes
              </button>
              <ChevronLeftIcon className="h-4 w-4" />
              <button
                onClick={() => router.push(`/portal/quotes/${quoteId}`)}
                className="hover:text-gray-900"
              >
                {quoteId}
              </button>
              <ChevronLeftIcon className="h-4 w-4" />
              <span className="font-medium text-gray-900">
                Upload Drawings & Attachments
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => router.push(`/portal/quotes/${quoteId}`)}
                variant="outline"
              >
                Back to Quote
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
        <div className="space-y-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CloudArrowUpIcon className="h-5 w-5" />
                <span>Upload Files</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <CloudArrowUpIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <div className="space-y-2">
                  <p className="text-gray-600">
                    Drop files here or click to browse
                  </p>
                  <p className="text-sm text-gray-500">
                    Supported: PDF, DXF, TIFF, PNG, JPG (max 50MB each)
                  </p>
                </div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.dxf,.tiff,.tif,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  id="file-upload"
                  disabled={uploading}
                />
                <label htmlFor="file-upload">
                  <Button
                    variant="outline"
                    className="mt-4"
                    disabled={uploading}
                    asChild
                  >
                    <span>{uploading ? "Uploading..." : "Browse Files"}</span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Attachments Table */}
          <Card>
            <CardHeader>
              <CardTitle>Files ({attachments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <div className="text-center py-12">
                  <PaperClipIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No files uploaded yet
                  </h3>
                  <p className="text-gray-500">
                    Upload drawings, specifications, or other documents related
                    to your quote.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Linked To</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attachments.map((attachment) => (
                      <TableRow key={attachment.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            {getFileTypeIcon(attachment.type)}
                            <span className="font-medium">
                              {attachment.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{attachment.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {formatFileSize(attachment.size_bytes)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={attachment.line_id || ""}
                            onValueChange={(value) =>
                              handleLinkToPart(attachment.id, value || "")
                            }
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select part" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Quote Level</SelectItem>
                              {quoteLines.map((line) => (
                                <SelectItem key={line.id} value={line.id}>
                                  {line.file_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {formatDate(attachment.uploaded_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(attachment)}
                              className="flex items-center space-x-1"
                            >
                              <EyeIcon className="w-4 h-4" />
                              <span>Preview</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(attachment)}
                              className="flex items-center space-x-1"
                            >
                              <ArrowDownTrayIcon className="w-4 h-4" />
                              <span>Download</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(attachment.id)}
                              className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                            >
                              <TrashIcon className="w-4 h-4" />
                              <span>Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
