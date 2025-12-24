"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clipboard,
  Search,
  Eye,
  TrendingUp,
  DollarSign,
  Package,
  CheckCircle,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { getRFQs, getBidsForRFQ } from "../../../lib/database";

interface RFQ {
  id: string;
  order_id: string;
  display_value: number;
  materials: string[];
  lead_time: number;
  parts: any;
  status: string;
  created_at: string;
  closes_at: string;
  bidCount?: number;
  lowestBid?: number;
  highestBid?: number;
}

export default function AdminRFQsPage() {
  const router = useRouter();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "bids" | "value">("date");

  useEffect(() => {
    async function loadRFQsWithBids() {
      try {
        setLoading(true);
        const rfqsData = await getRFQs();

        // Load bids for each RFQ
        const rfqsWithBids = await Promise.all(
          rfqsData.map(async (rfq) => {
            try {
              const bids = await getBidsForRFQ(rfq.id);
              const bidPrices = bids.map((b) => b.price);

              return {
                ...rfq,
                bidCount: bids.length,
                lowestBid:
                  bidPrices.length > 0 ? Math.min(...bidPrices) : undefined,
                highestBid:
                  bidPrices.length > 0 ? Math.max(...bidPrices) : undefined,
              };
            } catch (error) {
              console.error(`Error loading bids for RFQ ${rfq.id}:`, error);
              return {
                ...rfq,
                bidCount: 0,
                lowestBid: undefined,
                highestBid: undefined,
              };
            }
          }),
        );

        setRfqs(rfqsWithBids);
      } catch (error) {
        console.error("Error loading RFQs:", error);
        setRfqs([]);
      } finally {
        setLoading(false);
      }
    }

    loadRFQsWithBids();
  }, []);

  const getStatusBadge = (status: string, bidCount: number = 0) => {
    if (status === "open") {
      return (
        <Badge className="bg-green-100 text-green-700 border-0">
          <Clock className="w-3 h-3 mr-1" />
          Open ({bidCount} bids)
        </Badge>
      );
    } else if (status === "closed") {
      return (
        <Badge className="bg-gray-100 text-gray-700 border-0">
          <CheckCircle className="w-3 h-3 mr-1" />
          Closed
        </Badge>
      );
    } else if (status === "awarded") {
      return (
        <Badge className="bg-blue-100 text-blue-700 border-0">
          <CheckCircle className="w-3 h-3 mr-1" />
          Awarded
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const filteredRfqs = rfqs
    .filter((rfq) => {
      const matchesSearch =
        rfq.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rfq.order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rfq.materials.some((m) =>
          m.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      const matchesFilter =
        filterStatus === "all" || rfq.status === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } else if (sortBy === "bids") {
        return (b.bidCount || 0) - (a.bidCount || 0);
      } else if (sortBy === "value") {
        return (b.lowestBid || 0) - (a.lowestBid || 0);
      }
      return 0;
    });

  const totalRFQs = rfqs.length;
  const openRFQs = rfqs.filter((r) => r.status === "open").length;
  const totalBids = rfqs.reduce((sum, r) => sum + (r.bidCount || 0), 0);
  const avgBidsPerRFQ =
    totalRFQs > 0 ? (totalBids / totalRFQs).toFixed(1) : "0";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading RFQs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          RFQ & Bid Management
        </h1>
        <p className="text-gray-600">
          Review and manage supplier bids for customer orders
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total RFQs</p>
                <p className="text-3xl font-bold text-gray-900">{totalRFQs}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <Clipboard className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Open RFQs</p>
                <p className="text-3xl font-bold text-gray-900">{openRFQs}</p>
                <p className="text-sm text-green-600 mt-1">Awaiting bids</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Bids</p>
                <p className="text-3xl font-bold text-gray-900">{totalBids}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {avgBidsPerRFQ} avg per RFQ
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Review</p>
                <p className="text-3xl font-bold text-gray-900">
                  {
                    rfqs.filter((r) => r.bidCount! > 0 && r.status === "open")
                      .length
                  }
                </p>
                <p className="text-sm text-orange-600 mt-1">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  Needs action
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1 relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by RFQ ID, order, or material..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600 mr-2">Filter:</span>
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("all")}
              >
                All
              </Button>
              <Button
                variant={filterStatus === "open" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("open")}
              >
                Open
              </Button>
              <Button
                variant={filterStatus === "closed" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("closed")}
              >
                Closed
              </Button>
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600 mr-2">Sort:</span>
              <Button
                variant={sortBy === "date" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("date")}
              >
                <Clock className="w-4 h-4 mr-1" />
                Date
              </Button>
              <Button
                variant={sortBy === "bids" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("bids")}
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                Bids
              </Button>
              <Button
                variant={sortBy === "value" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("value")}
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Value
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RFQ Table */}
      <Card>
        <CardHeader>
          <CardTitle>All RFQs</CardTitle>
        </CardHeader>
        <CardContent>
          {totalRFQs === 0 ? (
            <div className="text-center py-12">
              <Clipboard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No RFQs Yet
              </h3>
              <p className="text-gray-600 mb-6">
                RFQs will appear here when orders are sent out for supplier
                bidding.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-sm text-blue-900 mb-2">
                  <strong>To create an RFQ:</strong>
                </p>
                <ol className="text-sm text-blue-800 text-left space-y-1">
                  <li>1. Customer places an order through instant-quote</li>
                  <li>2. Navigate to Orders in admin panel</li>
                  <li>3. Click "Send to RFQ" on an order</li>
                  <li>4. Suppliers can then submit bids</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RFQ ID</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Materials</TableHead>
                    <TableHead>Parts</TableHead>
                    <TableHead>Bids</TableHead>
                    <TableHead>Bid Range</TableHead>
                    <TableHead>Lead Time</TableHead>
                    <TableHead>Closes</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRfqs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="text-center py-8 text-gray-500"
                      >
                        No RFQs found matching your criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRfqs.map((rfq) => (
                      <TableRow key={rfq.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{rfq.id}</TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() =>
                              router.push(`/admin/orders/${rfq.order_id}`)
                            }
                          >
                            {rfq.order_id}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(rfq.status, rfq.bidCount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {rfq.materials.slice(0, 2).map((material, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-xs"
                              >
                                {material.split(" ")[0]}
                              </Badge>
                            ))}
                            {rfq.materials.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{rfq.materials.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span>{rfq.parts?.length || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {rfq.bidCount || 0}
                            </span>
                            {rfq.bidCount! > 0 && (
                              <Badge className="bg-blue-100 text-blue-700 border-0">
                                New
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {rfq.lowestBid && rfq.highestBid ? (
                            <div className="text-sm">
                              <div className="font-semibold text-green-600">
                                ${rfq.lowestBid.toLocaleString()}
                              </div>
                              <div className="text-gray-500 text-xs">
                                to ${rfq.highestBid.toLocaleString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">No bids</span>
                          )}
                        </TableCell>
                        <TableCell>{rfq.lead_time}d</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(rfq.closes_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => router.push(`/admin/rfqs/${rfq.id}`)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
