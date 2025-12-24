/**
 * useFinishChain Hook
 * Manages finish chain state and operations
 */

import { useState, useEffect, useCallback } from "react";
import {
  FinishOperation,
  FinishChain,
  ChainValidationError,
} from "../types/finish-chain";

interface UseFinishChainOptions {
  quoteId: string;
  lineId: string;
  process?: string;
}

export function useFinishChain({
  quoteId,
  lineId,
  process,
}: UseFinishChainOptions) {
  const [operations, setOperations] = useState<FinishOperation[]>([]);
  const [chain, setChain] = useState<FinishChain | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    ChainValidationError[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available operations
  const fetchOperations = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (process) query.set("process", process);
      query.set("active", "true");

      const res = await fetch(`/api/finishes?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch operations");

      const data = await res.json();
      setOperations(data.operations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [process]);

  // Fetch existing chain
  const fetchChain = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/finishes/quotes/${quoteId}/lines/${lineId}/finish-chain`,
      );
      if (!res.ok) throw new Error("Failed to fetch chain");

      const data = await res.json();
      setChain(data.chain);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [quoteId, lineId]);

  // Validate chain
  const validateChain = useCallback(
    async (
      steps: Array<{ operation_code: string; params?: Record<string, any> }>,
    ) => {
      try {
        const res = await fetch("/api/finishes/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ steps }),
        });
        if (!res.ok) throw new Error("Failed to validate chain");

        const data = await res.json();
        setValidationErrors(data.errors || []);
        return data.valid;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        return false;
      }
    },
    [],
  );

  // Update chain
  const updateChain = useCallback(
    async (
      steps: Array<{ operation_code: string; params?: Record<string, any> }>,
      context: {
        area_m2: number;
        volume_cm3: number;
        qty: number;
        material: string;
        region: string;
        [key: string]: any;
      },
    ) => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/finishes/quotes/${quoteId}/lines/${lineId}/finish-chain`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ steps, context }),
          },
        );
        if (!res.ok) throw new Error("Failed to update chain");

        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setChain(data.chain);
        setValidationErrors([]);
        return data.chain;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [quoteId, lineId],
  );

  // Delete chain
  const deleteChain = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/finishes/quotes/${quoteId}/lines/${lineId}/finish-chain`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("Failed to delete chain");

      setChain(null);
      setValidationErrors([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [quoteId, lineId]);

  useEffect(() => {
    fetchOperations();
    fetchChain();
  }, [fetchOperations, fetchChain]);

  return {
    operations,
    chain,
    validationErrors,
    loading,
    error,
    validateChain,
    updateChain,
    deleteChain,
    refetch: () => {
      fetchOperations();
      fetchChain();
    },
  };
}
