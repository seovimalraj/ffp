"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Upload,
  Trash2,
  Eye,
  FileText,
  Package,
  DollarSign,
  Calendar,
  User,
  Edit,
} from "lucide-react";
import {
  getOrder,
  updateOrder,
  getPartsByOrder,
  createPart,
  updatePart,
  deletePart,
  Part,
  Order,
} from "@/lib/mockDataStore";

export default function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [showAddPartDialog, setShowAddPartDialog] = useState(false);
  const [showEditPartDialog, setShowEditPartDialog] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [newPart, setNewPart] = useState({
    name: "",
    file_name: "",
    material: "Aluminum 6061-T6",
    quantity: 1,
    unit_price: 0,
    tolerance: '±0.010"',
    finish: "As Machined",
    notes: "",
  });

  useEffect(() => {
    const orderId = params.id;
    const loadedOrder = getOrder(orderId);
    if (loadedOrder) {
      setOrder(loadedOrder);
      const loadedParts = getPartsByOrder(orderId);
      setParts(loadedParts);
    }
  }, [params.id]);

  const handleAddPart = () => {
    if (!order) return;

    const totalPrice = newPart.unit_price * newPart.quantity;

    const part = createPart({
      order_id: order.id,
      name: newPart.name,
      file_name: newPart.file_name || `${newPart.name}.step`,
      file_url: "/samples/cube.stl",
      material: newPart.material,
      quantity: newPart.quantity,
      unit_price: newPart.unit_price,
      total_price: totalPrice,
      tolerance: newPart.tolerance,
      finish: newPart.finish,
      notes: newPart.notes,
      status: "pending",
    });

    const updatedParts = [...parts, part];
    setParts(updatedParts);

    // Update order totals
    const newTotal = updatedParts.reduce((sum, p) => sum + p.total_price, 0);
    const updated = updateOrder(order.id, {
      total_value: newTotal,
      parts_count: updatedParts.length,
      status: order.status === "draft" ? "pending_approval" : order.status,
    });
    if (updated) setOrder(updated);

    setShowAddPartDialog(false);
    setNewPart({
      name: "",
      file_name: "",
      material: "Aluminum 6061-T6",
      quantity: 1,
      unit_price: 0,
      tolerance: '±0.010"',
      finish: "As Machined",
      notes: "",
    });
  };

  const handleUpdatePart = () => {
    if (!editingPart || !order) return;

    const totalPrice = editingPart.unit_price * editingPart.quantity;
    const updated = updatePart(editingPart.id, {
      ...editingPart,
      total_price: totalPrice,
    });

    if (updated) {
      const updatedParts = parts.map((p) =>
        p.id === updated.id ? updated : p,
      );
      setParts(updatedParts);

      // Update order totals
      const newTotal = updatedParts.reduce((sum, p) => sum + p.total_price, 0);
      const updatedOrder = updateOrder(order.id, {
        total_value: newTotal,
      });
      if (updatedOrder) setOrder(updatedOrder);
    }

    setShowEditPartDialog(false);
    setEditingPart(null);
  };

  const handleDeletePart = (partId: string) => {
    if (!order) return;
    if (!confirm("Are you sure you want to delete this part?")) return;

    deletePart(partId);
    const updatedParts = parts.filter((p) => p.id !== partId);
    setParts(updatedParts);

    // Update order totals
    const newTotal = updatedParts.reduce((sum, p) => sum + p.total_price, 0);
    const updated = updateOrder(order.id, {
      total_value: newTotal,
      parts_count: updatedParts.length,
    });
    if (updated) setOrder(updated);
  };

  if (!order) {
    return (
      <div className="p-8">
        <Card className="bg-white border-gray-200 shadow-sm p-12 text-center">
          <p className="text-gray-600">Order not found</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: Order["status"]) => {
    const variants: Record<Order["status"], string> = {
      draft: "bg-gray-500/10 text-gray-600 border-gray-500/20",
      quoted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      pending_approval: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      approved: "bg-green-500/10 text-green-600 border-green-500/20",
      in_production: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      quality_check: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      shipped: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
      delivered: "bg-green-600/10 text-green-700 border-green-600/20",
      cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
    };

    return (
      <Badge className={`${variants[status]} border text-xs`}>
        {status.replace(/_/g, " ").toUpperCase()}
      </Badge>
    );
  };

  const materials = [
    "Aluminum 6061-T6",
    "Aluminum 7075-T6",
    "Stainless Steel 304",
    "Stainless Steel 316",
    "Titanium Ti-6Al-4V",
    "Brass C360",
    "Copper C110",
    "ABS Plastic",
    "Nylon PA6",
  ];

  const finishes = [
    "As Machined",
    "Anodized Type II",
    "Anodized Type III",
    "Powder Coated",
    "Passivated",
    "Polished",
    "Bead Blasted",
    "Tumbled",
  ];

  const tolerances = ['±0.002"', '±0.005"', '±0.010"', '±0.020"', '±0.030"'];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="border-gray-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{order.id}</h1>
              {getStatusBadge(order.status)}
            </div>
            <p className="text-gray-400 mt-1">
              Created {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-white">
            ${order.total_value.toLocaleString()}
          </p>
          <p className="text-gray-400">{order.parts_count} parts</p>
        </div>
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Order Information
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600">Customer</p>
                <p className="text-sm font-medium text-gray-900">
                  {order.customer_name}
                </p>
                <p className="text-xs text-gray-600">{order.customer_email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600">Supplier</p>
                <p className="text-sm font-medium text-gray-900">
                  {order.supplier_name || "Not assigned yet"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600">Due Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {order.due_date
                    ? new Date(order.due_date).toLocaleDateString()
                    : "Not set"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600">Payment Status</p>
                <Badge
                  className={`text-xs ${
                    order.payment_status === "paid"
                      ? "bg-green-500/10 text-green-600"
                      : order.payment_status === "partial"
                        ? "bg-yellow-500/10 text-yellow-600"
                        : "bg-gray-500/10 text-gray-600"
                  }`}
                >
                  {order.payment_status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Shipping & Notes
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-600 mb-1">Shipping Address</p>
              <p className="text-sm text-gray-900">{order.shipping_address}</p>
            </div>
            {order.notes && (
              <div>
                <p className="text-xs text-gray-600 mb-1">Order Notes</p>
                <p className="text-sm text-gray-900">{order.notes}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-600 mb-1">Priority</p>
              <Badge
                className={`text-xs ${
                  order.priority === "urgent"
                    ? "bg-red-500/10 text-red-600"
                    : order.priority === "high"
                      ? "bg-orange-500/10 text-orange-600"
                      : order.priority === "medium"
                        ? "bg-blue-500/10 text-blue-600"
                        : "bg-gray-500/10 text-gray-600"
                }`}
              >
                {order.priority.toUpperCase()}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Parts Section */}
      <Card className="bg-white border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Parts ({parts.length})
          </h2>
          <Button
            onClick={() => setShowAddPartDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Add Part
          </Button>
        </div>

        {parts.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No parts yet
            </h3>
            <p className="text-gray-600 mb-4">
              Add parts to your order to get started
            </p>
            <Button
              onClick={() => setShowAddPartDialog(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Add First Part
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {parts.map((part) => (
              <Card key={part.id} className="bg-gray-50 border-gray-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{part.name}</h3>
                    <p className="text-sm text-gray-600">{part.file_name}</p>
                  </div>
                  <Badge className="bg-blue-500/10 text-blue-600 text-xs">
                    {part.status.toUpperCase()}
                  </Badge>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-600">Material</p>
                    <p className="text-sm font-medium text-gray-900">
                      {part.material}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Quantity</p>
                    <p className="text-sm font-medium text-gray-900">
                      {part.quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Unit Price</p>
                    <p className="text-sm font-medium text-gray-900">
                      ${part.unit_price}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total</p>
                    <p className="text-sm font-bold text-gray-900">
                      ${part.total_price.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-600">Tolerance</p>
                    <p className="text-sm text-gray-900">{part.tolerance}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Finish</p>
                    <p className="text-sm text-gray-900">{part.finish}</p>
                  </div>
                </div>

                {part.notes && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-600">Notes</p>
                    <p className="text-sm text-gray-900">{part.notes}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-300"
                    onClick={() => {
                      setEditingPart(part);
                      setShowEditPartDialog(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-300"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View 3D
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => handleDeletePart(part.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Add Part Dialog */}
      <Dialog open={showAddPartDialog} onOpenChange={setShowAddPartDialog}>
        <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Add Part to Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-900">Part Name *</Label>
              <Input
                value={newPart.name}
                onChange={(e) =>
                  setNewPart({ ...newPart, name: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="Housing Component"
              />
            </div>
            <div>
              <Label className="text-gray-900">File Name</Label>
              <Input
                value={newPart.file_name}
                onChange={(e) =>
                  setNewPart({ ...newPart, file_name: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="housing_v3.step (optional)"
              />
            </div>
            <div>
              <Label className="text-gray-900">Material *</Label>
              <select
                value={newPart.material}
                onChange={(e) =>
                  setNewPart({ ...newPart, material: e.target.value })
                }
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
              >
                {materials.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-900">Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={newPart.quantity}
                  onChange={(e) =>
                    setNewPart({
                      ...newPart,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-900">Unit Price ($) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPart.unit_price}
                  onChange={(e) =>
                    setNewPart({
                      ...newPart,
                      unit_price: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-900">Tolerance</Label>
                <select
                  value={newPart.tolerance}
                  onChange={(e) =>
                    setNewPart({ ...newPart, tolerance: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                >
                  {tolerances.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-gray-900">Finish</Label>
                <select
                  value={newPart.finish}
                  onChange={(e) =>
                    setNewPart({ ...newPart, finish: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                >
                  {finishes.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-gray-900">Notes (optional)</Label>
              <Textarea
                value={newPart.notes}
                onChange={(e) =>
                  setNewPart({ ...newPart, notes: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
                rows={3}
                placeholder="Special requirements or instructions"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900">
                Total for this part
              </p>
              <p className="text-2xl font-bold text-blue-600">
                ${(newPart.unit_price * newPart.quantity).toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddPartDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPart}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!newPart.name || newPart.unit_price <= 0}
            >
              <Upload className="w-4 h-4 mr-2" />
              Add Part
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Part Dialog */}
      <Dialog open={showEditPartDialog} onOpenChange={setShowEditPartDialog}>
        <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit Part</DialogTitle>
          </DialogHeader>
          {editingPart && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-gray-900">Part Name *</Label>
                <Input
                  value={editingPart.name}
                  onChange={(e) =>
                    setEditingPart({ ...editingPart, name: e.target.value })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-900">Material *</Label>
                <select
                  value={editingPart.material}
                  onChange={(e) =>
                    setEditingPart({ ...editingPart, material: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                >
                  {materials.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editingPart.quantity}
                    onChange={(e) =>
                      setEditingPart({
                        ...editingPart,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    className="bg-white border-gray-300 text-gray-900 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-900">Unit Price ($) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingPart.unit_price}
                    onChange={(e) =>
                      setEditingPart({
                        ...editingPart,
                        unit_price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="bg-white border-gray-300 text-gray-900 mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Tolerance</Label>
                  <select
                    value={editingPart.tolerance}
                    onChange={(e) =>
                      setEditingPart({
                        ...editingPart,
                        tolerance: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  >
                    {tolerances.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-gray-900">Finish</Label>
                  <select
                    value={editingPart.finish}
                    onChange={(e) =>
                      setEditingPart({ ...editingPart, finish: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  >
                    {finishes.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-gray-900">Notes</Label>
                <Textarea
                  value={editingPart.notes || ""}
                  onChange={(e) =>
                    setEditingPart({ ...editingPart, notes: e.target.value })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                  rows={3}
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900">
                  Total for this part
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  $
                  {(
                    editingPart.unit_price * editingPart.quantity
                  ).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditPartDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdatePart}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
