/**
 * Step 13: usePrice Hook
 * React Query hook for optimistic pricing with reconciliation
 */

"use client";

import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import { useRef, useCallback } from "react";
import {
  PricingRequest,
  PricingResponse,
  AnnotatedPricingResponse,
} from "./types";
import { fetchPrice } from "./client";
import { toStableKey, PRICING_QUERY_KEY } from "./queryKeys";
import {
  optimisticEstimate,
  shouldRollback,
  mergeServerResponse,
  estimateConfidence,
} from "./optimistic";
import { telemetry } from "../telemetry";
import { pricingToasts } from "../ui/toast";

/**
 * In-flight request tracking to prevent duplicate fetches
 */
const inFlightRequests = new Map<string, Promise<PricingResponse>>();

/**
 * Serialize request for deduplication key
 */
function serializeRequest(req: PricingRequest): string {
  const key = toStableKey(req);
  return JSON.stringify(key[1]);
}

/**
 * Main pricing hook with optimistic updates
 */
export function usePrice(req: PricingRequest) {
  const queryClient = useQueryClient();
  const key = toStableKey(req);
  const slowTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Main query
  const query = useQuery<AnnotatedPricingResponse>({
    queryKey: key,
    queryFn: async () => {
      const t0 = performance.now();

      // Show slow toast if takes too long
      const slowTimer = setTimeout(() => {
        pricingToasts.pricingSlow();
      }, 3000);
      slowTimerRef.current = slowTimer;

      try {
        const response = await fetchPrice(req);
        const dt = performance.now() - t0;

        clearTimeout(slowTimer);

        // Log telemetry
        if (response.from_cache) {
          telemetry.price_cache_hit({ dt, key, source: "network" });
        } else {
          telemetry.price_cache_miss({ dt, key, reason: "cold" });
        }

        // Annotate with request parameters for future optimistic calculations
        return mergeServerResponse(response, req);
      } catch (error: any) {
        clearTimeout(slowTimer);
        telemetry.price_error({
          message: error?.message || "Unknown error",
          key,
        });
        throw error;
      }
    },
    placeholderData: (previousData) => previousData, // Prevent flicker
    staleTime: 60_000, // Consider data fresh for 1 minute
    gcTime: 10 * 60_000, // Keep in cache for 10 minutes
    retry: 1,
  });

  /**
   * Apply optimistic update immediately
   * Shows instant feedback while server calculates
   */
  const applyOptimistic = useCallback(
    (nextReq: PricingRequest) => {
      const nextKey = toStableKey(nextReq);
      const prevData = queryClient.getQueryData<AnnotatedPricingResponse>(key);

      if (!prevData) {
        // No baseline - can't estimate optimistically
        return;
      }

      const estimate = optimisticEstimate(prevData, nextReq);

      if (estimate) {
        const confidence = estimateConfidence(prevData, nextReq);

        // Set optimistic data
        queryClient.setQueryData<AnnotatedPricingResponse>(nextKey, estimate);

        telemetry.price_optimistic_apply({
          confidence,
          key: nextKey,
          delta: estimate.total - prevData.total,
        });
      }
    },
    [key, queryClient],
  );

  /**
   * Reconcile with server
   * Fetches actual price and handles rollback if needed
   */
  const reconcile = useCallback(
    async (nextReq: PricingRequest) => {
      const nextKey = toStableKey(nextReq);
      const serialized = serializeRequest(nextReq);

      // Deduplicate in-flight requests
      if (inFlightRequests.has(serialized)) {
        return inFlightRequests.get(serialized);
      }

      const promise = (async () => {
        try {
          // Fetch actual price from server
          const serverResponse = await queryClient.fetchQuery({
            queryKey: nextKey,
            queryFn: () => fetchPrice(nextReq),
            staleTime: 60_000,
          });

          // Check if we need to rollback optimistic value
          const currentData =
            queryClient.getQueryData<AnnotatedPricingResponse>(nextKey);

          if (
            currentData &&
            currentData.pricing_hash === "optimistic" &&
            shouldRollback(serverResponse, currentData)
          ) {
            // Rollback - server disagrees significantly
            telemetry.price_optimistic_rollback({
              key: nextKey,
              optimisticTotal: currentData.total,
              serverTotal: serverResponse.total,
              deviation:
                Math.abs(serverResponse.total - currentData.total) /
                serverResponse.total,
            });

            // Update with server value
            const annotated = mergeServerResponse(serverResponse, nextReq);
            queryClient.setQueryData<AnnotatedPricingResponse>(
              nextKey,
              annotated,
            );

            // Optionally notify user
            pricingToasts.pricingRollback();
          } else if (currentData?.pricing_hash === "optimistic") {
            // Optimistic was close enough - just update annotations
            const annotated = mergeServerResponse(serverResponse, nextReq);
            queryClient.setQueryData<AnnotatedPricingResponse>(
              nextKey,
              annotated,
            );
          }

          return serverResponse;
        } catch (error: any) {
          telemetry.price_error({
            message: error?.message || "Reconciliation failed",
            key: nextKey,
          });

          pricingToasts.pricingFailed(error?.message);

          throw error;
        } finally {
          inFlightRequests.delete(serialized);
        }
      })();

      inFlightRequests.set(serialized, promise);
      return promise;
    },
    [queryClient],
  );

  /**
   * Combined update function
   * Applies optimistic immediately, then reconciles
   */
  const updatePrice = useCallback(
    (nextReq: PricingRequest) => {
      applyOptimistic(nextReq);
      return reconcile(nextReq);
    },
    [applyOptimistic, reconcile],
  );

  return {
    ...query,
    applyOptimistic,
    reconcile,
    updatePrice,
  };
}

/**
 * Invalidate all pricing queries when catalog version changes
 */
export function invalidateOnVersionChange(
  queryClient: QueryClient,
  newVersion: string,
) {
  queryClient.invalidateQueries({
    queryKey: [PRICING_QUERY_KEY],
    predicate: (query) => {
      const data = query.state.data as AnnotatedPricingResponse | undefined;
      return data?.version !== newVersion;
    },
  });
}

/**
 * Prefetch price for anticipated request
 * Useful for warming cache on hover or predicted actions
 */
export function usePrefetchPrice(queryClient: QueryClient) {
  return useCallback(
    (req: PricingRequest) => {
      const key = toStableKey(req);
      queryClient.prefetchQuery({
        queryKey: key,
        queryFn: () => fetchPrice(req),
        staleTime: 60_000,
      });
    },
    [queryClient],
  );
}
