"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Palette,
  Plus,
  Edit,
  Trash2,
  Search,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Finish {
  id: string;
  name: string;
  type:
    | "Anodizing"
    | "Powder Coating"
    | "Plating"
    | "Polishing"
    | "Bead Blasting"
    | "Painting"
    | "Other";
  colors: string[];
  leadTimeDays: number;
  costPerPart: number;
  materialCompatibility: string[];
  description: string;
  status: "active" | "inactive";
  popularity: number;
  qualityLevel: "Standard" | "Premium" | "High-End";
  minOrderQuantity?: number;
}

export default function AdminFinishesPage() {
  const [finishes, setFinishes] = useState<Finish[]>([
    {
      id: "FIN-001",
      name: "Anodized Type II",
      type: "Anodizing",
      colors: ["Black", "Clear", "Red", "Blue", "Gold", "Bronze"],
      leadTimeDays: 5,
      costPerPart: 8.5,
      materialCompatibility: [
        "Aluminum 6061",
        "Aluminum 7075",
        "Aluminum 2024",
      ],
      description:
        "Standard sulfuric acid anodizing providing corrosion resistance and improved surface hardness",
      status: "active",
      popularity: 95,
      qualityLevel: "Standard",
      minOrderQuantity: 10,
    },
    {
      id: "FIN-002",
      name: "Powder Coating",
      type: "Powder Coating",
      colors: ["Any RAL Color", "Custom Match Available"],
      leadTimeDays: 7,
      costPerPart: 12.0,
      materialCompatibility: [
        "Steel",
        "Stainless Steel",
        "Aluminum",
        "Cast Iron",
      ],
      description:
        "Durable electrostatically applied dry powder finish, excellent for outdoor applications",
      status: "active",
      popularity: 88,
      qualityLevel: "Premium",
      minOrderQuantity: 25,
    },
    {
      id: "FIN-003",
      name: "Bead Blasting",
      type: "Bead Blasting",
      colors: ["Natural Matte"],
      leadTimeDays: 3,
      costPerPart: 5.0,
      materialCompatibility: [
        "Aluminum",
        "Steel",
        "Stainless Steel",
        "Titanium",
        "Brass",
      ],
      description:
        "Glass bead media blasting for uniform matte finish, removes tool marks and oxidation",
      status: "active",
      popularity: 72,
      qualityLevel: "Standard",
    },
    {
      id: "FIN-004",
      name: "Mirror Polishing",
      type: "Polishing",
      colors: ["Mirror Chrome", "High Gloss"],
      leadTimeDays: 10,
      costPerPart: 25.0,
      materialCompatibility: ["Stainless Steel", "Aluminum", "Brass", "Copper"],
      description:
        "Multi-stage polishing process achieving mirror-like reflective surface finish",
      status: "active",
      popularity: 65,
      qualityLevel: "High-End",
      minOrderQuantity: 5,
    },
    {
      id: "FIN-005",
      name: "Electroplating - Nickel",
      type: "Plating",
      colors: ["Bright Nickel", "Satin Nickel"],
      leadTimeDays: 8,
      costPerPart: 15.0,
      materialCompatibility: ["Steel", "Brass", "Copper", "Zinc Alloy"],
      description:
        "Electrochemical nickel plating for corrosion protection and decorative finish",
      status: "active",
      popularity: 58,
      qualityLevel: "Premium",
      minOrderQuantity: 50,
    },
    {
      id: "FIN-006",
      name: "Anodized Type III (Hardcoat)",
      type: "Anodizing",
      colors: ["Black", "Natural Gray"],
      leadTimeDays: 7,
      costPerPart: 18.0,
      materialCompatibility: ["Aluminum 6061", "Aluminum 7075"],
      description:
        "Hard anodizing for extreme wear resistance and corrosion protection, aerospace grade",
      status: "active",
      popularity: 48,
      qualityLevel: "High-End",
      minOrderQuantity: 20,
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedFinish, setSelectedFinish] = useState<Finish | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFinish, setEditingFinish] = useState<Finish | null>(null);
  const [newFinish, setNewFinish] = useState<Partial<Finish>>({
    type: "Anodizing",
    status: "active",
    qualityLevel: "Standard",
    colors: [],
    materialCompatibility: [],
  });

  const filteredFinishes = finishes.filter((finish) => {
    const matchesSearch =
      finish.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      finish.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      finish.colors.some((c) =>
        c.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesType = typeFilter === "all" || finish.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" || finish.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: finishes.length,
    active: finishes.filter((f) => f.status === "active").length,
    types: Array.from(new Set(finishes.map((f) => f.type))).length,
    avgCost: (
      finishes.reduce((sum, f) => sum + f.costPerPart, 0) / finishes.length
    ).toFixed(2),
  };

  const handleCreateFinish = () => {
    if (!newFinish.name || !newFinish.description) {
      alert("Please fill in all required fields");
      return;
    }

    const finish: Finish = {
      id: `FIN-${String(finishes.length + 1).padStart(3, "0")}`,
      name: newFinish.name!,
      type: (newFinish.type as Finish["type"]) || "Other",
      colors: newFinish.colors || [],
      leadTimeDays: newFinish.leadTimeDays || 5,
      costPerPart: newFinish.costPerPart || 0,
      materialCompatibility: newFinish.materialCompatibility || [],
      description: newFinish.description!,
      status: "active",
      popularity: 0,
      qualityLevel:
        (newFinish.qualityLevel as Finish["qualityLevel"]) || "Standard",
      minOrderQuantity: newFinish.minOrderQuantity,
    };

    setFinishes([...finishes, finish]);
    setShowCreateDialog(false);
    setNewFinish({
      type: "Anodizing",
      status: "active",
      qualityLevel: "Standard",
      colors: [],
      materialCompatibility: [],
    });
    alert(`✅ Finish "${finish.name}" created successfully!`);
  };

  const handleUpdateFinish = () => {
    if (!editingFinish) return;

    setFinishes(
      finishes.map((f) => (f.id === editingFinish.id ? editingFinish : f)),
    );
    setEditingFinish(null);
    alert(`✅ Finish "${editingFinish.name}" updated successfully!`);
  };

  const handleDeleteFinish = (finishId: string) => {
    const finish = finishes.find((f) => f.id === finishId);
    if (confirm(`Are you sure you want to delete "${finish?.name}"?`)) {
      setFinishes(finishes.filter((f) => f.id !== finishId));
      alert(`✅ Finish deleted successfully!`);
    }
  };

  const handleToggleStatus = (finishId: string) => {
    setFinishes(
      finishes.map((f) =>
        f.id === finishId
          ? { ...f, status: f.status === "active" ? "inactive" : "active" }
          : f,
      ),
    );
  };

  const getQualityBadge = (quality: Finish["qualityLevel"]) => {
    const variants = {
      Standard: { bg: "bg-gray-100", text: "text-gray-700" },
      Premium: { bg: "bg-blue-100", text: "text-blue-700" },
      "High-End": { bg: "bg-purple-100", text: "text-purple-700" },
    };
    const variant = variants[quality];
    return (
      <Badge className={`${variant.bg} ${variant.text} border-0`}>
        {quality}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Surface Finishes</h1>
          <p className="text-gray-600 mt-1">
            Manage finishing options, pricing, and capabilities
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Finish
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Finishes</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.total}
              </p>
            </div>
            <Palette className="w-10 h-10 text-purple-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {stats.active}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Finish Types</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {stats.types}
              </p>
            </div>
            <Layers className="w-10 h-10 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Avg Cost/Part</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                ${stats.avgCost}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-emerald-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white border-gray-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search finishes, colors, materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-gray-300"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-48 bg-white border-gray-300">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Anodizing">Anodizing</SelectItem>
              <SelectItem value="Powder Coating">Powder Coating</SelectItem>
              <SelectItem value="Plating">Plating</SelectItem>
              <SelectItem value="Polishing">Polishing</SelectItem>
              <SelectItem value="Bead Blasting">Bead Blasting</SelectItem>
              <SelectItem value="Painting">Painting</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48 bg-white border-gray-300">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Finishes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFinishes.map((finish) => (
          <Card
            key={finish.id}
            className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {finish.name}
                    </h3>
                    {finish.status === "active" ? (
                      <CheckCircle size={16} className="text-green-500" />
                    ) : (
                      <XCircle size={16} className="text-gray-400" />
                    )}
                  </div>
                  <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">
                    {finish.type}
                  </Badge>
                </div>
                <div className="p-2 rounded-lg bg-purple-50">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Colors Available</p>
                  <div className="flex flex-wrap gap-1">
                    {finish.colors.slice(0, 3).map((color, idx) => (
                      <Badge
                        key={idx}
                        className="bg-gray-100 text-gray-700 border-0 text-xs"
                      >
                        {color}
                      </Badge>
                    ))}
                    {finish.colors.length > 3 && (
                      <Badge className="bg-gray-100 text-gray-700 border-0 text-xs">
                        +{finish.colors.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Clock size={12} />
                      Lead Time
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {finish.leadTimeDays} days
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <DollarSign size={12} />
                      Cost/Part
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      ${finish.costPerPart.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">Quality Level</p>
                  {getQualityBadge(finish.qualityLevel)}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${finish.popularity}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {finish.popularity}%
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedFinish(finish)}
                  className="flex-1 hover:bg-gray-100"
                >
                  <Eye size={16} className="mr-1" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingFinish({ ...finish })}
                  className="flex-1 hover:bg-gray-100"
                >
                  <Edit size={16} className="mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteFinish(finish.id)}
                  className="hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Finish Detail Modal */}
      {selectedFinish && (
        <Dialog
          open={!!selectedFinish}
          onOpenChange={() => setSelectedFinish(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                {selectedFinish.name}
                {selectedFinish.status === "active" ? (
                  <Badge className="bg-green-100 text-green-700 border-0">
                    Active
                  </Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-700 border-0">
                    Inactive
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Description
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedFinish.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Pricing & Timeline
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Type:</span>{" "}
                      {selectedFinish.type}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Cost per Part:</span> $
                      {selectedFinish.costPerPart.toFixed(2)}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Lead Time:</span>{" "}
                      {selectedFinish.leadTimeDays} days
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Quality Level:</span>{" "}
                      {selectedFinish.qualityLevel}
                    </p>
                    {selectedFinish.minOrderQuantity && (
                      <p className="text-sm">
                        <span className="font-medium">Min Order Qty:</span>{" "}
                        {selectedFinish.minOrderQuantity} parts
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Popularity
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full"
                        style={{ width: `${selectedFinish.popularity}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {selectedFinish.popularity}%
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Available Colors
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedFinish.colors.map((color, idx) => (
                    <Badge
                      key={idx}
                      className="bg-purple-100 text-purple-700 border-0"
                    >
                      {color}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Material Compatibility
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedFinish.materialCompatibility.map((material, idx) => (
                    <Badge
                      key={idx}
                      className="bg-blue-100 text-blue-700 border-0"
                    >
                      {material}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => setEditingFinish({ ...selectedFinish })}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Edit size={16} className="mr-2" />
                  Edit Finish
                </Button>
                <Button
                  onClick={() => handleToggleStatus(selectedFinish.id)}
                  variant="outline"
                  className="flex-1"
                >
                  {selectedFinish.status === "active"
                    ? "Deactivate"
                    : "Activate"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create/Edit Finish Dialog */}
      {(showCreateDialog || editingFinish) && (
        <Dialog
          open={showCreateDialog || !!editingFinish}
          onOpenChange={() => {
            setShowCreateDialog(false);
            setEditingFinish(null);
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {editingFinish ? "Edit Finish" : "Create New Finish"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Finish Name *</Label>
                  <Input
                    value={
                      editingFinish ? editingFinish.name : newFinish.name || ""
                    }
                    onChange={(e) =>
                      editingFinish
                        ? setEditingFinish({
                            ...editingFinish,
                            name: e.target.value,
                          })
                        : setNewFinish({ ...newFinish, name: e.target.value })
                    }
                    placeholder="e.g., Anodized Type II"
                    className="bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label>Type *</Label>
                  <Select
                    value={editingFinish ? editingFinish.type : newFinish.type}
                    onValueChange={(value) =>
                      editingFinish
                        ? setEditingFinish({
                            ...editingFinish,
                            type: value as Finish["type"],
                          })
                        : setNewFinish({
                            ...newFinish,
                            type: value as Finish["type"],
                          })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Anodizing">Anodizing</SelectItem>
                      <SelectItem value="Powder Coating">
                        Powder Coating
                      </SelectItem>
                      <SelectItem value="Plating">Plating</SelectItem>
                      <SelectItem value="Polishing">Polishing</SelectItem>
                      <SelectItem value="Bead Blasting">
                        Bead Blasting
                      </SelectItem>
                      <SelectItem value="Painting">Painting</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description *</Label>
                <Textarea
                  value={
                    editingFinish
                      ? editingFinish.description
                      : newFinish.description || ""
                  }
                  onChange={(e) =>
                    editingFinish
                      ? setEditingFinish({
                          ...editingFinish,
                          description: e.target.value,
                        })
                      : setNewFinish({
                          ...newFinish,
                          description: e.target.value,
                        })
                  }
                  placeholder="Detailed description of the finishing process and benefits..."
                  rows={3}
                  className="bg-white border-gray-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Cost per Part ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      editingFinish
                        ? editingFinish.costPerPart
                        : newFinish.costPerPart || ""
                    }
                    onChange={(e) =>
                      editingFinish
                        ? setEditingFinish({
                            ...editingFinish,
                            costPerPart: parseFloat(e.target.value),
                          })
                        : setNewFinish({
                            ...newFinish,
                            costPerPart: parseFloat(e.target.value),
                          })
                    }
                    placeholder="0.00"
                    className="bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label>Lead Time (days)</Label>
                  <Input
                    type="number"
                    value={
                      editingFinish
                        ? editingFinish.leadTimeDays
                        : newFinish.leadTimeDays || ""
                    }
                    onChange={(e) =>
                      editingFinish
                        ? setEditingFinish({
                            ...editingFinish,
                            leadTimeDays: parseInt(e.target.value),
                          })
                        : setNewFinish({
                            ...newFinish,
                            leadTimeDays: parseInt(e.target.value),
                          })
                    }
                    placeholder="5"
                    className="bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label>Min Order Qty</Label>
                  <Input
                    type="number"
                    value={
                      editingFinish
                        ? editingFinish.minOrderQuantity || ""
                        : newFinish.minOrderQuantity || ""
                    }
                    onChange={(e) =>
                      editingFinish
                        ? setEditingFinish({
                            ...editingFinish,
                            minOrderQuantity:
                              parseInt(e.target.value) || undefined,
                          })
                        : setNewFinish({
                            ...newFinish,
                            minOrderQuantity:
                              parseInt(e.target.value) || undefined,
                          })
                    }
                    placeholder="Optional"
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              <div>
                <Label>Quality Level</Label>
                <Select
                  value={
                    editingFinish
                      ? editingFinish.qualityLevel
                      : newFinish.qualityLevel
                  }
                  onValueChange={(value) =>
                    editingFinish
                      ? setEditingFinish({
                          ...editingFinish,
                          qualityLevel: value as Finish["qualityLevel"],
                        })
                      : setNewFinish({
                          ...newFinish,
                          qualityLevel: value as Finish["qualityLevel"],
                        })
                  }
                >
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="High-End">High-End</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Colors Available (comma-separated)</Label>
                <Input
                  value={
                    editingFinish
                      ? editingFinish.colors.join(", ")
                      : newFinish.colors?.join(", ") || ""
                  }
                  onChange={(e) => {
                    const colors = e.target.value
                      .split(",")
                      .map((c) => c.trim())
                      .filter((c) => c);
                    editingFinish
                      ? setEditingFinish({ ...editingFinish, colors })
                      : setNewFinish({ ...newFinish, colors });
                  }}
                  placeholder="Black, Clear, Red, Blue"
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Material Compatibility (comma-separated)</Label>
                <Input
                  value={
                    editingFinish
                      ? editingFinish.materialCompatibility.join(", ")
                      : newFinish.materialCompatibility?.join(", ") || ""
                  }
                  onChange={(e) => {
                    const materials = e.target.value
                      .split(",")
                      .map((m) => m.trim())
                      .filter((m) => m);
                    editingFinish
                      ? setEditingFinish({
                          ...editingFinish,
                          materialCompatibility: materials,
                        })
                      : setNewFinish({
                          ...newFinish,
                          materialCompatibility: materials,
                        });
                  }}
                  placeholder="Aluminum 6061, Steel, Stainless Steel"
                  className="bg-white border-gray-300"
                />
              </div>
            </div>

            <DialogFooter>
              {editingFinish ? (
                <>
                  <Button
                    onClick={handleUpdateFinish}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <CheckCircle size={16} className="mr-2" />
                    Update Finish
                  </Button>
                  <Button
                    onClick={() => setEditingFinish(null)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleCreateFinish}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Create Finish
                  </Button>
                  <Button
                    onClick={() => setShowCreateDialog(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
