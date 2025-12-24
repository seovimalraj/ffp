"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeftIcon,
  PaperClipIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { trackEvent } from "@/lib/analytics/posthog";

const SUPPORT_CATEGORIES = [
  "Technical Issue",
  "Billing Question",
  "Order Support",
  "File Upload Problem",
  "Quote Question",
  "DFM Feedback",
  "Account Issue",
  "Other",
] as const;

const PRIORITY_LEVELS = [
  {
    value: "low",
    label: "Low - General question",
    color: "bg-gray-100 text-gray-800",
  },
  {
    value: "medium",
    label: "Medium - Issue affecting work",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    value: "high",
    label: "High - Urgent business impact",
    color: "bg-red-100 text-red-800",
  },
] as const;

export default function ContactSupportPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "",
    priority: "medium" as const,
    subject: "",
    description: "",
    attachments: [] as File[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      const validFiles = files.filter((file) => {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "application/pdf",
          "application/zip",
          "application/x-zip-compressed",
          "model/step",
          "model/iges",
          "application/sla", // CAD files
        ];

        if (file.size > maxSize) {
          alert(`${file.name} is too large. Maximum file size is 10MB.`);
          return false;
        }

        if (
          !allowedTypes.some((type) => file.type.includes(type.split("/")[1]))
        ) {
          alert(`${file.name} has an unsupported file type.`);
          return false;
        }

        return true;
      });

      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...validFiles].slice(0, 5), // Max 5 files
      }));
    },
    [],
  );

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Validate form
      if (
        !formData.name ||
        !formData.email ||
        !formData.category ||
        !formData.subject ||
        !formData.description
      ) {
        throw new Error("Please fill in all required fields.");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        throw new Error("Please enter a valid email address.");
      }

      // Track support ticket creation
      trackEvent("support_ticket_created", {
        category: formData.category,
        priority: formData.priority,
        has_attachments: formData.attachments.length > 0,
      });

      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setSubmitted(true);

      // Reset form
      setFormData({
        name: "",
        email: "",
        category: "",
        priority: "medium",
        subject: "",
        description: "",
        attachments: [],
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while submitting your ticket.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Support Ticket Created
            </h3>
            <p className="text-gray-600 mb-6">
              We've received your support request and will get back to you
              within 24 hours. You'll receive a confirmation email shortly.
            </p>
            <div className="space-y-3">
              <Button onClick={() => router.push("/help")} className="w-full">
                Back to Help Center
              </Button>
              <Button
                variant="outline"
                onClick={() => setSubmitted(false)}
                className="w-full"
              >
                Create Another Ticket
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/help")}
              className="flex items-center space-x-2"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>Back to Help</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Contact Support
            </h1>
            <p className="text-gray-600 mt-2">
              Need help? We're here to assist you with any questions or issues.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <ExclamationTriangleIcon className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Create Support Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      placeholder="Enter your email address"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        handleInputChange("category", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORT_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) =>
                        handleInputChange("priority", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_LEVELS.map((priority) => (
                          <SelectItem
                            key={priority.value}
                            value={priority.value}
                          >
                            <div className="flex items-center space-x-2">
                              <Badge className={priority.color}>
                                {priority.value}
                              </Badge>
                              <span>{priority.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) =>
                      handleInputChange("subject", e.target.value)
                    }
                    placeholder="Brief description of your issue"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    placeholder="Please provide detailed information about your issue or question..."
                    rows={6}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="attachments">Attachments (optional)</Label>
                  <div className="mt-2">
                    <input
                      id="attachments"
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.gif,.pdf,.zip,.step,.stp,.iges,.stl"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="attachments"
                      className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
                    >
                      <div className="text-center">
                        <PaperClipIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          Click to upload files or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Max 5 files, 10MB each. Supports images, PDFs, CAD
                          files
                        </p>
                      </div>
                    </label>
                  </div>

                  {formData.attachments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {formData.attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <div className="flex items-center space-x-2">
                            <PaperClipIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {file.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({(file.size / 1024 / 1024).toFixed(1)}MB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/help")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting
                      ? "Creating Ticket..."
                      : "Create Support Ticket"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Response Times</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">High Priority</span>
                  <Badge className="bg-red-100 text-red-800">
                    Within 4 hours
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Medium Priority</span>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    Within 24 hours
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Low Priority</span>
                  <Badge className="bg-gray-100 text-gray-800">
                    Within 48 hours
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
