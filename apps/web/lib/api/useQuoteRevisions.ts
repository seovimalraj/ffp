/**
 * Step 15: Quote Revisions React Query Hooks
 * Custom hooks for managing quote revisions and expiration
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  quotesRevisionsApi,
  type ExtendExpirationResponse,
  type RepriceResponse,
  type RepriceRequest,
} from "./quotes-revisions";

/**
 * Fetch all revisions for a quote
 */
export function useRevisions(quoteId: string | undefined) {
  return useQuery({
    queryKey: ["revisions", quoteId],
    queryFn: () => quotesRevisionsApi.getRevisions(quoteId!),
    enabled: !!quoteId,
  });
}

/**
 * Fetch a specific revision
 */
export function useRevision(revisionId: string | undefined) {
  return useQuery({
    queryKey: ["revision", revisionId],
    queryFn: () => quotesRevisionsApi.getRevision(revisionId!),
    enabled: !!revisionId,
  });
}

/**
 * Extend quote expiration mutation
 */
export function useExtendExpiration(quoteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (days: number) =>
      quotesRevisionsApi.extendExpiration(quoteId, days),
    onSuccess: (data: ExtendExpirationResponse) => {
      // Invalidate quote query to refetch updated expires_at
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });

      // Optimistically update the cache if available
      queryClient.setQueryData(["quote", quoteId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          expires_at: data.new_expires_at,
        };
      });
    },
  });
}

/**
 * Reprice quote mutation
 */
export function useReprice(quoteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options: RepriceRequest = {}) =>
      quotesRevisionsApi.repriceQuote(quoteId, options),
    onSuccess: (data: RepriceResponse) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["revisions", quoteId] });

      // Optimistically update quote status and version
      queryClient.setQueryData(["quote", quoteId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          status: data.status,
          version: data.version,
          repriced_at: data.repriced_at,
        };
      });
    },
  });
}

/**
 * Hook to check if quote is expired
 */
export function useQuoteExpiration(expiresAt: string | null | undefined) {
  if (!expiresAt) return { isExpired: false, daysLeft: null };

  const now = new Date();
  const expiryDate = new Date(expiresAt);
  const diffMs = expiryDate.getTime() - now.getTime();
  const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    isExpired: diffMs <= 0,
    daysLeft: daysLeft >= 0 ? daysLeft : 0,
    expiryDate,
  };
}
