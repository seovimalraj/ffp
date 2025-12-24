"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Webhook,
  Plus,
  Eye,
  Trash2,
  Edit,
  Search,
  CheckCircle,
  XCircle,
  Play,
  RefreshCw,
  Clock,
  Activity,
  Zap,
  Shield,
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
interface WebhookEvent {
  id: string;
  category:
    | "Orders"
    | "Quotes"
    | "Invoices"
    | "Parts"
    | "Suppliers"
    | "Shipments";
  event: string;
  description: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: "active" | "inactive";
  secret: string;
  contentType: "application/json" | "application/x-www-form-urlencoded";
  retryEnabled: boolean;
  maxRetries: number;
  timeout: number;
  createdAt: string;
  lastTriggered?: string;
  deliveryStats: {
    total: number;
    successful: number;
    failed: number;
  };
}

const AVAILABLE_EVENTS: WebhookEvent[] = [
  {
    id: "order.created",
    category: "Orders",
    event: "order.created",
    description: "Triggered when a new order is created",
  },
  {
    id: "order.updated",
    category: "Orders",
    event: "order.updated",
    description: "Triggered when an order is updated",
  },
  {
    id: "order.completed",
    category: "Orders",
    event: "order.completed",
    description: "Triggered when an order is completed",
  },
  {
    id: "order.cancelled",
    category: "Orders",
    event: "order.cancelled",
    description: "Triggered when an order is cancelled",
  },
  {
    id: "quote.created",
    category: "Quotes",
    event: "quote.created",
    description: "Triggered when a quote is created",
  },
  {
    id: "quote.approved",
    category: "Quotes",
    event: "quote.approved",
    description: "Triggered when a quote is approved",
  },
  {
    id: "quote.rejected",
    category: "Quotes",
    event: "quote.rejected",
    description: "Triggered when a quote is rejected",
  },
  {
    id: "invoice.created",
    category: "Invoices",
    event: "invoice.created",
    description: "Triggered when an invoice is created",
  },
  {
    id: "invoice.paid",
    category: "Invoices",
    event: "invoice.paid",
    description: "Triggered when an invoice is paid",
  },
  {
    id: "invoice.overdue",
    category: "Invoices",
    event: "invoice.overdue",
    description: "Triggered when an invoice becomes overdue",
  },
  {
    id: "part.uploaded",
    category: "Parts",
    event: "part.uploaded",
    description: "Triggered when a part file is uploaded",
  },
  {
    id: "part.analyzed",
    category: "Parts",
    event: "part.analyzed",
    description: "Triggered when DFM analysis completes",
  },
  {
    id: "supplier.registered",
    category: "Suppliers",
    event: "supplier.registered",
    description: "Triggered when a new supplier registers",
  },
  {
    id: "supplier.verified",
    category: "Suppliers",
    event: "supplier.verified",
    description: "Triggered when a supplier is verified",
  },
  {
    id: "shipment.created",
    category: "Shipments",
    event: "shipment.created",
    description: "Triggered when a shipment is created",
  },
  {
    id: "shipment.delivered",
    category: "Shipments",
    event: "shipment.delivered",
    description: "Triggered when a shipment is delivered",
  },
];

