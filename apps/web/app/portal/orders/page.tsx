"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EyeIcon,
  TruckIcon,
  ReceiptPercentIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { Order, OrderFilters, Shipment } from "@/types/order";

const ITEMS_PER_PAGE = 20;

const STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "In_Production", label: "In Production" },
  { value: "QA_Incoming", label: "QA Incoming" },
  { value: "QA_Final", label: "QA Final" },
  { value: "Ready_To_Ship", label: "Ready to Ship" },
  { value: "Shipped", label: "Shipped" },
  { value: "Completed", label: "Completed" },
  { value: "On_Hold", label: "On Hold" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Refunded", label: "Refunded" },
];

const VALUE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "<1000", label: "<$1,000" },
  { value: "1000-10000", label: "$1k–$10k" },
  { value: ">10000", label: ">$10k" },
];

const SOURCE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "web", label: "Web" },
  { value: "widget", label: "Widget" },
  { value: "large_order", label: "Large Order" },
];

export default function OrdersPage() {
  const router = useRouter();

  // Mock orders data
  const mockOrders: Order[] = [
    {
      id: "ORD-2024-001",
      quote_id: "Q-2024-001",
      status: "Shipped",
      eta_date: "2024-02-01",
      updated_at: "2024-01-20",
      totals: { grand_total: 2275.0 },
    },
    {
      id: "ORD-2024-002",
      quote_id: "Q-2024-003",
      status: "In_Production",
      eta_date: "2024-02-10",
      updated_at: "2024-01-19",
      totals: { grand_total: 3275.0 },
    },
    {
      id: "ORD-2024-003",
      quote_id: "Q-2024-004",
      status: "QA_Final",
      eta_date: "2024-02-05",
      updated_at: "2024-01-18",
      totals: { grand_total: 8550.0 },
    },
    {
      id: "ORD-2024-004",
      quote_id: "Q-2024-002",
      status: "Completed",
      eta_date: "2024-01-15",
      updated_at: "2024-01-15",
      totals: { grand_total: 1850.0 },
    },
    {
      id: "ORD-2024-005",
      quote_id: "Q-2024-005",
      status: "Ready_To_Ship",
      eta_date: "2024-01-25",
      updated_at: "2024-01-22",
      totals: { grand_total: 3750.0 },
    },
  ];

  const mockShipments: Shipment[] = [
    {
      id: "ship-1",
      carrier: "UPS",
      service: "Ground",
      status: "In_Transit",
      tracking_numbers: ["1Z9999999999999999"],
      ship_date: "2024-01-20",
      delivery_date: "2024-02-01",
      packages: [
        {
          id: "pkg-1",
          tracking_number: "1Z9999999999999999",
          length: 12,
          width: 10,
          height: 8,
          weight: 5,
        },
      ],
      events: [
        {
          ts: "2024-01-22T10:00:00Z",
          status: "In Transit",
          location: "Philadelphia, PA",
          description: "Package is in transit",
        },
        {
          ts: "2024-01-21T14:30:00Z",
          status: "Departed Facility",
          location: "Newark, NJ",
          description: "Package departed facility",
        },
        {
          ts: "2024-01-20T09:00:00Z",
          status: "Origin Scan",
          location: "New York, NY",
          description: "Package picked up",
        },
      ],
    },
  ];

  const [orders, _setOrders] = useState<Order[]>(mockOrders);
  const [isLoading, setIsLoading] = useState(false);
  const [total, _setTotal] = useState(mockOrders.length);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filters, setFilters] = useState<OrderFilters>({});
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [trackingShipments, setTrackingShipments] = useState<Shipment[]>([]);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load orders when filters change
  const loadOrders = useCallback(async () => {
    // Mock implementation - no actual API call
    setIsLoading(false);
  }, [page, debouncedSearchQuery, filters]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Handle filter changes
  const handleFilterChange = (key: keyof OrderFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page
  };

  // Handle search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  // Handle row actions
  const handleViewOrder = (orderId: string) => {
    router.push(`/portal/orders/${orderId}`);
  };

  const handleTrackOrder = async (orderId: string) => {
    setTrackingOrderId(orderId);
    setIsTrackingLoading(true);
    // Mock implementation - use mock shipments
    setTimeout(() => {
      setTrackingShipments(mockShipments);
      setIsTrackingLoading(false);
    }, 500);
  };

  const handleDownloadInvoice = async (orderId: string) => {
    // Mock implementation - no actual download
    toast.success(`Invoice download started for ${orderId}`);
  };

  const handleExportCSV = async () => {
    // Mock implementation - no actual export
    toast.success("CSV export started");
  };

  const handleOpenCarrierTracking = (
    carrier: string,
    trackingNumber: string,
  ) => {
    // This would open the carrier's tracking page
    const urls: Record<string, string> = {
      UPS: `https://www.ups.com/track?tracknum=${trackingNumber}`,
      FedEx: `https://www.fedex.com/en-us/tracking.html?tracknumbers=${trackingNumber}`,
      DHL: `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`,
      USPS: `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`,
    };
    const url =
      urls[carrier] ||
      `https://www.google.com/search?q=${carrier}+tracking+${trackingNumber}`;
    window.open(url, "_blank");
  };

  // Format currency
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      Pending: "secondary",
      In_Production: "default",
      QA_Incoming: "default",
      QA_Final: "default",
      Ready_To_Ship: "default",
      Shipped: "default",
      Completed: "default",
      On_Hold: "destructive",
      Cancelled: "destructive",
      Refunded: "outline",
    };
    return variants[status] || "default";
  };

  // Pagination
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Orders</h1>
        <Button onClick={handleExportCSV} variant="outline">
          <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search orders, quotes, tracking…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="max-w-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              value={filters.status?.[0] || ""}
              onValueChange={(value) =>
                handleFilterChange("status", value ? [value] : undefined)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DatePickerWithRange
              date={{
                from: filters.date_range?.from
                  ? new Date(filters.date_range.from)
                  : undefined,
                to: filters.date_range?.to
                  ? new Date(filters.date_range.to)
                  : undefined,
              }}
              onDateChange={(range) =>
                handleFilterChange("date_range", {
                  from: range.from?.toISOString().split("T")[0],
                  to: range.to?.toISOString().split("T")[0],
                })
              }
              className="w-full"
            />

            <Select
              value={filters.value || ""}
              onValueChange={(value) =>
                handleFilterChange("value", value || undefined)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Values" />
              </SelectTrigger>
              <SelectContent>
                {VALUE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.source || ""}
              onValueChange={(value) =>
                handleFilterChange("source", value || undefined)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Quote</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading orders...
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center space-y-2">
                    <p className="text-gray-500">No orders yet</p>
                    <p className="text-sm text-gray-400">
                      Place your first order from a quote.
                    </p>
                    <Button
                      onClick={() => router.push("/portal/quotes")}
                      variant="outline"
                    >
                      Go to Quotes
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">
                    {order.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {order.quote_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(order.status)}>
                      {order.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.eta_date ? formatDate(order.eta_date) : "TBD"}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(order.totals.grand_total)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(order.updated_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewOrder(order.id)}
                        title="View Order"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTrackOrder(order.id)}
                        title="Track Order"
                      >
                        <TruckIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadInvoice(order.id)}
                        title="Download Invoice"
                      >
                        <ReceiptPercentIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-500">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(page * ITEMS_PER_PAGE, total)} of {total} orders
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={!hasPrevPage}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!hasNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Tracking Drawer */}
      <Dialog
        open={!!trackingOrderId}
        onOpenChange={() => setTrackingOrderId(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tracking Information</DialogTitle>
          </DialogHeader>

          {isTrackingLoading ? (
            <div className="py-8 text-center">
              Loading tracking information...
            </div>
          ) : trackingShipments.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              No shipments found for this order.
            </div>
          ) : (
            <div className="space-y-6">
              {trackingShipments.map((shipment) => (
                <Card key={shipment.id} className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">
                      {shipment.carrier} {shipment.service}
                    </h3>
                    <Badge
                      variant={
                        shipment.status === "Delivered"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {shipment.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Tracking Numbers</p>
                      <p className="font-mono text-sm">
                        {shipment.tracking_numbers.join(", ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Ship Date</p>
                      <p>
                        {shipment.ship_date
                          ? formatDate(shipment.ship_date)
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Delivery Date</p>
                      <p>
                        {shipment.delivery_date
                          ? formatDate(shipment.delivery_date)
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Packages</p>
                      <p>{shipment.packages.length}</p>
                    </div>
                  </div>

                  {shipment.events.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">
                        Tracking Events
                      </p>
                      <div className="space-y-2">
                        {shipment.events.slice(0, 5).map((event, index) => (
                          <div
                            key={index}
                            className="flex items-start space-x-3"
                          >
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {event.status}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDate(event.ts)} • {event.location}
                              </p>
                              <p className="text-xs text-gray-600">
                                {event.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleOpenCarrierTracking(
                          shipment.carrier,
                          shipment.tracking_numbers[0],
                        )
                      }
                    >
                      Open Carrier Tracking
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
