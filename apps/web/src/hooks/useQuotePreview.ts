"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { MultiPartQuotePreviewRequest, MultiPartQuotePreviewResponse } from '@cnc-quote/shared';

interface UseQuotePreviewOptions {
  debounceMs?: number;
  enabled?: boolean;
  baseUrl?: string; // can be '' for same origin
}

interface UseQuotePreviewReturn {
  preview?: MultiPartQuotePreviewResponse;
  loading: boolean;
  error?: string;
  trigger: (parts: MultiPartQuotePreviewRequest['parts'], currency?: string) => void;
  lastRequestedAt?: string;
}

export function useQuotePreview(opts: UseQuotePreviewOptions = {}): UseQuotePreviewReturn {
  const { debounceMs = 400, enabled = true, baseUrl = '' } = opts;
  const [preview, setPreview] = useState<MultiPartQuotePreviewResponse | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRef = useRef<{ parts: MultiPartQuotePreviewRequest['parts']; currency?: string } | null>(null);
  const lastRequestedAtRef = useRef<string | undefined>(undefined);

  const execute = useCallback(async () => {
    if (!enabled) return;
    const pending = pendingRef.current;
    if (!pending) return;
    setLoading(true);
    setError(undefined);
    const body: MultiPartQuotePreviewRequest = {
      currency: pending.currency || 'USD',
      parts: pending.parts,
    };
    try {
      // NOTE(Future): Add AbortController to cancel in-flight preview if a newer one supersedes it.
      // NOTE(Future): Add ETag / If-None-Match support once backend caches common part configurations.
      const res = await fetch(`${baseUrl}/api/quotes/preview-multipart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPreview(data);
      lastRequestedAtRef.current = new Date().toISOString();
    } catch (e: any) {
      setError(e.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, enabled]);

  const trigger = useCallback((parts: MultiPartQuotePreviewRequest['parts'], currency?: string) => {
    if (!enabled) return;
    // NOTE(Future): Compute a stable hash of (parts,currency) and skip scheduling if unchanged.
    // NOTE(Future): Optionally short-circuit if realtime pricing service already delivered equivalent lines.
    pendingRef.current = { parts, currency };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => execute(), debounceMs);
  }, [debounceMs, execute, enabled]);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { preview, loading, error, trigger, lastRequestedAt: lastRequestedAtRef.current };
}

export default useQuotePreview;
