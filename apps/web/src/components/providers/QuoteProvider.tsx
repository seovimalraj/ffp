"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface LeadOption {
  id: string;
  region: "USA" | "International";
  speed: "Economy" | "Standard" | "Expedite";
  business_days: number;
  unit_price: number;
  msrp: number;
  savings_text: string;
}

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

interface QuoteContextType {
  quote: Quote | null;
  isLoading: boolean;
  error: string | null;
  updateLeadOption: (leadOptionId: string) => Promise<void>;
  refreshQuote: () => Promise<void>;
  hasBlockers: boolean;
}

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

interface QuoteProviderProps {
  children: ReactNode;
  quoteId: string;
}

export function QuoteProvider({ children, quoteId }: QuoteProviderProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/quotes/${quoteId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch quote");
      }

      const data = await response.json();
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const updateLeadOption = async (leadOptionId: string) => {
    const response = await fetch(`/api/quotes/${quoteId}/lead`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lead_option_id: leadOptionId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update lead option");
    }

    const updatedQuote = await response.json();
    setQuote(updatedQuote);
  };

  const refreshQuote = async () => {
    await fetchQuote();
  };

  // Check for blockers (DFM issues, review status, etc.)
  const hasBlockers = quote
    ? quote.status === "Needs_Review" ||
      quote.lines.some(
        () =>
          // This would be determined by DFM analysis results
          false, // Placeholder - would check for actual DFM blockers
      )
    : false;

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  const value: QuoteContextType = {
    quote,
    isLoading,
    error,
    updateLeadOption,
    refreshQuote,
    hasBlockers,
  };

  return (
    <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>
  );
}

export function useQuote() {
  const context = useContext(QuoteContext);
  if (context === undefined) {
    throw new Error("useQuote must be used within a QuoteProvider");
  }
  return context;
}
