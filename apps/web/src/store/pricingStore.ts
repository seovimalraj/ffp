import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ContractsV1 } from "@cnc-quote/shared";
 
export interface PricingRowView {
  quantity: number;
  unit_price?: number;
  total_price?: number;
  lead_time_days?: number;
  breakdown?: any;
  status?: string;
  optimistic?: boolean;
  compliance?: ContractsV1.QuoteComplianceSnapshotV1 | null;
}

export interface ItemPricingView {
  quote_item_id: string;
  pricing_version?: number;
  rows: PricingRowView[];
  latency_ms?: number;
  correlation_id?: string;
  last_updated?: string;
}

interface PricingState {
  quoteId?: string;
  items: Record<string, ItemPricingView>;
  lastSubtotalDelta?: number;
  driftDetected: boolean;
  reconciling: boolean;
  setQuoteId: (id: string) => void;
  applyPricingEvent: (
    evt:
      | ContractsV1.PricingOptimisticEventV1
      | ContractsV1.PricingUpdateEventV1,
  ) => void;
  markDrift: () => void;
  reconcile: (itemIds?: string[]) => Promise<void>;
  reset: () => void;
  hydrateFromSummary: (
    items: Array<{
      id: string;
      pricing_matrix?: any[];
      config_json?: any;
      pricing_version?: number;
    }>,
  ) => void;
}

function mergeRows(
  existing: PricingRowView[],
  patches: ContractsV1.PricingMatrixRowPatchV1[],
  optimistic: boolean,
) {
  type RowMutable = PricingRowView;
  const map = new Map<number, RowMutable>(
    existing.map((r) => [r.quantity, { ...r }]),
  );
  for (const p of patches) {
    const prev: RowMutable = map.get(p.quantity) || { quantity: p.quantity };
    const next: RowMutable = {
      quantity: p.quantity,
      unit_price: p.unit_price !== undefined ? p.unit_price : prev.unit_price,
      total_price:
        p.total_price !== undefined ? p.total_price : prev.total_price,
      lead_time_days:
        p.lead_time_days !== undefined ? p.lead_time_days : prev.lead_time_days,
      breakdown: p.breakdown !== undefined ? p.breakdown : prev.breakdown,
      status: p.status !== undefined ? p.status : prev.status,
      optimistic: optimistic || p.status === "optimistic" || prev.optimistic,
      compliance:
        p.compliance !== undefined
          ? (p.compliance ?? null)
          : (prev.compliance ?? null),
    };
    map.set(p.quantity, next);
  }
  return Array.from(map.values()).sort((a, b) => a.quantity - b.quantity);
}

export const usePricingStore = create<PricingState>()(
  persist(
    (set, get) => ({
      quoteId: undefined,
      items: {},
      driftDetected: false,
      reconciling: false,
      lastSubtotalDelta: undefined,
      setQuoteId: (id) => set({ quoteId: id }),
      markDrift: () => set({ driftDetected: true }),
      applyPricingEvent: (evt) =>
        set((state) => {
          const {
            quote_item_id,
            matrix_patches,
            pricing_version,
            optimistic,
            subtotal_delta,
            latency_ms,
          } = (evt as any).payload || {};
          if (!quote_item_id) return state;
          const current = state.items[quote_item_id] || {
            quote_item_id,
            rows: [],
          };
          const rows = mergeRows(
            current.rows,
            matrix_patches || [],
            !!optimistic,
          );
          return {
            ...state,
            lastSubtotalDelta:
              subtotal_delta !== undefined
                ? subtotal_delta
                : state.lastSubtotalDelta,
            items: {
              ...state.items,
              [quote_item_id]: {
                ...current,
                pricing_version: pricing_version || current.pricing_version,
                rows,
                latency_ms: latency_ms ?? current.latency_ms,
                correlation_id:
                  (evt as any).correlation_id || current.correlation_id,
                last_updated: new Date().toISOString(),
              },
            },
          };
        }),
      reconcile: async (itemIds) => {
        const { quoteId } = get();
        if (!quoteId) return;
        set({ reconciling: true });
        try {
          const resp = await fetch("/api/price/v2/recalculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quote_id: quoteId,
              quote_item_ids: itemIds,
            }),
          });
          if (!resp.ok) throw new Error(`reconcile failed ${resp.status}`);
          const data = await resp.json();
          const results = data?.results || [];
          set((state) => {
            let lastSubtotalDelta = state.lastSubtotalDelta;
            const updatedItems = { ...state.items };
            for (const r of results) {
              if (r.error) continue;
              const current = updatedItems[r.quote_item_id] || {
                quote_item_id: r.quote_item_id,
                rows: [],
              };
              const rows = mergeRows(
                current.rows,
                r.matrix_patches || [],
                false,
              );
              if (r.subtotal_delta !== undefined)
                lastSubtotalDelta = r.subtotal_delta;
              updatedItems[r.quote_item_id] = {
                ...current,
                pricing_version: r.pricing_version || current.pricing_version,
                rows,
                last_updated: new Date().toISOString(),
              };
            }
            return {
              ...state,
              items: updatedItems,
              lastSubtotalDelta,
              driftDetected: false,
              reconciling: false,
            };
          });
        } catch (err) {
           
          console.warn("reconcile failed", err);
          set({ reconciling: false });
        }
      },
      reset: () =>
        set({
          quoteId: undefined,
          items: {},
          driftDetected: false,
          lastSubtotalDelta: undefined,
        }),
      hydrateFromSummary: (summaryItems) => {
        const timestamp = new Date().toISOString();
        set((state) => {
          const nextItems = { ...state.items };
          for (const item of summaryItems) {
            const matrix = Array.isArray((item as any).pricing_matrix)
              ? (item as any).pricing_matrix
              : Array.isArray((item as any).pricing?.matrix)
                ? (item as any).pricing.matrix
                : Array.isArray(item.config_json?.pricing?.matrix)
                  ? item.config_json.pricing.matrix
                  : undefined;
            if (!Array.isArray(matrix) || matrix.length === 0) {
              continue;
            }
            nextItems[item.id] = {
              quote_item_id: item.id,
              pricing_version:
                item.pricing_version ??
                (item as any).pricing?.version ??
                item.config_json?.pricing?.version ??
                nextItems[item.id]?.pricing_version,
              rows: matrix.map((row: any) => ({
                quantity: row.quantity,
                unit_price: row.unit_price,
                total_price: row.total_price,
                lead_time_days: row.lead_time_days,
                breakdown: row.breakdown,
                status: row.status || "ready",
                optimistic: Boolean(row.optimistic),
                compliance: row.compliance ?? null,
              })),
              last_updated: timestamp,
            };
          }
          return { ...state, items: nextItems };
        });
      },
    }),
    {
      name: "pricing-store",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