export default function AdminWebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([
    {
      id: "WH-001",
      name: "Order Notifications",
      url: "https://api.example.com/webhooks/orders",
      events: ["order.created", "order.completed", "order.cancelled"],
      status: "active",
      secret: "whsec_a3f8b9c2d1e4f5g6h7i8j9k0",
      contentType: "application/json",
      retryEnabled: true,
      maxRetries: 3,
      timeout: 30,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      deliveryStats: { total: 156, successful: 148, failed: 8 },
    },
    {
      id: "WH-002",
      name: "Quote Updates",
      url: "https://api.example.com/webhooks/quotes",
      events: ["quote.created", "quote.approved", "quote.rejected"],
      status: "active",
      secret: "whsec_b4g9c0d2e5f6g7h8i9j0k1",
      contentType: "application/json",
      retryEnabled: true,
      maxRetries: 5,
      timeout: 30,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      lastTriggered: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      deliveryStats: { total: 89, successful: 87, failed: 2 },
    },
    {
      id: "WH-003",
      name: "Payment Webhook",
      url: "https://api.example.com/webhooks/payments",
      events: ["invoice.paid", "invoice.created"],
      status: "inactive",
      secret: "whsec_c5h0d3e6f7g8h9i0j1k2",
      contentType: "application/json",
      retryEnabled: false,
      maxRetries: 0,
      timeout: 15,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      lastTriggered: new Date(
        Date.now() - 15 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      deliveryStats: { total: 42, successful: 35, failed: 7 },
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(
    null,
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(
    null,
  );
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState<Partial<WebhookConfig>>({
    events: [],
    status: "active",
    contentType: "application/json",
    retryEnabled: true,
    maxRetries: 3,
    timeout: 30,
  });

  const filteredWebhooks = webhooks.filter((webhook) => {
    const matchesSearch =
      webhook.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      webhook.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      webhook.events.some((e) =>
        e.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesStatus =
      statusFilter === "all" || webhook.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: webhooks.length,
    active: webhooks.filter((w) => w.status === "active").length,
    totalDeliveries: webhooks.reduce(
      (sum, w) => sum + w.deliveryStats.total,
      0,
    ),
    successRate:
      webhooks.reduce((sum, w) => sum + w.deliveryStats.total, 0) > 0
        ? (
            (webhooks.reduce((sum, w) => sum + w.deliveryStats.successful, 0) /
              webhooks.reduce((sum, w) => sum + w.deliveryStats.total, 0)) *
            100
          ).toFixed(1)
        : "0",
  };

  const generateSecret = () => {
    return (
      "whsec_" +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  };

  const handleCreateWebhook = () => {
    if (
      !newWebhook.name ||
      !newWebhook.url ||
      !newWebhook.events ||
      newWebhook.events.length === 0
    ) {
      alert("Please fill in all required fields and select at least one event");
      return;
    }

    const webhook: WebhookConfig = {
      id: `WH-${String(webhooks.length + 1).padStart(3, "0")}`,
      name: newWebhook.name!,
      url: newWebhook.url!,
      events: newWebhook.events!,
      status: "active",
      secret: generateSecret(),
      contentType: newWebhook.contentType || "application/json",
      retryEnabled:
        newWebhook.retryEnabled !== undefined ? newWebhook.retryEnabled : true,
      maxRetries: newWebhook.maxRetries || 3,
      timeout: newWebhook.timeout || 30,
      createdAt: new Date().toISOString(),
      deliveryStats: { total: 0, successful: 0, failed: 0 },
    };

    setWebhooks([...webhooks, webhook]);
    setShowCreateDialog(false);
    setNewWebhook({
      events: [],
      status: "active",
      contentType: "application/json",
      retryEnabled: true,
      maxRetries: 3,
      timeout: 30,
    });
    alert(`✅ Webhook "${webhook.name}" created successfully!`);
  };

  const handleUpdateWebhook = () => {
    if (!editingWebhook) return;

    setWebhooks(
      webhooks.map((w) => (w.id === editingWebhook.id ? editingWebhook : w)),
    );
    setEditingWebhook(null);
    alert(`✅ Webhook "${editingWebhook.name}" updated successfully!`);
  };

  const handleDeleteWebhook = (webhookId: string) => {
    const webhook = webhooks.find((w) => w.id === webhookId);
    if (
      confirm(
        `Are you sure you want to delete webhook "${webhook?.name}"? This action cannot be undone.`,
      )
    ) {
      setWebhooks(webhooks.filter((w) => w.id !== webhookId));
      alert(`✅ Webhook deleted successfully!`);
    }
  };

  const handleToggleStatus = (webhookId: string) => {
    setWebhooks(
      webhooks.map((w) =>
        w.id === webhookId
          ? { ...w, status: w.status === "active" ? "inactive" : "active" }
          : w,
      ),
    );
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingWebhook(webhookId);
    // Simulate test
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTestingWebhook(null);
    alert(
      `✅ Test payload sent successfully! Check your endpoint logs for the test event.`,
    );
  };

  const handleToggleEvent = (event: string) => {
    if (editingWebhook) {
      const events = editingWebhook.events.includes(event)
        ? editingWebhook.events.filter((e) => e !== event)
        : [...editingWebhook.events, event];
      setEditingWebhook({ ...editingWebhook, events });
    } else {
      const events = (newWebhook.events || []).includes(event)
        ? (newWebhook.events || []).filter((e) => e !== event)
        : [...(newWebhook.events || []), event];
      setNewWebhook({ ...newWebhook, events });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-gray-600 mt-1">
            Configure webhook endpoints for real-time event notifications
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Webhook
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Webhooks</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.total}
              </p>
            </div>
            <Webhook className="w-10 h-10 text-blue-500" />
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
              <p className="text-gray-600 text-sm">Total Deliveries</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalDeliveries}
              </p>
            </div>
            <Activity className="w-10 h-10 text-purple-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Success Rate</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {stats.successRate}%
              </p>
            </div>
            <Zap className="w-10 h-10 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white border-gray-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search webhooks, URLs, events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-gray-300"
            />
          </div>
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

      {/* Webhooks List */}
      <div className="space-y-4">
        {filteredWebhooks.map((webhook) => (
          <Card
            key={webhook.id}
            className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Webhook className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {webhook.name}
                    </h3>
                    {webhook.status === "active" ? (
                      <Badge className="bg-green-100 text-green-700 border-0 flex items-center gap-1">
                        <CheckCircle size={12} />
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-700 border-0 flex items-center gap-1">
                        <XCircle size={12} />
                        Inactive
                      </Badge>
                    )}
                    <Badge className="bg-blue-100 text-blue-700 border-0">
                      {webhook.events.length} events
                    </Badge>
                  </div>

                  <p className="text-sm font-mono text-gray-600 mb-3 bg-gray-50 px-3 py-2 rounded">
                    {webhook.url}
                  </p>

                  <div className="grid grid-cols-4 gap-6 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">Success Rate</p>
                      <p className="font-semibold text-green-600">
                        {webhook.deliveryStats.total > 0
                          ? (
                              (webhook.deliveryStats.successful /
                                webhook.deliveryStats.total) *
                              100
                            ).toFixed(1)
                          : "0"}
                        %
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Deliveries</p>
                      <p className="font-semibold text-gray-900">
                        {webhook.deliveryStats.total} total
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Failed</p>
                      <p className="font-semibold text-red-600">
                        {webhook.deliveryStats.failed}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Last Triggered</p>
                      <p className="font-semibold text-gray-900 flex items-center gap-1">
                        <Clock size={14} />
                        {webhook.lastTriggered
                          ? new Date(webhook.lastTriggered).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">Events:</p>
                    <div className="flex flex-wrap gap-2">
                      {webhook.events.map((event, idx) => (
                        <Badge
                          key={idx}
                          className="bg-purple-100 text-purple-700 border-0 text-xs"
                        >
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedWebhook(webhook)}
                    className="hover:bg-gray-100"
                  >
                    <Eye size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingWebhook({ ...webhook })}
                    className="hover:bg-gray-100"
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTestWebhook(webhook.id)}
                    disabled={testingWebhook === webhook.id}
                    className="hover:bg-blue-50 hover:text-blue-600"
                  >
                    {testingWebhook === webhook.id ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteWebhook(webhook.id)}
                    className="hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Webhook Detail Modal */}
      {selectedWebhook && (
        <Dialog
          open={!!selectedWebhook}
          onOpenChange={() => setSelectedWebhook(null)}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Webhook className="text-blue-500" />
                {selectedWebhook.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex gap-2">
                <Badge
                  className={`${selectedWebhook.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"} border-0`}
                >
                  {selectedWebhook.status}
                </Badge>
                <Badge className="bg-blue-100 text-blue-700 border-0">
                  {selectedWebhook.events.length} events subscribed
                </Badge>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Endpoint URL
                </p>
                <p className="text-sm font-mono bg-gray-50 p-3 rounded">
                  {selectedWebhook.url}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Configuration
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Content Type:</span>{" "}
                      {selectedWebhook.contentType}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Timeout:</span>{" "}
                      {selectedWebhook.timeout}s
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Retry Enabled:</span>{" "}
                      {selectedWebhook.retryEnabled ? "Yes" : "No"}
                    </p>
                    {selectedWebhook.retryEnabled && (
                      <p className="text-sm">
                        <span className="font-medium">Max Retries:</span>{" "}
                        {selectedWebhook.maxRetries}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Delivery Statistics
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Total:</span>{" "}
                      {selectedWebhook.deliveryStats.total}
                    </p>
                    <p className="text-sm text-green-600">
                      <span className="font-medium">Successful:</span>{" "}
                      {selectedWebhook.deliveryStats.successful}
                    </p>
                    <p className="text-sm text-red-600">
                      <span className="font-medium">Failed:</span>{" "}
                      {selectedWebhook.deliveryStats.failed}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Success Rate:</span>{" "}
                      {selectedWebhook.deliveryStats.total > 0
                        ? (
                            (selectedWebhook.deliveryStats.successful /
                              selectedWebhook.deliveryStats.total) *
                            100
                          ).toFixed(1)
                        : "0"}
                      %
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Webhook Secret
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono bg-gray-50 p-3 rounded flex-1">
                    {selectedWebhook.secret}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedWebhook.secret);
                      alert("Secret copied to clipboard!");
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <Shield size={12} />
                  Use this secret to verify webhook signatures
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Subscribed Events
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedWebhook.events.map((event, idx) => (
                    <Badge
                      key={idx}
                      className="bg-purple-100 text-purple-700 border-0"
                    >
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => handleTestWebhook(selectedWebhook.id)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Play size={16} className="mr-2" />
                  Test Webhook
                </Button>
                <Button
                  onClick={() => setEditingWebhook({ ...selectedWebhook })}
                  variant="outline"
                  className="flex-1"
                >
                  <Edit size={16} className="mr-2" />
                  Edit
                </Button>
                <Button
                  onClick={() => handleToggleStatus(selectedWebhook.id)}
                  variant="outline"
                  className="flex-1"
                >
                  {selectedWebhook.status === "active" ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create/Edit Webhook Dialog */}
      {(showCreateDialog || editingWebhook) && (
        <Dialog
          open={showCreateDialog || !!editingWebhook}
          onOpenChange={() => {
            setShowCreateDialog(false);
            setEditingWebhook(null);
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {editingWebhook ? "Edit Webhook" : "Create New Webhook"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Webhook Name *</Label>
                  <Input
                    value={
                      editingWebhook
                        ? editingWebhook.name
                        : newWebhook.name || ""
                    }
                    onChange={(e) =>
                      editingWebhook
                        ? setEditingWebhook({
                            ...editingWebhook,
                            name: e.target.value,
                          })
                        : setNewWebhook({ ...newWebhook, name: e.target.value })
                    }
                    placeholder="Order Notifications"
                    className="bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label>Timeout (seconds)</Label>
                  <Input
                    type="number"
                    value={
                      editingWebhook
                        ? editingWebhook.timeout
                        : newWebhook.timeout || ""
                    }
                    onChange={(e) =>
                      editingWebhook
                        ? setEditingWebhook({
                            ...editingWebhook,
                            timeout: parseInt(e.target.value),
                          })
                        : setNewWebhook({
                            ...newWebhook,
                            timeout: parseInt(e.target.value),
                          })
                    }
                    placeholder="30"
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              <div>
                <Label>Endpoint URL *</Label>
                <Input
                  value={
                    editingWebhook ? editingWebhook.url : newWebhook.url || ""
                  }
                  onChange={(e) =>
                    editingWebhook
                      ? setEditingWebhook({
                          ...editingWebhook,
                          url: e.target.value,
                        })
                      : setNewWebhook({ ...newWebhook, url: e.target.value })
                  }
                  placeholder="https://api.example.com/webhooks/endpoint"
                  className="bg-white border-gray-300 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Content Type</Label>
                  <Select
                    value={
                      editingWebhook
                        ? editingWebhook.contentType
                        : newWebhook.contentType
                    }
                    onValueChange={(value) =>
                      editingWebhook
                        ? setEditingWebhook({
                            ...editingWebhook,
                            contentType: value as WebhookConfig["contentType"],
                          })
                        : setNewWebhook({
                            ...newWebhook,
                            contentType: value as WebhookConfig["contentType"],
                          })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="application/json">
                        application/json
                      </SelectItem>
                      <SelectItem value="application/x-www-form-urlencoded">
                        application/x-www-form-urlencoded
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max Retries</Label>
                  <Input
                    type="number"
                    value={
                      editingWebhook
                        ? editingWebhook.maxRetries
                        : newWebhook.maxRetries || ""
                    }
                    onChange={(e) =>
                      editingWebhook
                        ? setEditingWebhook({
                            ...editingWebhook,
                            maxRetries: parseInt(e.target.value),
                          })
                        : setNewWebhook({
                            ...newWebhook,
                            maxRetries: parseInt(e.target.value),
                          })
                    }
                    placeholder="3"
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      editingWebhook
                        ? editingWebhook.retryEnabled
                        : newWebhook.retryEnabled
                    }
                    onChange={(e) =>
                      editingWebhook
                        ? setEditingWebhook({
                            ...editingWebhook,
                            retryEnabled: e.target.checked,
                          })
                        : setNewWebhook({
                            ...newWebhook,
                            retryEnabled: e.target.checked,
                          })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">
                    Enable automatic retries
                  </span>
                </label>
              </div>

              <div>
                <Label>Subscribed Events * (Select at least one)</Label>
                <div className="mt-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4 space-y-3">
                  {Object.entries(
                    AVAILABLE_EVENTS.reduce(
                      (acc, event) => {
                        if (!acc[event.category]) acc[event.category] = [];
                        acc[event.category].push(event);
                        return acc;
                      },
                      {} as Record<string, WebhookEvent[]>,
                    ),
                  ).map(([category, events]) => (
                    <div key={category}>
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        {category}
                      </p>
                      <div className="space-y-2 ml-4">
                        {events.map((event) => (
                          <label
                            key={event.id}
                            className="flex items-start gap-3 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={(editingWebhook
                                ? editingWebhook.events
                                : newWebhook.events || []
                              ).includes(event.event)}
                              onChange={() => handleToggleEvent(event.event)}
                              className="w-4 h-4 mt-0.5"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {event.event}
                              </p>
                              <p className="text-xs text-gray-500">
                                {event.description}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              {editingWebhook ? (
                <>
                  <Button
                    onClick={handleUpdateWebhook}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <CheckCircle size={16} className="mr-2" />
                    Update Webhook
                  </Button>
                  <Button
                    onClick={() => setEditingWebhook(null)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleCreateWebhook}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Create Webhook
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
