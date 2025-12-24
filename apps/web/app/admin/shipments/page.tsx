"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Package,
  Truck,
  Clock,
  CheckCircle,
  Search,
  MapPin,
  Calendar,
  Eye,
  Edit,
  Plus,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface Shipment {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: "FedEx" | "UPS" | "USPS" | "DHL" | "Local";
  status:
    | "pending"
    | "picked_up"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "failed";
  customerName: string;
  destination: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  weight: number;
  dimensions: string;
  shipDate: string;
  lastUpdate: string;
  notes?: string;
}

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([
    {
      id: "SHP-001",
      orderId: "ORD-2024-001",
      trackingNumber: "1Z999AA10123456784",
      carrier: "UPS",
      status: "in_transit",
      customerName: "John Smith - TechCorp",
      destination: "San Francisco, CA 94105",
      estimatedDelivery: new Date(
        Date.now() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      weight: 15.5,
      dimensions: '24" x 18" x 12"',
      shipDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      notes: "5 aluminum parts, handle with care",
    },
    {
      id: "SHP-002",
      orderId: "ORD-2024-002",
      trackingNumber: "420945869280002122162",
      carrier: "USPS",
      status: "delivered",
      customerName: "Sarah Johnson - Aerospace Dynamics",
      destination: "Seattle, WA 98101",
      estimatedDelivery: new Date(
        Date.now() - 1 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      actualDelivery: new Date(
        Date.now() - 1 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      weight: 32.0,
      dimensions: '36" x 24" x 18"',
      shipDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      notes: "Titanium aerospace parts",
    },
    {
      id: "SHP-003",
      orderId: "ORD-2024-003",
      trackingNumber: "FDX123456789012",
      carrier: "FedEx",
      status: "out_for_delivery",
      customerName: "Michael Chen - Medical Devices Inc",
      destination: "Boston, MA 02101",
      estimatedDelivery: new Date().toISOString(),
      weight: 8.3,
      dimensions: '18" x 12" x 8"',
      shipDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdate: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      notes: "Medical grade components, fragile",
    },
    {
      id: "SHP-004",
      orderId: "ORD-2024-004",
      trackingNumber: "DHL5678901234",
      carrier: "DHL",
      status: "pending",
      customerName: "Emily Davis - Robotics Ltd",
      destination: "Austin, TX 78701",
      estimatedDelivery: new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      weight: 45.2,
      dimensions: '48" x 30" x 24"',
      shipDate: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      notes: "Large assembly, requires lift gate",
    },
    {
      id: "SHP-005",
      orderId: "ORD-2024-005",
      trackingNumber: "UPS789012345678",
      carrier: "UPS",
      status: "picked_up",
      customerName: "David Wilson - Manufacturing Co",
      destination: "Chicago, IL 60601",
      estimatedDelivery: new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      weight: 21.7,
      dimensions: '30" x 20" x 16"',
      shipDate: new Date().toISOString(),
      lastUpdate: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(
    null,
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newShipment, setNewShipment] = useState<Partial<Shipment>>({
    carrier: "UPS",
    status: "pending",
  });

  const filteredShipments = shipments.filter((shipment) => {
    const matchesSearch =
      shipment.trackingNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      shipment.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.destination.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || shipment.status === statusFilter;
    const matchesCarrier =
      carrierFilter === "all" || shipment.carrier === carrierFilter;

    return matchesSearch && matchesStatus && matchesCarrier;
  });

  const getStatusBadge = (status: Shipment["status"]) => {
    const variants = {
      pending: {
        bg: "bg-gray-500/10",
        text: "text-gray-600",
        border: "border-gray-500/20",
        icon: Clock,
      },
      picked_up: {
        bg: "bg-blue-500/10",
        text: "text-blue-600",
        border: "border-blue-500/20",
        icon: Package,
      },
      in_transit: {
        bg: "bg-yellow-500/10",
        text: "text-yellow-600",
        border: "border-yellow-500/20",
        icon: Truck,
      },
      out_for_delivery: {
        bg: "bg-purple-500/10",
        text: "text-purple-600",
        border: "border-purple-500/20",
        icon: MapPin,
      },
      delivered: {
        bg: "bg-green-500/10",
        text: "text-green-600",
        border: "border-green-500/20",
        icon: CheckCircle,
      },
      failed: {
        bg: "bg-red-500/10",
        text: "text-red-600",
        border: "border-red-500/20",
        icon: AlertCircle,
      },
    };
    const variant = variants[status];
    const Icon = variant.icon;
    return (
      <Badge
        className={`${variant.bg} ${variant.text} ${variant.border} border px-2 py-1 flex items-center gap-1 w-fit`}
      >
        <Icon size={12} />
        {status
          .replace("_", " ")
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")}
      </Badge>
    );
  };

  const stats = {
    total: shipments.length,
    pending: shipments.filter((s) => s.status === "pending").length,
    in_transit: shipments.filter(
      (s) => s.status === "in_transit" || s.status === "picked_up",
    ).length,
    out_for_delivery: shipments.filter((s) => s.status === "out_for_delivery")
      .length,
    delivered: shipments.filter((s) => s.status === "delivered").length,
  };

  const handleCreateShipment = () => {
    if (
      !newShipment.orderId ||
      !newShipment.trackingNumber ||
      !newShipment.customerName ||
      !newShipment.destination
    ) {
      alert("Please fill in all required fields");
      return;
    }

    const shipment: Shipment = {
      id: `SHP-${String(shipments.length + 1).padStart(3, "0")}`,
      orderId: newShipment.orderId!,
      trackingNumber: newShipment.trackingNumber!,
      carrier: (newShipment.carrier as Shipment["carrier"]) || "UPS",
      status: "pending",
      customerName: newShipment.customerName!,
      destination: newShipment.destination!,
      estimatedDelivery:
        newShipment.estimatedDelivery ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      weight: newShipment.weight || 0,
      dimensions: newShipment.dimensions || "",
      shipDate: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      notes: newShipment.notes,
    };

    setShipments([...shipments, shipment]);
    setShowCreateDialog(false);
    setNewShipment({ carrier: "UPS", status: "pending" });
    alert(`✅ Shipment ${shipment.id} created successfully!`);
  };

  const handleUpdateStatus = (
    shipmentId: string,
    newStatus: Shipment["status"],
  ) => {
    setShipments(
      shipments.map((s) =>
        s.id === shipmentId
          ? {
              ...s,
              status: newStatus,
              lastUpdate: new Date().toISOString(),
              actualDelivery:
                newStatus === "delivered"
                  ? new Date().toISOString()
                  : s.actualDelivery,
            }
          : s,
      ),
    );
    alert(`✅ Shipment status updated to: ${newStatus.replace("_", " ")}`);
  };

  const handleTrackShipment = (shipment: Shipment) => {
    const urls = {
      UPS: `https://www.ups.com/track?tracknum=${shipment.trackingNumber}`,
      FedEx: `https://www.fedex.com/fedextrack/?tracknumbers=${shipment.trackingNumber}`,
      USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${shipment.trackingNumber}`,
      DHL: `https://www.dhl.com/en/express/tracking.html?AWB=${shipment.trackingNumber}`,
      Local: "#",
    };
    alert(`Opening ${shipment.carrier} tracking: ${urls[shipment.carrier]}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-600 mt-1">Track and manage order shipments</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Shipment
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total</p>
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
              <p className="text-gray-600 text-sm">Pending</p>
              <p className="text-3xl font-bold text-gray-600 mt-1">
                {stats.pending}
              </p>
            </div>
            <Clock className="w-10 h-10 text-gray-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">In Transit</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {stats.in_transit}
              </p>
            </div>
            <Truck className="w-10 h-10 text-yellow-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Out for Delivery</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                {stats.out_for_delivery}
              </p>
            </div>
            <MapPin className="w-10 h-10 text-purple-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Delivered</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {stats.delivered}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white border-gray-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by tracking #, order ID, customer..."
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
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="picked_up">Picked Up</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={carrierFilter} onValueChange={setCarrierFilter}>
            <SelectTrigger className="w-full md:w-48 bg-white border-gray-300">
              <SelectValue placeholder="Filter by carrier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Carriers</SelectItem>
              <SelectItem value="UPS">UPS</SelectItem>
              <SelectItem value="FedEx">FedEx</SelectItem>
              <SelectItem value="USPS">USPS</SelectItem>
              <SelectItem value="DHL">DHL</SelectItem>
              <SelectItem value="Local">Local</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Shipments Table */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="font-semibold">Shipment ID</TableHead>
              <TableHead className="font-semibold">Order ID</TableHead>
              <TableHead className="font-semibold">Tracking #</TableHead>
              <TableHead className="font-semibold">Carrier</TableHead>
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="font-semibold">Destination</TableHead>
              <TableHead className="font-semibold">ETA</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShipments.map((shipment) => (
              <TableRow key={shipment.id} className="hover:bg-gray-50">
                <TableCell className="font-medium text-blue-600">
                  {shipment.id}
                </TableCell>
                <TableCell className="text-gray-600">
                  {shipment.orderId}
                </TableCell>
                <TableCell className="font-mono text-sm text-gray-600">
                  {shipment.trackingNumber}
                </TableCell>
                <TableCell>
                  <Badge className="bg-gray-100 text-gray-700 border-0">
                    {shipment.carrier}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-900">
                  {shipment.customerName}
                </TableCell>
                <TableCell className="text-gray-600 flex items-center gap-1">
                  <MapPin size={14} className="text-gray-400" />
                  {shipment.destination}
                </TableCell>
                <TableCell className="text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} className="text-gray-400" />
                    {new Date(shipment.estimatedDelivery).toLocaleDateString()}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(shipment.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedShipment(shipment)}
                      className="hover:bg-gray-100"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTrackShipment(shipment)}
                      className="hover:bg-gray-100"
                    >
                      <ExternalLink size={16} />
                    </Button>
                    {shipment.status !== "delivered" && (
                      <Select
                        value={shipment.status}
                        onValueChange={(value) =>
                          handleUpdateStatus(
                            shipment.id,
                            value as Shipment["status"],
                          )
                        }
                      >
                        <SelectTrigger className="w-8 h-8 p-0 border-0 hover:bg-gray-100">
                          <Edit size={16} className="mx-auto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="picked_up">Picked Up</SelectItem>
                          <SelectItem value="in_transit">In Transit</SelectItem>
                          <SelectItem value="out_for_delivery">
                            Out for Delivery
                          </SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Shipment Detail Modal */}
      {selectedShipment && (
        <Dialog
          open={!!selectedShipment}
          onOpenChange={() => setSelectedShipment(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Shipment Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Shipment Info
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">ID:</span>{" "}
                      {selectedShipment.id}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Order:</span>{" "}
                      {selectedShipment.orderId}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Tracking:</span>{" "}
                      {selectedShipment.trackingNumber}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Carrier:</span>{" "}
                      {selectedShipment.carrier}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Package Info
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Weight:</span>{" "}
                      {selectedShipment.weight} lbs
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Dimensions:</span>{" "}
                      {selectedShipment.dimensions}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Ship Date:</span>{" "}
                      {new Date(selectedShipment.shipDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Delivery Info
                </p>
                <p className="text-sm mb-1">
                  <span className="font-medium">Customer:</span>{" "}
                  {selectedShipment.customerName}
                </p>
                <p className="text-sm mb-1">
                  <span className="font-medium">Destination:</span>{" "}
                  {selectedShipment.destination}
                </p>
                <p className="text-sm mb-1">
                  <span className="font-medium">Estimated Delivery:</span>{" "}
                  {new Date(
                    selectedShipment.estimatedDelivery,
                  ).toLocaleString()}
                </p>
                {selectedShipment.actualDelivery && (
                  <p className="text-sm text-green-600 font-medium">
                    Delivered:{" "}
                    {new Date(selectedShipment.actualDelivery).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Status
                </p>
                <div className="flex items-center gap-3">
                  {getStatusBadge(selectedShipment.status)}
                  <p className="text-xs text-gray-500">
                    Last updated:{" "}
                    {new Date(selectedShipment.lastUpdate).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedShipment.notes && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Notes
                  </p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                    {selectedShipment.notes}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => handleTrackShipment(selectedShipment)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <ExternalLink size={16} className="mr-2" />
                  Track on {selectedShipment.carrier}
                </Button>
                <Button
                  onClick={() => setSelectedShipment(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Shipment Dialog */}
      {showCreateDialog && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                Create New Shipment
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Order ID *</Label>
                  <Input
                    value={newShipment.orderId || ""}
                    onChange={(e) =>
                      setNewShipment({
                        ...newShipment,
                        orderId: e.target.value,
                      })
                    }
                    placeholder="ORD-2024-XXX"
                    className="bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label>Tracking Number *</Label>
                  <Input
                    value={newShipment.trackingNumber || ""}
                    onChange={(e) =>
                      setNewShipment({
                        ...newShipment,
                        trackingNumber: e.target.value,
                      })
                    }
                    placeholder="Enter tracking number"
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Carrier *</Label>
                  <Select
                    value={newShipment.carrier}
                    onValueChange={(value) =>
                      setNewShipment({
                        ...newShipment,
                        carrier: value as Shipment["carrier"],
                      })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPS">UPS</SelectItem>
                      <SelectItem value="FedEx">FedEx</SelectItem>
                      <SelectItem value="USPS">USPS</SelectItem>
                      <SelectItem value="DHL">DHL</SelectItem>
                      <SelectItem value="Local">Local Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estimated Delivery</Label>
                  <Input
                    type="date"
                    value={newShipment.estimatedDelivery?.split("T")[0] || ""}
                    onChange={(e) =>
                      setNewShipment({
                        ...newShipment,
                        estimatedDelivery: new Date(
                          e.target.value,
                        ).toISOString(),
                      })
                    }
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              <div>
                <Label>Customer Name *</Label>
                <Input
                  value={newShipment.customerName || ""}
                  onChange={(e) =>
                    setNewShipment({
                      ...newShipment,
                      customerName: e.target.value,
                    })
                  }
                  placeholder="Customer name and company"
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Destination Address *</Label>
                <Input
                  value={newShipment.destination || ""}
                  onChange={(e) =>
                    setNewShipment({
                      ...newShipment,
                      destination: e.target.value,
                    })
                  }
                  placeholder="City, State ZIP"
                  className="bg-white border-gray-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Weight (lbs)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newShipment.weight || ""}
                    onChange={(e) =>
                      setNewShipment({
                        ...newShipment,
                        weight: parseFloat(e.target.value),
                      })
                    }
                    placeholder="0.0"
                    className="bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label>Dimensions</Label>
                  <Input
                    value={newShipment.dimensions || ""}
                    onChange={(e) =>
                      setNewShipment({
                        ...newShipment,
                        dimensions: e.target.value,
                      })
                    }
                    placeholder='L" x W" x H"'
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  value={newShipment.notes || ""}
                  onChange={(e) =>
                    setNewShipment({ ...newShipment, notes: e.target.value })
                  }
                  placeholder="Special handling instructions..."
                  className="bg-white border-gray-300"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleCreateShipment}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus size={16} className="mr-2" />
                Create Shipment
              </Button>
              <Button
                onClick={() => setShowCreateDialog(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
