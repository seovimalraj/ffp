"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  CreditCardIcon,
  BanknotesIcon,
  ShieldCheckIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

interface PaymentStepProps {
  quote: any;
  onSave: (data: any) => void;
  saving: boolean;
}

interface PaymentMethod {
  id: string;
  type: "card" | "paypal";
  last4?: string;
  brand?: string;
  email?: string;
}

export function PaymentStep({ quote, saving }: PaymentStepProps) {
  // PayPal is now the only supported method
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>("paypal");
  const [processing, setProcessing] = useState(false);

  // Mock saved payment methods
  const savedMethods: PaymentMethod[] = [
    {
      id: "paypal-1",
      type: "paypal",
      email: "john.doe@example.com",
    },
  ];

  const handlePayNow = async () => {
    setProcessing(true);
    try {
      // In real implementation: POST /payments/create-checkout-session
      const response = await fetch("/api/payments/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quote_id: quote.id,
          currency: "USD",
          payment_method: selectedPaymentMethod,
          return_urls: {
            success: `/checkout/${quote.id}/result/success`,
            cancel: `/checkout/${quote.id}/result/cancel`,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Payment session creation failed");
      }

      const { checkout_url } = await response.json();

      // Redirect to PSP-hosted flow
      window.location.href = checkout_url;
    } catch (error) {
      console.error("Payment failed:", error);
      alert("Payment processing failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case "card":
        return <CreditCardIcon className="h-5 w-5" />;
      case "paypal":
        return <BanknotesIcon className="h-5 w-5" />;
      default:
        return <CreditCardIcon className="h-5 w-5" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CreditCardIcon className="h-5 w-5" />
          <span>Payment</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Choose Payment Method */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Choose Payment Method</h3>

          <RadioGroup
            value={selectedPaymentMethod}
            onValueChange={setSelectedPaymentMethod}
          >
            <div className="space-y-3">
              {/* PayPal */}
              <div className="border rounded-lg p-4 cursor-pointer transition-colors hover:border-gray-300">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="paypal" />
                  <div className="flex items-center space-x-3 flex-1">
                    <BanknotesIcon className="h-6 w-6 text-blue-600" />
                    <div>
                      <div className="font-medium">PayPal</div>
                      <div className="text-sm text-gray-600">
                        Pay with your PayPal account
                      </div>
                    </div>
                    <div className="ml-auto flex items-center space-x-2">
                      <ShieldCheckIcon className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-green-600">Secure</span>
                    </div>
                  </div>
                </div>
                {selectedPaymentMethod === "paypal" && (
                  <div className="mt-4 pl-8">
                    <div className="space-y-3">
                      {savedMethods
                        .filter((m) => m.type === "paypal")
                        .map((method) => (
                          <div
                            key={method.id}
                            className="flex items-center justify-between bg-gray-50 p-3 rounded"
                          >
                            <div className="flex items-center space-x-3">
                              {getPaymentMethodIcon(method.type)}
                              <div>
                                <div className="font-medium">PayPal</div>
                                <div className="text-sm text-gray-600">
                                  {method.email}
                                </div>
                              </div>
                            </div>
                            <Badge variant="secondary">Saved</Badge>
                          </div>
                        ))}
                      <Button variant="outline" size="sm" className="w-full">
                        Use Different PayPal Account
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Billing Summary */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Billing Summary</h3>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Payment Method:</span>
                <span>PayPal</span>
              </div>

              <div className="flex justify-between text-sm">
                <span>PO Number:</span>
                <span>PO-2024-001 (optional)</span>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between font-semibold">
                  <span>Total Due Now:</span>
                  <span>${quote.total_due.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <LockClosedIcon className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-green-900">
                Secure Payment Processing
              </h4>
              <p className="text-sm text-green-700 mt-1">
                Your payment information is encrypted and processed securely. We
                never store your full card details.
              </p>
            </div>
          </div>
        </div>

        {/* Terms Agreement */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <ShieldCheckIcon className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">
                Terms & Conditions
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                By proceeding with payment, you agree to our terms of service
                and acknowledge that manufacturing will begin upon payment
                confirmation.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline">Back</Button>
          <Button
            onClick={handlePayNow}
            disabled={processing || saving}
            className="px-8"
          >
            {processing
              ? "Processing..."
              : `Pay $${quote.total_due.toFixed(2)} Now`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
