/**
 * Step 14: React Query Hooks for Outcomes & Margins
 * Type-safe hooks with optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  quotesApi,
  type SetOutcomeRequest,
  type OutcomeResponse,
  type OutcomesListFilters,
  type QuoteOutcomeStatus,
} from "../api/quotes";

// Re-export types for convenience
export type { SetOutcomeRequest, QuoteOutcomeStatus };

// ============================================
// Query Keys
// ============================================

export const outcomesKeys = {
  all: ["outcomes"] as const,
  lists: () => [...outcomesKeys.all, "list"] as const,
  list: (filters?: OutcomesListFilters) =>
    [...outcomesKeys.lists(), filters] as const,
  details: () => [...outcomesKeys.all, "detail"] as const,
  detail: (quoteId: string) => [...outcomesKeys.details(), quoteId] as const,
};

export const marginsKeys = {
  all: ["margins"] as const,
  details: () => [...marginsKeys.all, "detail"] as const,
  detail: (quoteId: string) => [...marginsKeys.details(), quoteId] as const,
};

export const lookupsKeys = {
  reasonCodes: ["lookups", "reason-codes"] as const,
};

// ============================================
// Outcome Hooks
// ============================================

/**
 * Get outcome for a specific quote
 */
export function useOutcome(quoteId: string) {
  return useQuery({
    queryKey: outcomesKeys.detail(quoteId),
    queryFn: () => quotesApi.getOutcome(quoteId),
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * List outcomes with filters
 */
export function useOutcomesList(filters?: OutcomesListFilters) {
  return useQuery({
    queryKey: outcomesKeys.list(filters),
    queryFn: () => quotesApi.listOutcomes(filters),
    staleTime: 30_000,
  });
}

/**
 * Set outcome for a quote (with optimistic update)
 */
export function useSetOutcome(quoteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetOutcomeRequest) =>
      quotesApi.setOutcome(quoteId, data),

    // Optimistic update
    onMutate: async (newData) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: outcomesKeys.detail(quoteId),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<OutcomeResponse>(
        outcomesKeys.detail(quoteId),
      );

      // Optimistically update
      queryClient.setQueryData<OutcomeResponse>(
        outcomesKeys.detail(quoteId),
        (old) => {
          if (!old) {
            return {
              quote_id: quoteId,
              org_id: "",
              status: newData.status,
              reason_code: newData.reason_code || null,
              reason_notes: newData.reason_notes || null,
              amount: newData.amount || null,
              decided_by: "",
              decided_at: new Date().toISOString(),
              meta: newData.meta || {},
            };
          }
          return {
            ...old,
            status: newData.status,
            reason_code: newData.reason_code || null,
            reason_notes: newData.reason_notes || null,
            amount: newData.amount || null,
            decided_at: new Date().toISOString(),
            meta: { ...old.meta, ...newData.meta },
          };
        },
      );

      return { previous };
    },

    // Rollback on error
    onError: (err, newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          outcomesKeys.detail(quoteId),
          context.previous,
        );
      }
    },

    // Refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outcomesKeys.detail(quoteId) });
      queryClient.invalidateQueries({ queryKey: outcomesKeys.lists() });
    },
  });
}

/**
 * Delete outcome for a quote
 */
export function useDeleteOutcome(quoteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => quotesApi.deleteOutcome(quoteId),

    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: outcomesKeys.detail(quoteId),
      });
      const previous = queryClient.getQueryData(outcomesKeys.detail(quoteId));

      // Optimistically clear
      queryClient.setQueryData(outcomesKeys.detail(quoteId), null);

      return { previous };
    },

    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          outcomesKeys.detail(quoteId),
          context.previous,
        );
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outcomesKeys.detail(quoteId) });
      queryClient.invalidateQueries({ queryKey: outcomesKeys.lists() });
    },
  });
}

// ============================================
// Margins Hooks
// ============================================

/**
 * Get margins for a specific quote
 */
export function useMargins(quoteId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marginsKeys.detail(quoteId),
    queryFn: () => quotesApi.getMargins(quoteId),
    staleTime: 60_000, // 1 minute (margins are finalized, rarely change)
    enabled: options?.enabled,
  });
}

/**
 * Export margins as CSV
 */
export function useExportMarginsCsv() {
  return useMutation({
    mutationFn: (filters?: {
      date_from?: string;
      date_to?: string;
      status?: string;
      customer_id?: string;
    }) => quotesApi.exportMarginsCsv(filters),

    onSuccess: (blob) => {
      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quote-margins-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });
}

/**
 * Export margins as JSON
 */
export function useExportMarginsJson() {
  return useMutation({
    mutationFn: (filters?: {
      date_from?: string;
      date_to?: string;
      status?: string;
      customer_id?: string;
    }) => quotesApi.exportMarginsJson(filters),
  });
}

// ============================================
// Lookups Hooks
// ============================================

/**
 * Get reason codes for outcome dropdowns
 */
export function useReasonCodes() {
  return useQuery({
    queryKey: lookupsKeys.reasonCodes,
    queryFn: () => quotesApi.getReasonCodes(),
    staleTime: 5 * 60_000, // 5 minutes (lookups change rarely)
  });
}
