"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClockIcon,
  DocumentIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

interface AbandonedQuote {
  quoteId: string;
  userId?: string;
  guestEmail?: string;
  currentStep:
    | "file_upload"
    | "pricing_review"
    | "checkout_started"
    | "payment_info";
  files: Array<{
    fileId: string;
    fileName: string;
    fileSize?: number;
    contentType?: string;
  }>;
  selectedLeadOptions?: {
    [lineId: string]: string;
  };
  customizations?: {
    [lineId: string]: {
      material?: string;
      finish?: string;
      quantity?: number;
    };
  };
  checkoutData?: any;
  lastActivity: string;
  abandonedAt: string;
}

interface AbandonedQuoteRecoveryProps {
  userId?: string;
  guestEmail?: string;
  onResumeQuote: (quoteId: string, quoteData: AbandonedQuote) => void;
}

export function AbandonedQuoteRecovery({
  userId,
  guestEmail,
  onResumeQuote,
}: AbandonedQuoteRecoveryProps) {
  const [quotes, setQuotes] = useState<AbandonedQuote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAbandonedQuotes = async () => {
    if (!userId && !guestEmail) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (userId) params.append("userId", userId);
      if (guestEmail) params.append("guestEmail", guestEmail);

      const response = await fetch(
        `/api/quotes/abandoned?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load abandoned quotes");
      }

      const data = await response.json();
      setQuotes(data.quotes || []);
    } catch (err) {
      console.error("Failed to load abandoned quotes:", err);
      setError("Failed to load your saved quotes");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAbandonedQuote = async (quoteId: string) => {
    try {
      const response = await fetch(`/api/quotes/abandoned?quoteId=${quoteId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setQuotes(quotes.filter((q) => q.quoteId !== quoteId));
      }
    } catch (error) {
      console.error("Failed to delete abandoned quote:", error);
    }
  };

  useEffect(() => {
    loadAbandonedQuotes();
  }, [userId, guestEmail]);

  const getStepLabel = (step: AbandonedQuote["currentStep"]) => {
    switch (step) {
      case "file_upload":
        return "File Upload";
      case "pricing_review":
        return "Pricing Review";
      case "checkout_started":
        return "Checkout Started";
      case "payment_info":
        return "Payment Info";
      default:
        return "Unknown";
    }
  };

  const getStepColor = (step: AbandonedQuote["currentStep"]) => {
    switch (step) {
      case "file_upload":
        return "bg-blue-100 text-blue-800";
      case "pricing_review":
        return "bg-yellow-100 text-yellow-800";
      case "checkout_started":
        return "bg-orange-100 text-orange-800";
      case "payment_info":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!userId && !guestEmail) return null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved Quotes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading your saved quotes...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved Quotes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-600 mb-2">{error}</p>
            <Button onClick={loadAbandonedQuotes} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quotes.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center">
          <ClockIcon className="w-5 h-5 mr-2" />
          Resume Previous Quotes ({quotes.length})
        </CardTitle>
        <p className="text-sm text-gray-600">
          You have {quotes.length} saved quote{quotes.length !== 1 ? "s" : ""}{" "}
          that you can continue working on.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {quotes.map((quote) => (
            <div
              key={quote.quoteId}
              className="border rounded-lg p-4 bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium text-gray-900">
                      Quote {quote.quoteId}
                    </h4>
                    <Badge className={getStepColor(quote.currentStep)}>
                      {getStepLabel(quote.currentStep)}
                    </Badge>
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                    <div className="flex items-center">
                      <DocumentIcon className="w-4 h-4 mr-1" />
                      {quote.files.length} file
                      {quote.files.length !== 1 ? "s" : ""}
                    </div>
                    <div className="flex items-center">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      {formatDistanceToNow(new Date(quote.abandonedAt), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Files: {quote.files.map((f) => f.fileName).join(", ")}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => onResumeQuote(quote.quoteId, quote)}
                    size="sm"
                  >
                    Resume
                  </Button>
                  <Button
                    onClick={() => deleteAbandonedQuote(quote.quoteId)}
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
