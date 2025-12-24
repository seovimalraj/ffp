"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  X,
  Search,
  TrendingUp,
  AlertCircle,
  Award,
  Package,
  Loader2,
} from "lucide-react";
import {
  getOrdersWithBids,
  updateBidStatus,
  updateOrderStatus,
} from "../../../lib/database";

export default function AdminBidsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    loadOrdersWithBids();
  }, []);

  const loadOrdersWithBids = async () => {
    try {
      setLoading(true);
      const data = await getOrdersWithBids();
      setOrders(data);
    } catch (error) {
      console.error("Error loading orders with bids:", error);
      alert("Failed to load bids. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBid = async (
    orderId: string,
    bidId: string,
    supplierName: string,
  ) => {
    if (
      !confirm(
        `Approve bid from ${supplierName}? The supplier will be notified and production can begin.`,
      )
    ) {
      return;
    }

    try {
      // Update bid status to approved
      await updateBidStatus(bidId, "approved");

      // Reject other bids for this order
      const order = orders.find((o) => o.id === orderId);
      if (order?.bids) {
        for (const bid of order.bids) {
          if (bid.id !== bidId && bid.status === "pending") {
            await updateBidStatus(bid.id, "rejected");
          }
        }
      }

      // Update order status
      await updateOrderStatus(orderId, "in-production");

      alert(
        `✅ Bid approved! ${supplierName} has been notified and can begin production.`,
      );

      // Reload data
      await loadOrdersWithBids();
    } catch (error) {
      console.error("Error approving bid:", error);
      alert("Failed to approve bid. Please try again.");
    }
  };

  const handleRejectBid = async (bidId: string, supplierName: string) => {
    if (!confirm(`Reject bid from ${supplierName}?`)) {
      return;
    }

    try {
      await updateBidStatus(bidId, "rejected");
      await loadOrdersWithBids();
    } catch (error) {
      console.error("Error rejecting bid:", error);
      alert("Failed to reject bid. Please try again.");
    }
  };

  const getBestBid = (bids: any[]) => {
    if (bids.length === 0) return null;

    // Calculate score: lower price and faster delivery = better
    const scoredBids = bids.map((bid: any) => ({
      ...bid,
      score:
        bid.price / Math.max(...bids.map((b: any) => b.price)) +
        bid.lead_time / Math.max(...bids.map((b: any) => b.lead_time)),
    }));

    return scoredBids.sort((a: any, b: any) => a.score - b.score)[0];
  };

  const filteredOrders = orders.filter(
    (order: any) =>
      order.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer?.company_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      order.bids?.some((bid: any) =>
        bid.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  );

  const totalBids = orders.reduce(
    (sum: number, order: any) => sum + (order.bids?.length || 0),
    0,
  );
  const pendingBids = orders.reduce(
    (sum: number, order: any) =>
      sum +
      (order.bids?.filter((b: any) => b.status === "pending").length || 0),
    0,
  );
  const approvedBids = orders.reduce(
    (sum: number, order: any) =>
      sum +
      (order.bids?.filter((b: any) => b.status === "approved").length || 0),
    0,
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading bids...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bid Management
          </h1>
          <p className="text-gray-600">
            Review and approve supplier bids for customer orders
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Bids</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {totalBids}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Pending Review</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {pendingBids}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Approved</p>
                  <p className="text-3xl font-bold text-green-600">
                    {approvedBids}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Orders</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {orders.length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by order ID, customer, or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Orders with Bids */}
        <div className="space-y-6">
          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No orders with bids found</p>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order: any) => {
              const bestBid = getBestBid(order.bids || []);
              const isExpanded = expandedOrder === order.id;

              return (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-xl">{order.id}</CardTitle>
                          <Badge className="bg-blue-100 text-blue-700 border-0">
                            {order.bids?.length || 0}{" "}
                            {order.bids?.length === 1 ? "Bid" : "Bids"}
                          </Badge>
                          {order.selected_bid && (
                            <Badge className="bg-green-100 text-green-700 border-0">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approved
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Customer:</span>
                            <p className="font-semibold text-gray-900">
                              {order.customer?.company_name || "N/A"}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Parts:</span>
                            <p className="font-semibold text-gray-900">
                              {order.parts?.length || 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Order Value:</span>
                            <p className="font-semibold text-gray-900">
                              ${order.total_price?.toLocaleString() || "N/A"}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">
                              Required Lead Time:
                            </span>
                            <p className="font-semibold text-gray-900">
                              {order.lead_time || "N/A"} days
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setExpandedOrder(isExpanded ? null : order.id)
                        }
                      >
                        {isExpanded ? "Hide Bids" : "View Bids"}
                      </Button>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {order.bids?.map((bid: any) => {
                          const isBest = bestBid?.id === bid.id;
                          const isApproved = bid.status === "approved";
                          const isRejected = bid.status === "rejected";

                          return (
                            <div
                              key={bid.id}
                              className={`border-2 rounded-lg p-4 transition-all ${
                                isBest && !isApproved && !isRejected
                                  ? "border-green-300 bg-green-50"
                                  : isApproved
                                    ? "border-blue-300 bg-blue-50"
                                    : isRejected
                                      ? "border-gray-300 bg-gray-50 opacity-60"
                                      : "border-gray-200"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                      {bid.supplier_name}
                                    </h3>
                                    {isBest && !isApproved && !isRejected && (
                                      <Badge className="bg-green-100 text-green-700 border-0">
                                        <Award className="w-3 h-3 mr-1" />
                                        Best Value
                                      </Badge>
                                    )}
                                    {isApproved && (
                                      <Badge className="bg-blue-100 text-blue-700 border-0">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Approved
                                      </Badge>
                                    )}
                                    {isRejected && (
                                      <Badge className="bg-gray-100 text-gray-700 border-0">
                                        <X className="w-3 h-3 mr-1" />
                                        Rejected
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    Submitted{" "}
                                    {new Date(bid.submittedAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <DollarSign className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      Bid Price
                                    </p>
                                    <p className="text-xl font-bold text-gray-900">
                                      ${bid.price?.toLocaleString() || "N/A"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {order.total_price
                                        ? (
                                            (bid.price / order.total_price) *
                                            100
                                          ).toFixed(1)
                                        : "0"}
                                      % of order value
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      Lead Time
                                    </p>
                                    <p className="text-xl font-bold text-gray-900">
                                      {bid.lead_time || "N/A"} days
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {bid.lead_time <= order.lead_time
                                        ? "Meets requirement"
                                        : "Exceeds requirement"}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      Value Score
                                    </p>
                                    <p className="text-xl font-bold text-gray-900">
                                      {isBest ? "Best" : "Good"}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {bid.notes && (
                                <div className="bg-white rounded-lg p-3 mb-4 border">
                                  <p className="text-sm font-semibold text-gray-900 mb-1">
                                    Additional Notes:
                                  </p>
                                  <p className="text-sm text-gray-700">
                                    {bid.notes}
                                  </p>
                                </div>
                              )}

                              {!isApproved && !isRejected && (
                                <div className="flex gap-3">
                                  <Button
                                    onClick={() =>
                                      handleApproveBid(
                                        order.id,
                                        bid.id,
                                        bid.supplier_name,
                                      )
                                    }
                                    className="bg-green-600 hover:bg-green-700 flex-1"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Approve & Notify Supplier
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      handleRejectBid(bid.id, bid.supplier_name)
                                    }
                                    className="border-red-300 text-red-700 hover:bg-red-50"
                                  >
                                    <X className="w-4 h-4 mr-2" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {bestBid &&
                        order.bids?.filter((b: any) => b.status === "pending")
                          .length > 0 && (
                          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-green-900">
                                Recommendation
                              </p>
                              <p className="text-sm text-green-800">
                                {bestBid?.supplier_name} offers the best
                                combination of price and lead time. Consider
                                approving this bid to ensure optimal customer
                                satisfaction.
                              </p>
                            </div>
                          </div>
                        )}
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
