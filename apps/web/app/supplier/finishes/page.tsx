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
  CheckCircle,
  XCircle,
  DollarSign,
  Clock,
  Eye,
  Sparkles,
  Package,
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

interface SupplierFinish {
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
  equipmentAvailable: boolean;
  capacity: number;
  currentUtilization: number;
}

export default function SupplierFinishesPage() {
  const [finishes, setFinishes] = useState<SupplierFinish[]>([
    {
      id: "FIN-001",
      name: "Anodized Type II",
      type: "Anodizing",
      colors: ["Black", "Clear", "Red", "Blue", "Gold"],
      leadTimeDays: 5,
      costPerPart: 8.5,
      materialCompatibility: ["Aluminum 6061", "Aluminum 7075"],
      description:
        "Standard sulfuric acid anodizing with excellent corrosion resistance",
      status: "active",
      equipmentAvailable: true,
      capacity: 500,
      currentUtilization: 320,
    },
    {
      id: "FIN-002",
      name: "Powder Coating",
      type: "Powder Coating",
      colors: ["Any RAL Color", "Custom Match"],
      leadTimeDays: 7,
      costPerPart: 12.0,
      materialCompatibility: ["Steel", "Stainless Steel", "Aluminum"],
      description:
        "Durable electrostatically applied powder coating for all metal parts",
      status: "active",
      equipmentAvailable: true,
      capacity: 300,
      currentUtilization: 180,
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
      ],
      description: "Glass bead media blasting for uniform matte finish",
      status: "active",
      equipmentAvailable: true,
      capacity: 800,
      currentUtilization: 550,
    },
    {
      id: "FIN-004",
      name: "Chrome Plating",
      type: "Plating",
      colors: ["Bright Chrome"],
      leadTimeDays: 10,
      costPerPart: 25.0,
      materialCompatibility: ["Steel", "Brass"],
      description: "Decorative and functional chrome plating",
      status: "inactive",
      equipmentAvailable: false,
      capacity: 0,
      currentUtilization: 0,
    },
  ]);

  const [selectedFinish, setSelectedFinish] = useState<SupplierFinish | null>(
    null,
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFinish, setEditingFinish] = useState<SupplierFinish | null>(
    null,
  );
  const [newFinish, setNewFinish] = useState<Partial<SupplierFinish>>({
    type: "Anodizing",
    status: "active",
    colors: [],
    materialCompatibility: [],
    equipmentAvailable: true,
    currentUtilization: 0,
  });

  const stats = {
    total: finishes.length,
    active: finishes.filter((f) => f.status === "active").length,
    totalCapacity: finishes.reduce((sum, f) => sum + f.capacity, 0),
    avgUtilization:
      finishes.length > 0
        ? (
            finishes.reduce(
              (sum, f) =>
                sum +
                (f.capacity > 0
                  ? (f.currentUtilization / f.capacity) * 100
                  : 0),
              0,
            ) / finishes.filter((f) => f.capacity > 0).length || 0
          ).toFixed(1)
        : "0",
  };

  const handleCreateFinish = () => {
    if (!newFinish.name || !newFinish.description) {
      alert("Please fill in all required fields");
      return;
    }

    const finish: SupplierFinish = {
      id: `FIN-${String(finishes.length + 1).padStart(3, "0")}`,
      name: newFinish.name!,
      type: (newFinish.type as SupplierFinish["type"]) || "Other",
      colors: newFinish.colors || [],
      leadTimeDays: newFinish.leadTimeDays || 5,
      costPerPart: newFinish.costPerPart || 0,
      materialCompatibility: newFinish.materialCompatibility || [],
      description: newFinish.description!,
      status: "active",
      equipmentAvailable:
        newFinish.equipmentAvailable !== undefined
          ? newFinish.equipmentAvailable
          : true,
      capacity: newFinish.capacity || 0,
      currentUtilization: 0,
    };

    setFinishes([...finishes, finish]);
    setShowCreateDialog(false);
    setNewFinish({
      type: "Anodizing",
      status: "active",
      colors: [],
      materialCompatibility: [],
      equipmentAvailable: true,
      currentUtilization: 0,
    });
    alert(`✅ Finish capability "${finish.name}" added successfully!`);
  };

  const handleUpdateFinish = () => {
    if (!editingFinish) return;

    setFinishes(
      finishes.map((f) => (f.id === editingFinish.id ? editingFinish : f)),
    );
    setEditingFinish(null);
    alert(`✅ Finish capability updated successfully!`);
  };

  const handleDeleteFinish = (finishId: string) => {
    const finish = finishes.find((f) => f.id === finishId);
    if (
      confirm(`Are you sure you want to remove "${finish?.name}" capability?`)
    ) {
      setFinishes(finishes.filter((f) => f.id !== finishId));
      alert(`✅ Finish capability removed successfully!`);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Finishing Capabilities
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your surface finishing services and equipment
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Capability
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Capabilities</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.total}
              </p>
            </div>
            <Palette className="w-10 h-10 text-emerald-500" />
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
              <p className="text-gray-600 text-sm">Total Capacity</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalCapacity}
              </p>
              <p className="text-xs text-gray-500 mt-1">parts/month</p>
            </div>
            <Package className="w-10 h-10 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Avg Utilization</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">
                {stats.avgUtilization}%
              </p>
            </div>
            <Sparkles className="w-10 h-10 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Finishes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {finishes.map((finish) => {
          const utilizationPercent =
            finish.capacity > 0
              ? (finish.currentUtilization / finish.capacity) * 100
              : 0;
          return (
            <Card
              key={finish.id}
              className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={20} className="text-emerald-600" />
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
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedFinish(finish)}
                      className="hover:bg-gray-100"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingFinish({ ...finish })}
                      className="hover:bg-gray-100"
                    >
                      <Edit size={16} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      Available Colors
                    </p>
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

                  {finish.equipmentAvailable ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          Capacity Utilization
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                utilizationPercent > 80
                                  ? "bg-orange-500"
                                  : utilizationPercent > 50
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{
                                width: `${Math.min(utilizationPercent, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 font-medium min-w-[45px]">
                            {utilizationPercent.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {finish.currentUtilization} / {finish.capacity}{" "}
                          parts/month
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-600">
                        Equipment not available
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-100 mt-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleStatus(finish.id)}
                    className={`flex-1 ${
                      finish.status === "active"
                        ? "hover:bg-gray-100"
                        : "hover:bg-emerald-50 hover:text-emerald-600"
                    }`}
                  >
                    {finish.status === "active" ? "Deactivate" : "Activate"}
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
          );
        })}
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
                <Palette className="text-emerald-600" />
                {selectedFinish.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex gap-2">
                <Badge
                  className={`${selectedFinish.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"} border-0`}
                >
                  {selectedFinish.status}
                </Badge>
                <Badge className="bg-purple-100 text-purple-700 border-0">
                  {selectedFinish.type}
                </Badge>
                {selectedFinish.equipmentAvailable && (
                  <Badge className="bg-blue-100 text-blue-700 border-0">
                    Equipment Available
                  </Badge>
                )}
              </div>

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
                      <span className="font-medium">Cost per Part:</span> $
                      {selectedFinish.costPerPart.toFixed(2)}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Lead Time:</span>{" "}
                      {selectedFinish.leadTimeDays} days
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Capacity
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Monthly Capacity:</span>{" "}
                      {selectedFinish.capacity} parts
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Current Load:</span>{" "}
                      {selectedFinish.currentUtilization} parts
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Available:</span>{" "}
                      {selectedFinish.capacity -
                        selectedFinish.currentUtilization}{" "}
                      parts
                    </p>
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
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Edit size={16} className="mr-2" />
                  Edit Capability
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {editingFinish
                  ? "Edit Finishing Capability"
                  : "Add New Capability"}
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
                    placeholder="Anodized Type II"
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
                            type: value as SupplierFinish["type"],
                          })
                        : setNewFinish({
                            ...newFinish,
                            type: value as SupplierFinish["type"],
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
                  placeholder="Detailed description of the finishing process..."
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
                  <Label>Capacity (parts/month)</Label>
                  <Input
                    type="number"
                    value={
                      editingFinish
                        ? editingFinish.capacity
                        : newFinish.capacity || ""
                    }
                    onChange={(e) =>
                      editingFinish
                        ? setEditingFinish({
                            ...editingFinish,
                            capacity: parseInt(e.target.value),
                          })
                        : setNewFinish({
                            ...newFinish,
                            capacity: parseInt(e.target.value),
                          })
                    }
                    placeholder="500"
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      editingFinish
                        ? editingFinish.equipmentAvailable
                        : newFinish.equipmentAvailable
                    }
                    onChange={(e) =>
                      editingFinish
                        ? setEditingFinish({
                            ...editingFinish,
                            equipmentAvailable: e.target.checked,
                          })
                        : setNewFinish({
                            ...newFinish,
                            equipmentAvailable: e.target.checked,
                          })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">
                    Equipment Available
                  </span>
                </label>
              </div>

              <div>
                <Label>Available Colors (comma-separated)</Label>
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
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle size={16} className="mr-2" />
                    Update Capability
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
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Add Capability
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
