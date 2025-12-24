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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Eye,
  MessageSquare,
  Package,
  Factory,
  User,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Settings,
} from "lucide-react";
import {
  getOrders,
  getCustomers,
  getSuppliers,
  getMachines,
  getMessages,
  createOrder,
  assignSupplierToOrder,
  Order,
  Customer,
  Supplier,
  Machine,
  Message,
} from "@/lib/mockDataStore";
import Link from "next/link";

export default function AdminOverviewPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [showAssignSupplierDialog, setShowAssignSupplierDialog] =
    useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newOrder, setNewOrder] = useState({
    customer_id: "",
    notes: "",
    shipping_address: "",
    priority: "medium" as const,
    due_date: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setOrders(getOrders());
    setCustomers(getCustomers());
    setSuppliers(getSuppliers());
    setMachines(getMachines());
    setMessages(getMessages());
  };

  const handleCreateOrder = () => {
    const customer = customers.find((c) => c.id === newOrder.customer_id);
    if (!customer) return;

    const order = createOrder({
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: customer.email,
      status: "draft",
      total_value: 0,
      parts_count: 0,
      notes: newOrder.notes,
      shipping_address: newOrder.shipping_address || customer.address,
      priority: newOrder.priority,
      due_date: newOrder.due_date
        ? new Date(newOrder.due_date).toISOString()
        : undefined,
      payment_status: "pending",
    });

    setOrders([...orders, order]);
    setShowCreateOrderDialog(false);
    setNewOrder({
      customer_id: "",
      notes: "",
      shipping_address: "",
      priority: "medium",
      due_date: "",
    });
  };

  const handleAssignSupplier = (supplierId: string) => {
    if (!selectedOrder) return;

    const updated = assignSupplierToOrder(selectedOrder.id, supplierId);
    if (updated) {
      setOrders(orders.map((o) => (o.id === updated.id ? updated : o)));
      setShowAssignSupplierDialog(false);
      setSelectedOrder(null);
    }
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

  // Calculate comprehensive stats
  const stats = {
    totalOrders: orders.length,
    activeOrders: orders.filter((o) =>
      ["quoted", "approved", "in_production", "quality_check"].includes(
        o.status,
      ),
    ).length,
    totalRevenue: orders.reduce((sum, o) => sum + o.total_value, 0),
    totalCustomers: customers.length,
    activeCustomers: customers.filter((c) => c.status === "active").length,
    totalSuppliers: suppliers.length,
    activeSuppliers: suppliers.filter((s) => s.status === "active").length,
    totalMachines: machines.length,
    operationalMachines: machines.filter((m) => m.status === "operational")
      .length,
    avgMachineUtilization:
      machines.length > 0
        ? Math.round(
            machines.reduce((sum, m) => sum + m.current_utilization, 0) /
              machines.length,
          )
        : 0,
    unreadMessages: messages.filter(
      (m) => m.recipient_role === "admin" && !m.read,
    ).length,
  };

  const recentOrders = orders
    .slice(0, 10)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );

  const urgentOrders = orders.filter(
    (o) =>
      o.priority === "urgent" &&
      o.status !== "delivered" &&
      o.status !== "cancelled",
  );

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Complete system overview and management
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/messages">
            <Button variant="outline" className="border-gray-300 relative">
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages
              {stats.unreadMessages > 0 && (
                <Badge className="absolute -top-2 -right-2 bg-red-500 text-white px-2">
                  {stats.unreadMessages}
                </Badge>
              )}
            </Button>
          </Link>
          <Button
            onClick={() => setShowCreateOrderDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Order
          </Button>
        </div>
      </div>

      {/* Top Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalOrders}
              </p>
              <p className="text-sm text-green-600 mt-1">
                {stats.activeOrders} active
              </p>
            </div>
            <Package className="w-10 h-10 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                ${(stats.totalRevenue / 1000).toFixed(0)}K
              </p>
              <p className="text-sm text-gray-600 mt-1">All time</p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Customers</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalCustomers}
              </p>
              <p className="text-sm text-green-600 mt-1">
                {stats.activeCustomers} active
              </p>
            </div>
            <User className="w-10 h-10 text-purple-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Suppliers</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalSuppliers}
              </p>
              <p className="text-sm text-green-600 mt-1">
                {stats.activeSuppliers} active
              </p>
            </div>
            <Factory className="w-10 h-10 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Capacity & Machines Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Machines</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalMachines}
              </p>
              <p className="text-sm text-green-600 mt-1">
                {stats.operationalMachines} operational
              </p>
            </div>
            <Settings className="w-10 h-10 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Avg Utilization</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.avgMachineUtilization}%
              </p>
              <p className="text-sm text-gray-600 mt-1">Across all machines</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Unread Messages</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.unreadMessages}
              </p>
              <p className="text-sm text-gray-600 mt-1">Requires attention</p>
            </div>
            <MessageSquare className="w-10 h-10 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Urgent Orders Alert */}
      {urgentOrders.length > 0 && (
        <Card className="bg-red-50 border-red-200 shadow-sm p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Urgent Orders Requiring Attention
              </h3>
              <div className="space-y-2">
                {urgentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between bg-white rounded-lg p-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.id} - {order.customer_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {order.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button size="sm" className="bg-red-600 hover:bg-red-700">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="bg-white border border-gray-200">
          <TabsTrigger value="orders">Recent Orders</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="machines">Machines</TabsTrigger>
        </TabsList>

        {/* Recent Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card className="bg-white border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Orders
              </h2>
              <Link href="/admin/orders">
                <Button variant="outline" size="sm" className="border-gray-300">
                  View All Orders
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {order.id}
                      </h3>
                      {getStatusBadge(order.status)}
                      {order.priority === "urgent" && (
                        <Badge className="bg-red-500/10 text-red-600 text-xs">
                          URGENT
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {order.customer_name} • {order.parts_count} parts
                    </p>
                    <p className="text-sm text-gray-500">
                      Updated {new Date(order.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-xl font-bold text-gray-900">
                      ${order.total_value.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      {order.supplier_name || "No supplier"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-300"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    {!order.supplier_id && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowAssignSupplierDialog(true);
                        }}
                      >
                        Assign Supplier
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <Card className="bg-white border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                All Customers
              </h2>
              <Link href="/admin/customers">
                <Button variant="outline" size="sm" className="border-gray-300">
                  Manage Customers
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {customer.name}
                      </h3>
                      <Badge
                        className={`text-xs ${
                          customer.status === "active"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-gray-500/10 text-gray-600"
                        }`}
                      >
                        {customer.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {customer.company} • {customer.email}
                    </p>
                    <p className="text-sm text-gray-500">
                      {customer.city}, {customer.state}
                    </p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-lg font-bold text-gray-900">
                      {customer.total_orders} orders
                    </p>
                    <p className="text-sm text-green-600">
                      ${(customer.total_spent / 1000).toFixed(0)}K spent
                    </p>
                  </div>
                  <Link href={`/admin/customers/${customer.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-300"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <Card className="bg-white border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                All Suppliers
              </h2>
              <Link href="/admin/suppliers">
                <Button variant="outline" size="sm" className="border-gray-300">
                  Manage Suppliers
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {supplier.name}
                      </h3>
                      <Badge
                        className={`text-xs ${
                          supplier.status === "active"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-gray-500/10 text-gray-600"
                        }`}
                      >
                        {supplier.status.toUpperCase()}
                      </Badge>
                      <Badge className="bg-yellow-500/10 text-yellow-600 text-xs">
                        ⭐ {supplier.rating.toFixed(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {supplier.city}, {supplier.state}
                    </p>
                    <p className="text-sm text-gray-500">
                      {supplier.completed_orders}/{supplier.total_orders}{" "}
                      completed •{supplier.on_time_delivery}% on-time •
                      {supplier.quality_score}% quality
                    </p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-sm text-gray-600">Capacity</p>
                    <p
                      className={`text-lg font-bold ${
                        supplier.capacity_utilization >= 90
                          ? "text-red-600"
                          : supplier.capacity_utilization >= 75
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      {supplier.capacity_utilization}%
                    </p>
                  </div>
                  <Link href={`/admin/suppliers/${supplier.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-300"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Machines Tab */}
        <TabsContent value="machines" className="space-y-4">
          <Card className="bg-white border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                All Machines
              </h2>
              <p className="text-sm text-gray-600">
                {stats.operationalMachines} operational • Avg{" "}
                {stats.avgMachineUtilization}% utilized
              </p>
            </div>
            <div className="space-y-3">
              {machines.map((machine) => {
                const supplier = suppliers.find(
                  (s) => s.id === machine.supplier_id,
                );
                return (
                  <div
                    key={machine.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {machine.name}
                        </h3>
                        <Badge
                          className={`text-xs ${
                            machine.status === "operational"
                              ? "bg-green-500/10 text-green-600"
                              : machine.status === "maintenance"
                                ? "bg-yellow-500/10 text-yellow-600"
                                : "bg-red-500/10 text-red-600"
                          }`}
                        >
                          {machine.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {machine.manufacturer} {machine.model} ({machine.year})
                      </p>
                      <p className="text-sm text-gray-500">
                        Supplier: {supplier?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Utilization</p>
                      <p
                        className={`text-lg font-bold ${
                          machine.current_utilization >= 90
                            ? "text-red-600"
                            : machine.current_utilization >= 75
                              ? "text-yellow-600"
                              : "text-green-600"
                        }`}
                      >
                        {machine.current_utilization}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {machine.capacity_hours_per_week}h/week capacity
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Order Dialog */}
      <Dialog
        open={showCreateOrderDialog}
        onOpenChange={setShowCreateOrderDialog}
      >
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Create New Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-900">Customer *</Label>
              <select
                value={newOrder.customer_id}
                onChange={(e) => {
                  const customer = customers.find(
                    (c) => c.id === e.target.value,
                  );
                  setNewOrder({
                    ...newOrder,
                    customer_id: e.target.value,
                    shipping_address: customer?.address || "",
                  });
                }}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
              >
                <option value="">Select a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.company}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-900">Priority</Label>
                <select
                  value={newOrder.priority}
                  onChange={(e) =>
                    setNewOrder({
                      ...newOrder,
                      priority: e.target.value as any,
                    })
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
              onClick={() => setShowCreateOrderDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrder}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!newOrder.customer_id}
            >
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Supplier Dialog */}
      <Dialog
        open={showAssignSupplierDialog}
        onOpenChange={setShowAssignSupplierDialog}
      >
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Assign Supplier to Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedOrder && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-blue-900">
                  Order: {selectedOrder.id}
                </p>
                <p className="text-sm text-blue-700">
                  Customer: {selectedOrder.customer_name}
                </p>
                <p className="text-sm text-blue-700">
                  Value: ${selectedOrder.total_value.toLocaleString()}
                </p>
              </div>
            )}
            <div className="space-y-3">
              <Label className="text-gray-900">Select Supplier</Label>
              {suppliers
                .filter((s) => s.status === "active")
                .map((supplier) => (
                  <Card
                    key={supplier.id}
                    className="p-4 cursor-pointer hover:bg-blue-50 border-2 border-transparent hover:border-blue-300"
                    onClick={() => handleAssignSupplier(supplier.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {supplier.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {supplier.city}, {supplier.state}
                        </p>
                        <div className="flex gap-3 mt-2 text-xs text-gray-600">
                          <span>⭐ {supplier.rating.toFixed(1)}</span>
                          <span>• {supplier.on_time_delivery}% on-time</span>
                          <span>• {supplier.quality_score}% quality</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-lg font-bold ${
                            supplier.capacity_utilization >= 90
                              ? "text-red-600"
                              : supplier.capacity_utilization >= 75
                                ? "text-yellow-600"
                                : "text-green-600"
                          }`}
                        >
                          {supplier.capacity_utilization}%
                        </p>
                        <p className="text-xs text-gray-600">capacity</p>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
