"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircleIcon,
  TruckIcon,
  EnvelopeIcon,
  ArrowDownTrayIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

interface Order {
  id: string;
  quote_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  billing_info: {
    email: string;
    name: string;
  };
  shipping_info?: {
    name: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
}

export default function OrderConfirmationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchOrderDetails();
    } else {
      setError("No session ID provided");
      setIsLoading(false);
    }
  }, [sessionId]);

  const fetchOrderDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/orders/confirmation?session_id=${sessionId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch order details");
      }
      const data = await response.json();
      setOrder(data.order);
    } catch (err) {
      console.error("Error fetching order:", err);
      setError("Failed to load order details");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadInvoice = async () => {
    if (!order) return;

    try {
      const response = await fetch(`/api/orders/${order.id}/invoice`);
      if (!response.ok) {
        throw new Error("Failed to download invoice");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${order.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error downloading invoice:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Order Not Found
          </h1>
          <p className="text-gray-600 mb-8">
            {error || "Unable to load order details"}
          </p>
          <Button onClick={() => router.push("/")}>Return Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <CheckCircleIcon className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Order Confirmed!</h1>
          <p className="text-gray-600 mt-2">
            Thank you for your order. We'll send you shipping updates at{" "}
            {order.billing_info.email}.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Order ID:</span>
                <span className="font-medium">{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Quote ID:</span>
                <span className="font-medium">{order.quote_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">
                  ${(order.amount / 100).toFixed(2)}{" "}
                  {order.currency.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <Badge variant="secondary">{order.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <EnvelopeIcon className="h-5 w-5 text-blue-600 mr-2" />
                Billing Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="font-medium">{order.billing_info.name}</p>
                <p className="text-gray-600">{order.billing_info.email}</p>
              </div>
            </CardContent>
          </Card>

          {order.shipping_info && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TruckIcon className="h-5 w-5 text-blue-600 mr-2" />
                  Shipping Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">{order.shipping_info.name}</p>
                  <p className="text-gray-600">
                    {order.shipping_info.address.line1}
                    {order.shipping_info.address.line2 &&
                      `, ${order.shipping_info.address.line2}`}
                  </p>
                  <p className="text-gray-600">
                    {order.shipping_info.address.city},{" "}
                    {order.shipping_info.address.state}{" "}
                    {order.shipping_info.address.postal_code}
                  </p>
                  <p className="text-gray-600">
                    {order.shipping_info.address.country}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                    <span className="text-sm font-medium text-blue-600">1</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Order Processing
                  </p>
                  <p className="text-sm text-gray-600">
                    We'll start processing your order within 1-2 business days.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                    <span className="text-sm font-medium text-blue-600">2</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Manufacturing
                  </p>
                  <p className="text-sm text-gray-600">
                    Your parts will be manufactured according to your
                    specifications.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                    <span className="text-sm font-medium text-blue-600">3</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Shipping</p>
                  <p className="text-sm text-gray-600">
                    We'll ship your order and provide tracking information.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={downloadInvoice}
            variant="outline"
            className="flex items-center"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Download Invoice
          </Button>
          <Button
            onClick={() => router.push("/portal")}
            className="flex items-center"
          >
            View Orders
            <ArrowRightIcon className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
