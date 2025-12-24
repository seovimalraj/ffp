"use client";

import { useState, useEffect } from "react";
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
  Plus,
  Search,
  Package,
  MessageSquare,
  Eye,
  Trash2,
  Upload,
  FileText,
  DollarSign,
} from "lucide-react";
import {
  getOrdersByCustomer,
  createOrder,
  deleteOrder,
  createMessage,
  Order,
} from "@/lib/mockDataStore";
import Link from "next/link";

const CURRENT_CUSTOMER_ID = "CUST-001"; // Mock current user

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newOrder, setNewOrder] = useState({
    notes: "",
    shipping_address: "123 Innovation Drive, San Francisco, CA 94105",
    priority: "medium" as const,
    due_date: "",
  });
  const [newMessage, setNewMessage] = useState({ subject: "", message: "" });

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = () => {
    const customerOrders = getOrdersByCustomer(CURRENT_CUSTOMER_ID);
    setOrders(customerOrders);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateOrder = () => {
    const order = createOrder({
      customer_id: CURRENT_CUSTOMER_ID,
      customer_name: "John Smith",
      customer_email: "john.smith@techcorp.com",
      status: "draft",
      total_value: 0,
      parts_count: 0,
      notes: newOrder.notes,
      shipping_address: newOrder.shipping_address,
      priority: newOrder.priority,
      due_date: newOrder.due_date
        ? new Date(newOrder.due_date).toISOString()
        : undefined,
      payment_status: "pending",
    });

    setOrders([...orders, order]);
    setShowCreateDialog(false);
    setNewOrder({
      notes: "",
      shipping_address: "123 Innovation Drive, San Francisco, CA 94105",
      priority: "medium",
      due_date: "",
    });
  };

  const handleDeleteOrder = (orderId: string) => {
    if (confirm("Are you sure you want to delete this order?")) {
      deleteOrder(orderId);
      loadOrders();
    }
  };

  const handleSendMessage = () => {
    if (!selectedOrder) return;

    createMessage({
      thread_id: `THREAD-${selectedOrder.id}`,
      sender_id: CURRENT_CUSTOMER_ID,
      sender_name: "John Smith",
      sender_role: "customer",
      recipient_id: "ADMIN-001",
      recipient_name: "Admin",
      recipient_role: "admin",
      subject: newMessage.subject,
      message: newMessage.message,
      read: false,
      order_id: selectedOrder.id,
    });

    setShowMessageDialog(false);
    setNewMessage({ subject: "", message: "" });
    alert("Message sent successfully!");
  };

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

  const getPriorityBadge = (priority: Order["priority"]) => {
    const variants: Record<Order["priority"], string> = {
      low: "bg-gray-500/10 text-gray-600",
      medium: "bg-blue-500/10 text-blue-600",
      high: "bg-orange-500/10 text-orange-600",
      urgent: "bg-red-500/10 text-red-600",
    };

    return (
      <Badge className={`${variants[priority]} text-xs`}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const stats = {
    total: orders.length,
    active: orders.filter((o) =>
      ["quoted", "approved", "in_production", "quality_check"].includes(
        o.status,
      ),
    ).length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    totalValue: orders.reduce((sum, o) => sum + o.total_value, 0),
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">My Orders</h1>
          <p className="text-gray-400 mt-1">
            Track and manage your manufacturing orders
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Order
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.total}
              </p>
            </div>
            <Package className="w-10 h-10 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.active}
              </p>
            </div>
            <FileText className="w-10 h-10 text-purple-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Shipped</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.shipped}
              </p>
            </div>
            <Upload className="w-10 h-10 text-green-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Value</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                ${(stats.totalValue / 1000).toFixed(1)}K
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="bg-white border-gray-200 shadow-sm p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search orders by ID or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-gray-300 text-gray-900"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="quoted">Quoted</option>
            <option value="approved">Approved</option>
            <option value="in_production">In Production</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </Card>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <Card
            key={order.id}
            className="bg-white border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-gray-900">
                    {order.id}
                  </h3>
                  {getStatusBadge(order.status)}
                  {getPriorityBadge(order.priority)}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Created {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  ${order.total_value.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">
                  {order.parts_count} parts
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-600">Supplier</p>
                <p className="text-sm font-medium text-gray-900">
                  {order.supplier_name || "Not assigned"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Due Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {order.due_date
                    ? new Date(order.due_date).toLocaleDateString()
                    : "TBD"}
                </p>
              </div>
            </div>

            {order.notes && (
              <div className="mb-4">
                <p className="text-xs text-gray-600">Notes</p>
                <p className="text-sm text-gray-900">{order.notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/portal/my-orders/${order.id}`}>
                <Button variant="outline" size="sm" className="border-gray-300">
                  <Eye className="w-4 h-4 mr-1" />
                  View Details
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-300"
                onClick={() => {
                  setSelectedOrder(order);
                  setNewMessage({
                    subject: `Question about ${order.id}`,
                    message: "",
                  });
                  setShowMessageDialog(true);
                }}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Message Admin
              </Button>
              {order.status === "draft" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => handleDeleteOrder(order.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </Card>
        ))}

        {filteredOrders.length === 0 && (
          <Card className="bg-white border-gray-200 shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No orders found
            </h3>
            <p className="text-gray-600 mb-4">
              Get started by creating your first order
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Order
            </Button>
          </Card>
        )}
      </div>

      {/* Create Order Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Create New Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-900">Shipping Address</Label>
              <Textarea
                value={newOrder.shipping_address}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, shipping_address: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-gray-900">Priority</Label>
              <select
                value={newOrder.priority}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, priority: e.target.value as any })
                }
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <Label className="text-gray-900">Due Date (optional)</Label>
              <Input
                type="date"
                value={newOrder.due_date}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, due_date: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-900">Notes (optional)</Label>
              <Textarea
                value={newOrder.notes}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, notes: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
                rows={3}
                placeholder="Special requirements, delivery instructions, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrder}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Send Message to Admin
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-900">Subject</Label>
              <Input
                value={newMessage.subject}
                onChange={(e) =>
                  setNewMessage({ ...newMessage, subject: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="Question about my order"
              />
            </div>
            <div>
              <Label className="text-gray-900">Message</Label>
              <Textarea
                value={newMessage.message}
                onChange={(e) =>
                  setNewMessage({ ...newMessage, message: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
                rows={6}
                placeholder="Type your message here..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMessageDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
