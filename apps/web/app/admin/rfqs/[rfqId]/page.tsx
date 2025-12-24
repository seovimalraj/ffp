"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Award,
  Package,
  Loader2,
  Star,
  AlertTriangle,
  FileText,
  Send,
  MessageSquare,
} from "lucide-react";
import {
  getRFQ,
  getOrder,
  getBidsForRFQ,
  updateBidStatus,
} from "../../../../lib/database";

interface Bid {
  id: string;
  rfq_id: string;
  supplier_id: string;
  supplier_name: string;
  price: number;
  lead_time: number;
  notes?: string;
  quality_score: number;
  on_time_rate: number;
  status: string;
  created_at: string;
}

export default function AdminRFQDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rfqId = params?.rfqId as string;

  const [rfqData, setRfqData] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBid, setSelectedBid] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!rfqId) return;

      try {
        setLoading(true);
        const rfq = await getRFQ(rfqId);
        const order = await getOrder(rfq.order_id);
        const bidsData = await getBidsForRFQ(rfqId);

        setRfqData(rfq);
        setOrderData(order);
        setBids(bidsData);

        const acceptedBid = bidsData.find((b) => b.status === "accepted");
        if (acceptedBid) {
          setSelectedBid(acceptedBid.id);
        }
      } catch (error) {
        console.error("Error loading RFQ details:", error);
        alert("Failed to load RFQ details.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [rfqId]);

  const handleAcceptBid = async (bidId: string) => {
    if (
      !confirm(
        "Are you sure you want to accept this bid? This will reject all other bids.",
      )
    ) {
      return;
    }

    try {
      setIsProcessing(true);

      // Accept the selected bid
      await updateBidStatus(bidId, "accepted");

      // Reject all other bids
      const otherBids = bids.filter((b) => b.id !== bidId);
      await Promise.all(
        otherBids.map((b) => updateBidStatus(b.id, "rejected")),
      );

      // Reload data
      const updatedBids = await getBidsForRFQ(rfqId);
      setBids(updatedBids);
      setSelectedBid(bidId);

      alert("Bid accepted successfully! Supplier will be notified.");
    } catch (error) {
      console.error("Error accepting bid:", error);
      alert("Failed to accept bid. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectBid = async (bidId: string) => {
    if (!confirm("Are you sure you want to reject this bid?")) {
      return;
    }

    try {
      setIsProcessing(true);
      await updateBidStatus(bidId, "rejected");

      const updatedBids = await getBidsForRFQ(rfqId);
      setBids(updatedBids);

      alert("Bid rejected successfully.");
    } catch (error) {
      console.error("Error rejecting bid:", error);
      alert("Failed to reject bid. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "accepted") {
      return (
        <Badge className="bg-green-100 text-green-700 border-0">
          <CheckCircle className="w-3 h-3 mr-1" />
          Accepted
        </Badge>
      );
    } else if (status === "rejected") {
      return (
        <Badge className="bg-red-100 text-red-700 border-0">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 border-0">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }
  };

  const sortedBids = [...bids].sort((a, b) => {
    // Accepted bids first
    if (a.status === "accepted") return -1;
    if (b.status === "accepted") return 1;

    // Then by price (lowest first)
    return a.price - b.price;
  });

  const lowestBid = Math.min(...bids.map((b) => b.price));
  const avgBid = bids.reduce((sum, b) => sum + b.price, 0) / bids.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading RFQ details...</p>
        </div>
      </div>
    );
  }

  if (!rfqData) return <div>RFQ not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push("/admin/rfqs")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to RFQs
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{rfqData.id}</h1>
          <p className="text-gray-600">Review and compare supplier bids</p>
        </div>
      </div>

      {/* Alert if no bids */}
      {bids.length === 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              <div>
                <h3 className="font-semibold text-orange-900">
                  No Bids Received Yet
                </h3>
                <p className="text-sm text-orange-700">
                  This RFQ hasn't received any bids from suppliers. Check back
                  later or reach out to suppliers directly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* RFQ Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                RFQ Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Order ID</p>
                  <Button
                    variant="link"
                    className="p-0 h-auto font-semibold"
                    onClick={() =>
                      router.push(`/admin/orders/${rfqData.order_id}`)
                    }
                  >
                    {rfqData.order_id}
                  </Button>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Parts</p>
                  <p className="text-lg font-semibold">
                    {orderData?.parts?.length || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Lead Time</p>
                  <p className="text-lg font-semibold">{rfqData.lead_time}d</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  {getStatusBadge(rfqData.status)}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Materials Required</p>
                <div className="flex flex-wrap gap-2">
                  {rfqData.materials.map((material: string, idx: number) => (
                    <Badge key={idx} variant="outline">
                      {material}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Customer</p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium">
                    {orderData?.customer_name || "Anonymous"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {orderData?.customer_email}
                  </p>
                  {orderData?.customer_company && (
                    <p className="text-sm text-gray-600">
                      {orderData.customer_company}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bids Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Supplier Bids ({bids.length})
                </span>
                {bids.length > 0 && (
                  <div className="text-sm font-normal text-gray-600">
                    Lowest: ${lowestBid.toLocaleString()} • Avg: $
                    {avgBid.toLocaleString()}
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Lead Time</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>On-Time Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBids.map((bid) => (
                      <TableRow
                        key={bid.id}
                        className={bid.id === selectedBid ? "bg-green-50" : ""}
                      >
                        <TableCell>
                          <div>
                            <p className="font-semibold">{bid.supplier_name}</p>
                            <p className="text-xs text-gray-500">
                              {bid.supplier_id}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg">
                              ${bid.price.toLocaleString()}
                            </span>
                            {bid.price === lowestBid && (
                              <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                                Lowest
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>{bid.lead_time}d</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span className="font-medium">
                              {bid.quality_score}
                            </span>
                            <span className="text-xs text-gray-500">/5.0</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Award className="w-4 h-4 text-blue-400" />
                            <span className="font-medium">
                              {(bid.on_time_rate * 100).toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(bid.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {bid.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleAcceptBid(bid.id)}
                                  disabled={isProcessing}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectBid(bid.id)}
                                  disabled={isProcessing}
                                  className="text-red-600 border-red-600 hover:bg-red-50"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {bid.status === "accepted" && (
                              <Badge className="bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Winner
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Bid Notes */}
              {sortedBids.some((b) => b.notes) && (
                <div className="mt-6 space-y-3">
                  <h4 className="font-semibold text-sm text-gray-700">
                    Supplier Notes
                  </h4>
                  {sortedBids
                    .filter((b) => b.notes)
                    .map((bid) => (
                      <div
                        key={bid.id}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {bid.supplier_name}
                          </span>
                          {bid.id === selectedBid && (
                            <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                              Selected
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{bid.notes}</p>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Bid Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bid Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Bids</p>
                <p className="text-2xl font-bold text-gray-900">
                  {bids.length}
                </p>
              </div>
              {bids.length > 0 && (
                <>
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-1">Price Range</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-green-600">
                        ${lowestBid.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">
                        to $
                        {Math.max(...bids.map((b) => b.price)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-1">Average Bid</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${avgBid.toLocaleString()}
                    </p>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-1">Best Lead Time</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Math.min(...bids.map((b) => b.lead_time))}d
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Admin Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Admin Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add internal notes about this RFQ..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={4}
                className="mb-3"
              />
              <Button className="w-full" size="sm">
                <Send className="w-4 h-4 mr-2" />
                Save Notes
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push(`/admin/orders/${rfqData.order_id}`)}
              >
                <Package className="w-4 h-4 mr-2" />
                View Full Order
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="w-4 h-4 mr-2" />
                Download Comparison PDF
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Send className="w-4 h-4 mr-2" />
                Contact Customer
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
