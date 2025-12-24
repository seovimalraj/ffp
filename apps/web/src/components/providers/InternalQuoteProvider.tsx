"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface PricingBreakdown {
  setup_time_min: number;
  cycle_time_min: number;
  machine_rate_per_hr: number;
  material_buy_cost: number;
  material_waste_factor: number;
  tooling_wear_cost: number;
  finish_cost: number;
  inspection_cost: number;
  risk_adder: number;
  overhead: number;
  margin: number;
  unit_price: number;
}

interface LeadOption {
  id: string;
  region: "USA" | "International";
  speed: "Economy" | "Standard" | "Expedite";
  business_days: number;
  unit_price: number;
  msrp: number;
  savings_text: string;
}

interface QuoteLine {
  id: string;
  file_id: string;
  file_name: string;
  process: "CNC" | "SheetMetal" | "InjectionMolding";
  material: string;
  finish: string | null;
  qty: number;
  pricing_breakdown: PricingBreakdown;
  lead_time_options: LeadOption[];
}

interface ActivityEvent {
  id: string;
  quote_id: string;
  user_id: string;
  actor_role: "buyer" | "org_admin" | "guest";
  name: string;
  ts: string;
  props: Record<string, any>;
}

interface Quote {
  id: string;
  organization_id: string;
  status:
    | "Draft"
    | "Analyzing"
    | "Priced"
    | "Needs_Review"
    | "Reviewed"
    | "Sent"
    | "Accepted"
    | "Expired"
    | "Abandoned";
  source: "web" | "widget" | "large_order";
  lines: QuoteLine[];
  selected_lead_option_id: string | null;
  currency: string;
  subtotal: number;
  promo_code: string | null;
  created_at: string;
  updated_at: string;
}

interface InternalQuoteContextType {
  quote: Quote | null;
  activity: ActivityEvent[];
  isLoading: boolean;
  error: string | null;
  selectedLineId: string | null;
  refreshQuote: () => Promise<void>;
  updatePricingBreakdown: (
    lineId: string,
    breakdown: Partial<PricingBreakdown>,
  ) => Promise<void>;
  lockPrice: () => Promise<void>;
  sendToCustomer: () => Promise<void>;
  selectLine: (lineId: string | null) => void;
  repriceQuote: () => Promise<void>;
}

const InternalQuoteContext = createContext<
  InternalQuoteContextType | undefined
>(undefined);

interface InternalQuoteProviderProps {
  children: ReactNode;
  quoteId: string;
}

export function InternalQuoteProvider({
  children,
  quoteId,
}: InternalQuoteProviderProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const fetchQuote = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/quotes/${quoteId}?include=lines,pricing,dfm,activity`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch quote");
      }

      const data = await response.json();
      setQuote(data.quote);
      setActivity(data.activity || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const updatePricingBreakdown = async (
    lineId: string,
    breakdown: Partial<PricingBreakdown>,
  ) => {
    const response = await fetch(
      `/api/admin/quotes/${quoteId}/lines/${lineId}/override`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pricing_breakdown: breakdown }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to update pricing breakdown");
    }

    await fetchQuote(); // Refresh the quote data
  };

  const lockPrice = async () => {
    const response = await fetch(`/api/admin/quotes/${quoteId}/lock`, {
      method: "PUT",
    });

    if (!response.ok) {
      throw new Error("Failed to lock price");
    }

    await fetchQuote(); // Refresh the quote data
  };

  const sendToCustomer = async () => {
    const response = await fetch(`/api/quotes/${quoteId}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template: "quote_ready",
        channel: "email",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send quote");
    }

    await fetchQuote(); // Refresh the quote data
  };

  const selectLine = (lineId: string | null) => {
    setSelectedLineId(lineId);
  };

  const repriceQuote = async () => {
    const response = await fetch(`/api/admin/quotes/${quoteId}/reprice`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to reprice quote");
    }

    await fetchQuote(); // Refresh the quote data
  };

  const refreshQuote = async () => {
    await fetchQuote();
  };

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  const value: InternalQuoteContextType = {
    quote,
    activity,
    isLoading,
    error,
    selectedLineId,
    refreshQuote,
    updatePricingBreakdown,
    lockPrice,
    sendToCustomer,
    selectLine,
    repriceQuote,
  };

  return (
    <InternalQuoteContext.Provider value={value}>
      {children}
    </InternalQuoteContext.Provider>
  );
}

export function useInternalQuote() {
  const context = useContext(InternalQuoteContext);
  if (context === undefined) {
    throw new Error(
      "useInternalQuote must be used within an InternalQuoteProvider",
    );
  }
  return context;
}
