"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Package,
  CheckCircle,
  Truck,
  FileText,
  MapPin,
  DollarSign,
  AlertCircle,
  Download,
  Loader2,
} from "lucide-react";
import {
  getOrder,
  getKanbanState,
  getOrderTimeline,
} from "../../../../lib/database";

export default function CustomerOrderTrackingPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId as string;

  const [orderData, setOrderData] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrderTracking();
  }, [orderId]);

  const loadOrderTracking = async () => {
    if (!orderId) return;

    try {
      setLoading(true);

      // Load order data
      const order = await getOrder(orderId);
      if (!order) {
        alert("Order not found");
        router.push("/portal/orders");
        return;
      }
      setOrderData(order);

      // Load kanban state for progress
      const kanbanState = await getKanbanState(orderId);
      if (kanbanState.length > 0) {
        const completedParts = kanbanState.filter(
          (p: any) => p.status === "done",
        ).length;
        const calculatedProgress = Math.round(
          (completedParts / kanbanState.length) * 100,
        );
        setProgress(calculatedProgress);
      }

      // Load timeline events
      const timelineData = await getOrderTimeline(orderId);
      setTimeline(timelineData);
    } catch (error) {
      console.error("Error loading order tracking:", error);
      alert("Failed to load order tracking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!orderData) return <div>Order not found</div>;

  const deliveryDate = new Date(orderData.created_at);
  deliveryDate.setDate(deliveryDate.getDate() + (orderData.lead_time || 7));

  // Map timeline icons
  const eventIcons: Record<string, any> = {
    order_placed: CheckCircle,
    rfq_created: FileText,
    bid_received: DollarSign,
    bid_approved: CheckCircle,
    production_started: Package,
    part_completed: CheckCircle,
    shipped: Truck,
    delivered: MapPin,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push("/portal/orders")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Order Tracking</h1>
            <p className="text-gray-600">Order #{orderData.id}</p>
          </div>
          <Badge className="bg-blue-100 text-blue-700 border-0 text-lg px-4 py-2">
            {orderData.status?.toUpperCase() || "PROCESSING"}
          </Badge>
        </div>

        {/* Progress Bar */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-900">Production Progress</p>
              <p className="text-sm text-gray-600">{progress}% Complete</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
              <span>
                Placed: {new Date(orderData.created_at).toLocaleDateString()}
              </span>
              <span>Est. Delivery: {deliveryDate.toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-8">
              {timeline.map((event: any, index: number) => {
                const Icon = eventIcons[event.event_type] || FileText;
                const isLast = index === timeline.length - 1;

                return (
                  <div key={event.id} className="relative">
                    {!isLast && (
                      <div className="absolute left-6 top-12 w-0.5 h-full bg-green-500" />
                    )}

                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 bg-green-100 border-2 border-green-500">
                        <Icon className="w-6 h-6 text-green-600" />
                      </div>

                      <div className="flex-1 pb-8">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {event.title}
                          </h3>
                          {event.created_at && (
                            <p className="text-sm text-gray-500">
                              {new Date(event.created_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orderData.parts?.map((part: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {part.file_name}
                      </p>
                      <p className="text-sm text-gray-600">{part.material}</p>
                    </div>
                    <Badge variant="outline">Qty: {part.quantity}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Parts:</span>
                  <span className="font-semibold">
                    {orderData.parts?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lead Time:</span>
                  <span className="font-semibold">
                    {orderData.lead_time} days
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t">
                  <span className="font-semibold text-gray-900">
                    Total Amount:
                  </span>
                  <span className="text-xl font-bold text-blue-600">
                    $
                    {orderData.total_price?.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="outline" className="flex-1">
                <FileText className="w-4 h-4 mr-2" />
                View Order Details
              </Button>
              <Button variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download Invoice
              </Button>
              <Button variant="outline" className="flex-1">
                <AlertCircle className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900">Quality Guaranteed</p>
            <p className="text-sm text-blue-800">
              Your parts are being manufactured by verified suppliers. All
              updates are tracked in real-time for your visibility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
