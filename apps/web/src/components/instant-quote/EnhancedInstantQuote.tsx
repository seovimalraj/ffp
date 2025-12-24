"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { InstantQuoteStateProvider } from "./InstantQuoteState";
import { PartListPanel } from "./PartListPanel";
import { SelectedPartWorkspace } from "./SelectedPartWorkspace";
import { QuoteSummaryPanel } from "./QuoteSummaryPanel";
import { usePricingStore } from "../../store/pricingStore";

interface EnhancedInstantQuoteProps {
  orgId: string;
  accessToken?: string;
  baseUrl?: string;
}

function EnhancedInstantQuoteInner({
  orgId,
  accessToken,
  baseUrl,
}: EnhancedInstantQuoteProps) {
  const router = useRouter();
  const [quoteId, setQuoteId] = useState<string | undefined>(undefined);
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dfmEvent] = useState<any>(undefined);

  const setStoreQuoteId = usePricingStore((s) => s.setQuoteId);
  const hydrateFromSummary = usePricingStore((s) => s.hydrateFromSummary);
  const reconcile = usePricingStore((s) => s.reconcile);

  const fetchQuote = useCallback(
    async (qid: string) => {
      if (!qid) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/quotes/${qid}?view=vnext`, {
          headers: { accept: "application/json" },
        });
        const summary = await res.json();

        if (summary?.parts && Array.isArray(summary.parts)) {
          setParts(summary.parts);
          hydrateFromSummary(summary.parts);
        }
      } catch (error) {
        console.error("Failed to fetch quote:", error);
      } finally {
        setLoading(false);
      }
    },
    [hydrateFromSummary],
  );

  // Ensure our axios helper carries the Supabase access token for any requests
  useEffect(() => {
    if (accessToken) {
      try {
        localStorage.setItem("authToken", accessToken);
      } catch {
        // ignore storage errors (e.g., SSR or disabled storage)
      }
    }
  }, [accessToken]);

  useEffect(() => {
    if (quoteId) {
      setStoreQuoteId(quoteId);
      fetchQuote(quoteId);
    }
  }, [quoteId, setStoreQuoteId, fetchQuote]);

  const handleQuoteReady = useCallback((qid: string) => {
    setQuoteId(qid);
  }, []);

  const handleUploaded = useCallback(
    (ctx: { quote_id?: string }) => {
      if (ctx.quote_id) {
        // First successful upload → redirect to quote page
        if (!quoteId) {
          router.push(`/quotes/${ctx.quote_id}`);
          return;
        }
        if (ctx.quote_id !== quoteId) {
          setQuoteId(ctx.quote_id);
        }
      }
      if (quoteId) {
        fetchQuote(quoteId);
      }
    },
    [quoteId, fetchQuote, router],
  );

  const handleRecalc = useCallback(
    async (partId: string, _cfg: any) => {
      if (!quoteId) return;
      try {
        await reconcile([partId]);
        await fetchQuote(quoteId);
      } catch (error) {
        console.error("Recalc failed:", error);
      }
    },
    [quoteId, reconcile, fetchQuote],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                <span className="text-white text-xl">✨</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Instant Quote
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  AI-powered instant quoting with real-time pricing
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {quoteId && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Quote: {quoteId.slice(0, 8)}...
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Parts List */}
          <div className="col-span-3">
            <PartListPanel
              parts={parts}
              loading={loading}
              orgId={orgId}
              authToken={accessToken}
              baseUrl={baseUrl}
              onQuoteReady={handleQuoteReady}
              onUploaded={handleUploaded}
            />
          </div>

          {/* Center: Workspace (Viewer + Config + Pricing) */}
          <div className="col-span-6">
            <SelectedPartWorkspace
              parts={parts}
              quoteId={quoteId}
              onRecalc={handleRecalc}
              dfm={dfmEvent}
            />
          </div>

          {/* Right: Summary */}
          <div className="col-span-3">
            <QuoteSummaryPanel parts={parts} />
          </div>
        </div>
      </main>
    </div>
  );
}

export function EnhancedInstantQuote({
  orgId,
  accessToken,
  baseUrl,
}: EnhancedInstantQuoteProps) {
  return (
    <InstantQuoteStateProvider>
      <EnhancedInstantQuoteInner
        orgId={orgId}
        accessToken={accessToken}
        baseUrl={baseUrl}
      />
    </InstantQuoteStateProvider>
  );
}
