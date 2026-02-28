"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DataTable,
  type Column,
  type Action,
} from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import {
  Settings2,
  Plus,
  Edit,
  Trash2,
  X,
  Eye,
  EyeOff,
  Calendar,
  Mail,
  FileText,
  Code,
  Palette,
  Lock,
  Key,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

function TagInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  let tags: string[] = [];
  try {
    if (value) tags = JSON.parse(value);
    if (!Array.isArray(tags)) tags = [];
  } catch {
    tags = [];
  }

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange(JSON.stringify([...tags, trimmed]));
      setInputValue("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(JSON.stringify(tags.filter((t) => t !== tagToRemove)));
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Type and press Enter"
        />
        <Button type="button" variant="secondary" onClick={addTag}>
          Add
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {tag}
              <X
                className="w-3 h-3 cursor-pointer text-gray-500 hover:text-red-500"
                onClick={() => removeTag(tag)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface SystemVariable {
  key: string;
  value: string;
  type: string;
  description: string;
}

export default function SystemConfigPage() {
  const [variables, setVariables] = useState<SystemVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVar, setEditingVar] = useState<SystemVariable | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const [formData, setFormData] = useState({
    key: "",
    value: "",
    type: "",
    description: "",
  });

  const fetchVariables = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/system");
      if (res.data?.success) {
        setVariables(res.data.configData || []);
      }
    } catch (error) {
      console.error("Failed to fetch system variables:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVariables();
  }, []);

  const handleOpenDialog = (variable?: SystemVariable) => {
    if (variable) {
      setEditingVar(variable);
      setFormData({
        key: variable.key,
        value: variable.value,
        type: variable.type,
        description: variable.description || "",
      });
    } else {
      setEditingVar(null);
      setFormData({ key: "", value: "", type: "", description: "" });
    }
    setShowSecret(false);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingVar) {
        await apiClient.patch(`/system/${editingVar.key}`, {
          value: formData.value,
          type: formData.type,
          description: formData.description,
        });
      } else {
        await apiClient.post("/system", [
          {
            key: formData.key,
            value: formData.value,
            type: formData.type,
            description: formData.description,
          },
        ]);
      }
      setIsDialogOpen(false);
      fetchVariables();
    } catch (error) {
      console.error("Failed to save system variable:", error);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;
    try {
      await apiClient.delete(`/system/${key}`);
      fetchVariables();
    } catch (error) {
      console.error("Failed to delete system variable:", error);
    }
  };

  const columns: Column<SystemVariable>[] = [
    {
      key: "key",
      header: "Key",
      sortable: true,
      render: (v) => <span className="font-medium">{v.key}</span>,
    },
    {
      key: "value",
      header: "Value",
      sortable: true,
      render: (v) => {
        if (v.type === "group") {
          let parsed: string[] = [];
          try {
            parsed = JSON.parse(v.value);
          } catch (e) {
            console.log(e);
          }
          return (
            <div className="flex flex-wrap gap-1 max-w-[200px]" title={v.value}>
              {Array.isArray(parsed) && parsed.length > 0 ? (
                parsed.map((item, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="truncate max-w-[150px]"
                  >
                    {item}
                  </Badge>
                ))
              ) : (
                <span className="text-gray-500 italic text-sm">
                  Empty group
                </span>
              )}
            </div>
          );
        }

        if (v.type === "flag") {
          const isTrue = v.value === "true";
          return (
            <span
              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                isTrue
                  ? "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-400/20"
                  : "bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"
              }`}
            >
              {isTrue ? "True" : "False"}
            </span>
          );
        }

        if (v.type === "color") {
          return (
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full border border-gray-200"
                style={{ backgroundColor: v.value }}
              />
              <span className="text-sm font-mono uppercase">{v.value}</span>
            </div>
          );
        }

        if (v.type === "secret") {
          return (
            <span className="text-gray-400 font-mono tracking-widest">
              ••••••••
            </span>
          );
        }

        if (v.type === "json") {
          return (
            <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
              JSON Object
            </span>
          );
        }

        if (v.type === "date") {
          try {
            return (
              <span className="text-sm">
                {new Date(v.value).toLocaleDateString()}
              </span>
            );
          } catch {
            return <span className="text-sm">{v.value}</span>;
          }
        }

        return (
          <span className="max-w-[200px] truncate block" title={v.value}>
            {v.value}
          </span>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (v) => {
        const typeIcons: Record<string, React.ReactNode> = {
          string: <FileText className="w-3 h-3" />,
          number: <span className="font-bold text-[10px]">#</span>,
          phone: <Mail className="w-3 h-3" />,
          group: <X className="w-3 h-3 rotate-45" />,
          flag: <Lock className="w-3 h-3" />,
          date: <Calendar className="w-3 h-3" />,
          json: <Code className="w-3 h-3" />,
          color: <Palette className="w-3 h-3" />,
          email: <Mail className="w-3 h-3" />,
          longtext: <FileText className="w-3 h-3" />,
          secret: <Key className="w-3 h-3" />,
        };

        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/20">
            {typeIcons[v.type] || <FileText className="w-3 h-3" />}
            {v.type || "string"}
          </span>
        );
      },
    },
    {
      key: "description",
      header: "Description",
      sortable: true,
      render: (v) => (
        <span className="max-w-[300px] truncate block" title={v.description}>
          {v.description}
        </span>
      ),
    },
  ];

  const actions: Action<SystemVariable>[] = [
    {
      label: "Edit",
      icon: <Edit className="w-4 h-4" />,
      onClick: (v) => handleOpenDialog(v),
    },
    {
      label: "Delete",
      icon: <Trash2 className="w-4 h-4 text-red-500" />,
      onClick: (v) => handleDelete(v.key),
      className:
        "text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            System Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage global system variables and preferences.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Variable
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Active Configurations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <DataTable
            columns={columns}
            data={variables}
            keyExtractor={(v) => v.key}
            actions={actions}
            searchableColumns={["key", "value", "type", "description"]}
            isLoading={loading}
            emptyMessage="No system variables found."
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingVar ? "Edit System Variable" : "Add System Variable"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="key" className="text-right">
                Key
              </Label>
              <Input
                id="key"
                className="col-span-3"
                value={formData.key}
                disabled={!!editingVar}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
                placeholder="e.g. MAINTENANCE_MODE"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Type
              </Label>
              <Select
                value={formData.type}
                onValueChange={(val) =>
                  setFormData({
                    ...formData,
                    type: val,
                    value:
                      val === "group" ? "[]" : val === "flag" ? "false" : "",
                  })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="flag">Flag</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="color">Color</SelectItem>
                  <SelectItem value="longtext">Long Text</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="value" className="text-right">
                Value
              </Label>
              <div className="col-span-3">
                {formData.type === "number" ? (
                  <Input
                    id="value"
                    type="number"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                    placeholder="e.g. 100"
                  />
                ) : formData.type === "email" ? (
                  <Input
                    id="value"
                    type="email"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                    placeholder="e.g. support@example.com"
                  />
                ) : formData.type === "date" ? (
                  <Input
                    id="value"
                    type="date"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                  />
                ) : formData.type === "color" ? (
                  <div className="flex gap-2">
                    <Input
                      id="value"
                      type="color"
                      className="w-12 p-1 h-10"
                      value={formData.value || "#000000"}
                      onChange={(e) =>
                        setFormData({ ...formData, value: e.target.value })
                      }
                    />
                    <Input
                      value={formData.value}
                      placeholder="#000000"
                      onChange={(e) =>
                        setFormData({ ...formData, value: e.target.value })
                      }
                    />
                  </div>
                ) : formData.type === "longtext" ? (
                  <Textarea
                    id="value"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                    placeholder="Enter long text..."
                    className="min-h-[100px]"
                  />
                ) : formData.type === "json" ? (
                  <Textarea
                    id="value"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                    placeholder='{"key": "value"}'
                    className="font-mono min-h-[100px]"
                  />
                ) : formData.type === "secret" ? (
                  <div className="relative">
                    <Input
                      id="value"
                      type={showSecret ? "text" : "password"}
                      value={formData.value}
                      onChange={(e) =>
                        setFormData({ ...formData, value: e.target.value })
                      }
                      placeholder="Enter secret value"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                ) : formData.type === "phone" ? (
                  <PhoneInput
                    international
                    defaultCountry="US"
                    value={formData.value as any}
                    onChange={(val) =>
                      setFormData({
                        ...formData,
                        value: val ? val.toString() : "",
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>input]:w-full [&>input]:bg-transparent [&>input]:border-none [&>input]:outline-none"
                  />
                ) : formData.type === "group" ? (
                  <TagInput
                    value={formData.value}
                    onChange={(val) => setFormData({ ...formData, value: val })}
                  />
                ) : formData.type === "flag" ? (
                  <Select
                    value={formData.value}
                    onValueChange={(val) =>
                      setFormData({ ...formData, value: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="value"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                    placeholder="e.g. text value"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                className="col-span-3"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief summary of config"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingVar ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
