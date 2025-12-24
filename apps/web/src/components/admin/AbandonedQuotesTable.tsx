"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAbandonedQuotes } from "@/components/providers/AbandonedQuotesProvider";
import {
  EyeIcon,
  PaperAirplaneIcon,
  UserPlusIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { posthog } from "posthog-js";

export function AbandonedQuotesTable() {
  const {
    quotes,
    isLoading,
    selectQuote,
    sendReminder,
    assignQuote,
    convertToManualReview,
  } = useAbandonedQuotes();

  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [assigningQuote, setAssigningQuote] = useState<string | null>(null);
  const [convertingQuote, setConvertingQuote] = useState<string | null>(null);

  const handleSendReminder = async (quoteId: string) => {
    setSendingReminder(quoteId);
    try {
      await sendReminder(quoteId);
      posthog.capture("abandoned_reminder_sent", { quote_id: quoteId });
    } catch (error) {
      console.error("Failed to send reminder:", error);
    } finally {
      setSendingReminder(null);
    }
  };

  const handleAssignQuote = async (quoteId: string) => {
    setAssigningQuote(quoteId);
    try {
      // In a real implementation, this would open a user selector
      await assignQuote(quoteId, "user-123"); // Mock user ID
      posthog.capture("abandoned_quote_assigned", { quote_id: quoteId });
    } catch (error) {
      console.error("Failed to assign quote:", error);
    } finally {
      setAssigningQuote(null);
    }
  };

  const handleConvertToManualReview = async (quoteId: string) => {
    setConvertingQuote(quoteId);
    try {
      await convertToManualReview(quoteId);
      posthog.capture("abandoned_manual_review_convert", { quote_id: quoteId });
    } catch (error) {
      console.error("Failed to convert to manual review:", error);
    } finally {
      setConvertingQuote(null);
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "Before Upload":
        return "bg-gray-100 text-gray-800";
      case "After Upload":
        return "bg-blue-100 text-blue-800";
      case "After CAD":
        return "bg-yellow-100 text-yellow-800";
      case "After First Price":
        return "bg-green-100 text-green-800";
      case "After Lead Select":
        return "bg-purple-100 text-purple-800";
      case "Checkout Abandon":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-500">No abandoned quotes found</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Quote ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Organization
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Buyer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Activity
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stage
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Subtotal
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Files
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              DFM Issues
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Promo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Assignee
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {quotes.map((quote) => (
            <tr key={quote.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {quote.id}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {quote.organization_id}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {quote.buyer_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {quote.buyer_email}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(quote.last_activity).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge className={getStageColor(quote.stage)}>
                  {quote.stage}
                </Badge>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${quote.subtotal.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {quote.files_count}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {quote.dfm_blockers_count > 0 ? (
                  <Badge variant="destructive">
                    {quote.dfm_blockers_count}
                  </Badge>
                ) : (
                  <span className="text-sm text-gray-500">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {quote.promo_tried ? (
                  <Badge variant="secondary">Yes</Badge>
                ) : (
                  <span className="text-sm text-gray-500">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {quote.assignee_id ? "Assigned" : "Unassigned"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectQuote(quote.id)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSendReminder(quote.id)}
                    disabled={sendingReminder === quote.id}
                    className="text-green-600 hover:text-green-900"
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAssignQuote(quote.id)}
                    disabled={assigningQuote === quote.id}
                    className="text-purple-600 hover:text-purple-900"
                  >
                    <UserPlusIcon className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleConvertToManualReview(quote.id)}
                    disabled={convertingQuote === quote.id}
                    className="text-orange-600 hover:text-orange-900"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
