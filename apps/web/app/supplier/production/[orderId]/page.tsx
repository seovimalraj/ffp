"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Package,
  Clock,
  AlertCircle,
  CheckCircle,
  FileText,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  getOrder,
  getKanbanState,
  updateKanbanStatus,
  createKanbanState,
} from "../../../../lib/database";

interface PartCard {
  id: string;
  part_id: string;
  part_name: string;
  status: "setup" | "cutting" | "finishing" | "inspection" | "done";
  notes: string;
  updated_at: string;
}

export default function SupplierKanbanPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId as string;

  const [orderData, setOrderData] = useState<any>(null);
  const [parts, setParts] = useState<PartCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedPart, setDraggedPart] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<PartCard | null>(null);
  const [newNote, setNewNote] = useState("");
  const [showNoteDialog, setShowNoteDialog] = useState(false);

  useEffect(() => {
    loadProductionData();
  }, [orderId]);

  const loadProductionData = async () => {
    if (!orderId) return;

    try {
      setLoading(true);

      // Load order data
      const order = await getOrder(orderId);
      if (!order) {
        alert("Order not found");
        router.push("/supplier/rfqs");
        return;
      }
      setOrderData(order);

      // Load kanban state
      const kanbanData = await getKanbanState(orderId);

      // If no kanban state exists, initialize from order parts
      if (kanbanData.length === 0 && order.parts) {
        const initialStates = [];
        for (const part of order.parts) {
          const newState = await createKanbanState(
            orderId,
            part.id || `part-${Math.random().toString(36).substr(2, 9)}`,
            part.file_name || "Unnamed Part",
          );
          initialStates.push(newState);
        }
        setParts(initialStates);
      } else {
        setParts(kanbanData);
      }
    } catch (error) {
      console.error("Error loading production data:", error);
      alert("Failed to load production data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveKanbanState = async (
    partId: string,
    status: string,
    notes?: string,
  ) => {
    try {
      await updateKanbanStatus(partId, orderId, status, notes);
      await loadProductionData(); // Reload to get latest state
    } catch (error) {
      console.error("Error updating kanban state:", error);
      alert("Failed to update status. Please try again.");
    }
  };

  const handleDragStart = (partId: string) => {
    setDraggedPart(partId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: PartCard["status"]) => {
    if (!draggedPart) return;

    await saveKanbanState(draggedPart, status);
    setDraggedPart(null);
  };

  const handleAddNote = async () => {
    if (!selectedPart || !newNote.trim()) return;

    const currentNotes = selectedPart.notes || "";
    const timestamp = new Date().toLocaleString();
    const updatedNotes = currentNotes
      ? `${currentNotes}\n${timestamp}: ${newNote}`
      : `${timestamp}: ${newNote}`;

    await saveKanbanState(
      selectedPart.part_id,
      selectedPart.status,
      updatedNotes,
    );
    setNewNote("");
    setShowNoteDialog(false);
    setSelectedPart(null);
  };

  const columns = [
    { id: "setup", title: "Setup", icon: Package, color: "gray" },
    { id: "cutting", title: "Cutting", icon: Clock, color: "blue" },
    { id: "finishing", title: "Finishing", icon: FileText, color: "purple" },
    {
      id: "inspection",
      title: "Inspection",
      icon: AlertCircle,
      color: "orange",
    },
    { id: "done", title: "Done", icon: CheckCircle, color: "green" },
  ] as const;

  const getPartsByStatus = (status: PartCard["status"]) => {
    return parts.filter((part) => part.status === status);
  };

  const getProgress = () => {
    if (parts.length === 0) return 0;
    const completed = parts.filter((p) => p.status === "done").length;
    return Math.round((completed / parts.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading production board...</p>
        </div>
      </div>
    );
  }

  if (!orderData) return <div>Order not found</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push("/supplier/orders")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              Production Board
            </h1>
            <p className="text-gray-600">Order #{orderData.id}</p>
          </div>
          <Badge className="bg-blue-100 text-blue-700 border-0 text-lg px-4 py-2">
            {getProgress()}% Complete
          </Badge>
        </div>

        {/* Privacy Notice */}
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-900">
              Customer Information Protected
            </p>
            <p className="text-sm text-yellow-800">
              Customer identity is masked for privacy. Focus on production and
              quality - all communication is handled through the platform.
            </p>
          </div>
        </div>

        {/* Order Summary */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Parts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {parts.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {parts.filter((p) => p.status === "done").length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {
                    parts.filter(
                      (p) =>
                        p.status === "cutting" ||
                        p.status === "finishing" ||
                        p.status === "inspection",
                    ).length
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Lead Time</p>
                <p className="text-2xl font-bold text-gray-900">
                  {orderData.lead_time} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {columns.map((column) => {
            const columnParts = getPartsByStatus(column.id);
            const Icon = column.icon;

            return (
              <div key={column.id}>
                <Card className="mb-4">
                  <CardHeader
                    className={`bg-${column.color}-50 border-b-2 border-${column.color}-200`}
                  >
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 text-${column.color}-600`} />
                        <span>{column.title}</span>
                      </div>
                      <Badge
                        className={`bg-${column.color}-100 text-${column.color}-700 border-0`}
                      >
                        {columnParts.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                </Card>

                <div
                  className="space-y-3 min-h-[400px] p-3 bg-gray-100/50 rounded-lg"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(column.id)}
                >
                  {columnParts.map((part) => (
                    <Card
                      key={part.id}
                      draggable
                      onDragStart={() => handleDragStart(part.part_id)}
                      className="cursor-move hover:shadow-lg transition-shadow bg-white"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-1">
                              {part.part_name}
                            </h3>
                          </div>
                        </div>

                        {part.notes && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-semibold text-gray-700 mb-2">
                              Notes:
                            </p>
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">
                              {part.notes.split("\n").slice(-2).join("\n")}
                            </p>
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-3"
                          onClick={() => {
                            setSelectedPart(part);
                            setShowNoteDialog(true);
                          }}
                        >
                          <MessageSquare className="w-3 h-3 mr-2" />
                          Add Update
                        </Button>

                        <p className="text-xs text-gray-400 mt-2">
                          Last updated:{" "}
                          {new Date(part.updated_at).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}

                  {columnParts.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No parts in this stage</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Instructions */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              📝 How to Use the Production Board
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <strong className="text-gray-900">1. Drag & Drop:</strong> Move
                part cards between columns as production progresses
              </div>
              <div>
                <strong className="text-gray-900">2. Add Updates:</strong> Click
                "Add Update" to log notes and progress
              </div>
              <div>
                <strong className="text-gray-900">3. Track Progress:</strong>{" "}
                Monitor the completion percentage at the top
              </div>
              <div>
                <strong className="text-gray-900">4. Quality Check:</strong>{" "}
                Move to QA Check before marking complete
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Note Dialog */}
        {showNoteDialog && selectedPart && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle>Add Update - {selectedPart.part_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="note">Progress Update</Label>
                  <Textarea
                    id="note"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Describe the current status, any issues, or completion details..."
                    rows={4}
                  />
                </div>

                {selectedPart.notes && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Previous Updates:
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded whitespace-pre-wrap">
                        {selectedPart.notes}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleAddNote}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Save Update
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNoteDialog(false);
                      setSelectedPart(null);
                      setNewNote("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
