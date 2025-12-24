"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeftIcon,
  PlusIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  CubeIcon,
  PaintBrushIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import type {
  SavedTemplate,
  TemplatesListResponse,
  TemplateFormData,
} from "@/types/order";
import { trackEvent } from "@/lib/analytics/posthog";

const TEMPLATE_TYPES = [
  { value: "material", label: "Materials", icon: CubeIcon },
  { value: "finish", label: "Finishes", icon: PaintBrushIcon },
  { value: "inspection", label: "Inspection", icon: MagnifyingGlassIcon },
];

const ITEMS_PER_PAGE = 25;

export default function TemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [activeTab, setActiveTab] = useState("material");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SavedTemplate | null>(
    null,
  );
  const [formData, setFormData] = useState<TemplateFormData>({
    type: "material",
    label: "",
    payload: {},
  });
  const [saving, setSaving] = useState(false);

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, [activeTab]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get<TemplatesListResponse>(
        `/templates?type=${activeTab}&limit=${ITEMS_PER_PAGE}`,
      );
      setTemplates(response.data.templates);
      trackEvent("templates_view", { type: activeTab });
    } catch (error: any) {
      console.error("Error loading templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      setSaving(true);
      await api.post("/templates", formData);
      toast.success("Template created successfully");
      trackEvent("template_created", { type: formData.type });
      setShowCreateDialog(false);
      resetForm();
      await loadTemplates();
    } catch (error: any) {
      console.error("Error creating template:", error);
      toast.error("Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      setSaving(true);
      await api.put(`/templates/${editingTemplate.id}`, formData);
      toast.success("Template updated successfully");
      setEditingTemplate(null);
      resetForm();
      await loadTemplates();
    } catch (error: any) {
      console.error("Error updating template:", error);
      toast.error("Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: SavedTemplate) => {
    if (
      !confirm(
        `Are you sure you want to delete "${template.label}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await api.delete(`/templates/${template.id}`);
      toast.success("Template deleted successfully");
      trackEvent("template_deleted", {
        template_id: template.id,
        type: template.type,
      });
      await loadTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  const handleDuplicateTemplate = async (template: SavedTemplate) => {
    try {
      await api.post(`/templates/${template.id}/duplicate`);
      toast.success("Template duplicated successfully");
      await loadTemplates();
    } catch (error: any) {
      console.error("Error duplicating template:", error);
      toast.error("Failed to duplicate template");
    }
  };

  const handleEditTemplate = (template: SavedTemplate) => {
    setEditingTemplate(template);
    setFormData({
      type: template.type,
      label: template.label,
      payload: template.payload,
    });
  };

  const resetForm = () => {
    setFormData({
      type: activeTab as any,
      label: "",
      payload: {},
    });
    setEditingTemplate(null);
  };

  const getTemplatePreview = (template: SavedTemplate) => {
    switch (template.type) {
      case "material":
        return `Grade: ${template.payload.grade || "N/A"}, Stock: ${template.payload.stock_form || "N/A"}`;
      case "finish":
        return `Process: ${template.payload.process || "N/A"}, Thickness: ${template.payload.thickness_um || "N/A"}μm`;
      case "inspection":
        return `Level: ${template.payload.level || "N/A"}`;
      default:
        return "Template details";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-12 w-full" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
          <Dialog
            open={showCreateDialog || !!editingTemplate}
            onOpenChange={(open) => {
              if (!open) {
                setShowCreateDialog(false);
                setEditingTemplate(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setShowCreateDialog(true)}>
                <PlusIcon className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Edit Template" : "Create New Template"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-type">Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, type: value as any })
                      }
                      disabled={!!editingTemplate}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="template-label">Label</Label>
                    <Input
                      id="template-label"
                      value={formData.label}
                      onChange={(e) =>
                        setFormData({ ...formData, label: e.target.value })
                      }
                      placeholder="Template name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="template-payload">Configuration (JSON)</Label>
                  <Textarea
                    id="template-payload"
                    value={JSON.stringify(formData.payload, null, 2)}
                    onChange={(e) => {
                      try {
                        const payload = JSON.parse(e.target.value);
                        setFormData({ ...formData, payload });
                      } catch (_error) {
                        // Invalid JSON, keep current value
                      }
                    }}
                    placeholder="{}"
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    See schema for selected type. Example:{" "}
                    {JSON.stringify(
                      formData.type === "material"
                        ? { grade: "6061", density: 2.7, stock_form: "plate" }
                        : formData.type === "finish"
                          ? { process: "anodize", thickness_um: 25 }
                          : { level: "Standard" },
                    )}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false);
                      setEditingTemplate(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={
                      editingTemplate
                        ? handleUpdateTemplate
                        : handleCreateTemplate
                    }
                    disabled={saving || !formData.label}
                  >
                    {saving
                      ? "Saving..."
                      : editingTemplate
                        ? "Update"
                        : "Create"}{" "}
                    Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Saved Templates</h1>
          <p className="text-gray-600 mt-2">
            Manage your saved material, finish, and inspection templates.
          </p>
        </div>

        {/* Templates Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            {TEMPLATE_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <TabsTrigger
                  key={type.value}
                  value={type.value}
                  className="flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {type.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {TEMPLATE_TYPES.map((type) => (
            <TabsContent key={type.value} value={type.value} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <type.icon className="w-5 h-5" />
                    {type.label} Templates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Used In</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="w-[50px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">
                            {template.label}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {getTemplatePreview(template)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {template.usage_count} quotes
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {formatDate(template.updated_at)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <EllipsisVerticalIcon className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleEditTemplate(template)}
                                >
                                  <PencilIcon className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDuplicateTemplate(template)
                                  }
                                >
                                  <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteTemplate(template)}
                                  className="text-red-600"
                                >
                                  <TrashIcon className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {templates.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No {type.label.toLowerCase()} templates found. Create your
                      first template to get started.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
