"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Clock,
  DollarSign,
  Package,
  Search,
  Eye,
  AlertCircle,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { getRFQs } from "../../../lib/database";

interface RFQ {
  id: string;
  order_id: string;
  display_value: number;
  materials: string[];
  lead_time: number;
  parts: number;
  status: string;
  created_at: string;
  closes_at: string;
}

export default function SupplierRFQsPage() {
  const router = useRouter();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    async function loadRFQs() {
      try {
        setLoading(true);
        const data = await getRFQs();
        setRfqs(data);
      } catch (error) {
        console.error("Error loading RFQs:", error);
        // Use mock data if API fails
        const mockRFQs: RFQ[] = [
          {
            id: "RFQ-2024-001",
            order_id: "ORD-2024-045",
            display_value: 12750.0,
            materials: ["Aluminum 6061", "Stainless Steel 304"],
            lead_time: 14,
            parts: 5,
            status: "open",
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            closes_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "RFQ-2024-002",
            order_id: "ORD-2024-046",
            display_value: 8500.0,
            materials: ["Titanium Ti-6Al-4V"],
            lead_time: 21,
            parts: 3,
            status: "open",
            created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            closes_at: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "RFQ-2024-003",
            order_id: "ORD-2024-047",
            display_value: 24500.0,
            materials: ["Aluminum 7075", "Stainless Steel 316"],
            lead_time: 10,
            parts: 8,
            status: "open",
            created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
            closes_at: new Date(Date.now() + 60 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "RFQ-2024-004",
            order_id: "ORD-2024-048",
            display_value: 6750.0,
            materials: ["Plastic ABS", "Nylon PA6"],
            lead_time: 7,
            parts: 12,
            status: "bid-submitted",
            created_at: new Date(
              Date.now() - 24 * 60 * 60 * 1000,
            ).toISOString(),
            closes_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "RFQ-2024-005",
            order_id: "ORD-2024-049",
            display_value: 15200.0,
            materials: ["Brass C360", "Copper C110"],
            lead_time: 18,
            parts: 6,
            status: "open",
            created_at: new Date(
              Date.now() - 12 * 60 * 60 * 1000,
            ).toISOString(),
            closes_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "RFQ-2024-006",
            order_id: "ORD-2024-050",
            display_value: 9850.0,
            materials: ["Aluminum 6061"],
            lead_time: 12,
            parts: 4,
            status: "bid-submitted",
            created_at: new Date(
              Date.now() - 36 * 60 * 60 * 1000,
            ).toISOString(),
            closes_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          },
        ];
        setRfqs(mockRFQs);
      } finally {
        setLoading(false);
      }
    }

    loadRFQs();
  }, []);

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const filteredRFQs = rfqs.filter((rfq) => {
    const matchesSearch =
      rfq.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rfq.materials.some((m) =>
        m.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    const matchesFilter = filterStatus === "all" || rfq.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const openCount = rfqs.filter((r) => r.status === "open").length;
  const bidSubmittedCount = rfqs.filter(
    (r) => r.status === "bid-submitted",
  ).length;
  const totalValue = rfqs
    .filter((r) => r.status === "open")
    .reduce((sum, r) => sum + r.display_value, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading RFQs...</p>
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
            Request for Quotes
          </h1>
          <p className="text-gray-600">
            Review and bid on manufacturing opportunities
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Open RFQs</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {openCount}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    Available for bidding
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
                  <p className="text-sm text-gray-600 mb-1">Bids Submitted</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {bidSubmittedCount}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Awaiting approval
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Potential Value</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ${(totalValue * 2).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Estimated total</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search by RFQ ID or material..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === "all" ? "default" : "outline"}
                  onClick={() => setFilterStatus("all")}
                  className={filterStatus === "all" ? "bg-blue-600" : ""}
                >
                  All
                </Button>
                <Button
                  variant={filterStatus === "open" ? "default" : "outline"}
                  onClick={() => setFilterStatus("open")}
                  className={filterStatus === "open" ? "bg-blue-600" : ""}
                >
                  Open
                </Button>
                <Button
                  variant={
                    filterStatus === "bid-submitted" ? "default" : "outline"
                  }
                  onClick={() => setFilterStatus("bid-submitted")}
                  className={
                    filterStatus === "bid-submitted" ? "bg-blue-600" : ""
                  }
                >
                  Submitted
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Notice */}
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-900">
              Privacy Protected RFQs
            </p>
            <p className="text-sm text-yellow-800">
              Customer information is masked for privacy. Click "View Details"
              to unlock full specifications and submit your bid.
            </p>
          </div>
        </div>

        {/* RFQ List */}
        <div className="space-y-4">
          {filteredRFQs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                {rfqs.length === 0 ? (
                  <>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      No RFQs Available
                    </h3>
                    <p className="text-gray-600 mb-4">
                      There are currently no open RFQs to bid on.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                      <p className="text-sm text-blue-900">
                        RFQs will appear here when customers place orders that
                        require manufacturing quotes. Check back regularly for
                        new opportunities.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600">
                      No RFQs found matching your criteria
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setSearchQuery("");
                        setFilterStatus("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredRFQs.map((rfq) => (
              <Card key={rfq.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {rfq.id}
                        </h3>
                        <Badge
                          className={
                            rfq.status === "open"
                              ? "bg-green-100 text-green-700 border-0"
                              : rfq.status === "bid-submitted"
                                ? "bg-blue-100 text-blue-700 border-0"
                                : "bg-gray-100 text-gray-700 border-0"
                          }
                        >
                          {rfq.status === "open"
                            ? "Open for Bidding"
                            : rfq.status === "bid-submitted"
                              ? "Bid Submitted"
                              : "Closed"}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {getTimeAgo(rfq.created_at)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-600">Parts</p>
                            <p className="font-semibold text-gray-900">
                              {rfq.parts}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-600">Est. Value</p>
                            <p className="font-semibold text-gray-900">
                              ~${(rfq.display_value * 2).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-600">Lead Time</p>
                            <p className="font-semibold text-gray-900">
                              {rfq.lead_time} days
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-gray-600 mb-1">
                            Materials
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {rfq.materials.map((material, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="text-xs"
                              >
                                {material.split(" ")[0]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                        <strong className="text-gray-900">
                          Limited Preview:
                        </strong>{" "}
                        This is basic information only. View full
                        specifications, 3D models, and technical drawings to
                        submit your bid.
                      </div>
                    </div>

                    <div className="ml-6">
                      <Button
                        onClick={() => router.push(`/supplier/rfqs/${rfq.id}`)}
                        disabled={rfq.status === "closed"}
                        className={
                          rfq.status === "open"
                            ? "bg-blue-600 hover:bg-blue-700"
                            : ""
                        }
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {rfq.status === "open"
                          ? "View & Bid"
                          : rfq.status === "bid-submitted"
                            ? "View Bid"
                            : "View Details"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
