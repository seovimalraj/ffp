"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAbandonedQuotes } from "@/components/providers/AbandonedQuotesProvider";
import {
  PhoneIcon,
  EnvelopeIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

export function AbandonedTimelineDrawer() {
  const { selectedQuoteId, timeline, selectQuote } = useAbandonedQuotes();
  const [activeTab, setActiveTab] = useState("timeline");
  const handleClose = () => {
    selectQuote(null);
  };

  const handleCallBuyer = () => {
    // In a real implementation, this would initiate a phone call
  };

  const handleEmailQuote = () => {
    // In a real implementation, this would send an email
  };

  const handleDuplicateQuote = () => {
    // In a real implementation, this would duplicate the quote
  };

  const formatEventName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getEventIcon = (name: string) => {
    if (name.includes("view")) return "👁️";
    if (name.includes("upload")) return "📁";
    if (name.includes("cad")) return "⚙️";
    if (name.includes("price")) return "💰";
    if (name.includes("lead")) return "⏱️";
    if (name.includes("checkout")) return "🛒";
    if (name.includes("promo")) return "🎫";
    return "📝";
  };

  return (
    <Dialog open={!!selectedQuoteId} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Abandoned Quote Timeline - {selectedQuoteId}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="quote_snapshot">Quote Snapshot</TabsTrigger>
            <TabsTrigger value="root_cause">Root Cause</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No timeline events found
                </div>
              ) : (
                timeline.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start space-x-3 p-4 border rounded-lg"
                  >
                    <div className="text-2xl">{getEventIcon(event.name)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900">
                          {formatEventName(event.name)}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {new Date(event.ts).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        Actor: {event.actor_role}
                      </div>
                      {Object.keys(event.props).length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          <details>
                            <summary className="cursor-pointer">
                              Details
                            </summary>
                            <pre className="mt-1 whitespace-pre-wrap">
                              {JSON.stringify(event.props, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="quote_snapshot" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Parts List</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Bracket (bracket.stl)</span>
                      <span>10 qty</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      CNC • Aluminum 6061 • Anodized
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lead Options Viewed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>USA Expedite (3 days)</span>
                      <Badge variant="secondary">Viewed</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>USA Standard (7 days)</span>
                      <Badge variant="secondary">Viewed</Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      No lead option selected
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Subtotal History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$125.50</div>
                <div className="text-sm text-gray-600">Current subtotal</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="root_cause" className="space-y-4">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Potential Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Badge variant="destructive">DFM Blocker</Badge>
                      <span className="text-sm">
                        Wall thickness issues detected
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">High Price</Badge>
                      <span className="text-sm">
                        Quote value may be too high for initial inquiry
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">No Account</Badge>
                      <span className="text-sm">
                        Customer hasn't created an account yet
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>
                      Send personalized follow-up email with design suggestions
                    </li>
                    <li>
                      Offer to review design for manufacturability improvements
                    </li>
                    <li>
                      Provide volume discount preview for larger quantities
                    </li>
                    <li>Schedule a call to discuss specific requirements</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={handleCallBuyer}>
            <PhoneIcon className="w-4 h-4 mr-2" />
            Call Buyer
          </Button>
          <Button variant="outline" onClick={handleEmailQuote}>
            <EnvelopeIcon className="w-4 h-4 mr-2" />
            Email Quote PDF
          </Button>
          <Button variant="outline" onClick={handleDuplicateQuote}>
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Duplicate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
