/**
 * Step 13: Telemetry Infrastructure
 * Tracks pricing performance, cache efficiency, and errors
 */

export interface TelemetryEvent {
  timestamp: number;
  [key: string]: any;
}

export interface PriceCacheHitMeta {
  dt: number; // Time taken in milliseconds
  key: any; // Cache key
  source?: "memory" | "disk" | "network";
}

export interface PriceCacheMissMeta {
  dt: number;
  key: any;
  reason?: "cold" | "expired" | "invalidated";
}

export interface PriceOptimisticApplyMeta {
  confidence: number; // 0-1 confidence score
  key: any;
  delta: number; // Estimated price delta
}

export interface PriceOptimisticRollbackMeta {
  key: any;
  optimisticTotal: number;
  serverTotal: number;
  deviation: number; // Percentage difference
}

export interface PriceErrorMeta {
  message: string;
  key?: any;
  statusCode?: number;
  retryCount?: number;
}

/**
 * Telemetry collector
 * In production, this would send to your analytics platform
 */
class Telemetry {
  private events: TelemetryEvent[] = [];
  private maxEvents = 1000;

  /**
   * Track a cache hit
   */
  price_cache_hit(meta: PriceCacheHitMeta): void {
    this.logEvent("price_cache_hit", meta);

    if (meta.dt < 50) {
      console.debug("✅ Fast cache hit", `${meta.dt}ms`);
    }
  }

  /**
   * Track a cache miss
   */
  price_cache_miss(meta: PriceCacheMissMeta): void {
    this.logEvent("price_cache_miss", meta);
    console.info("⚠️ Cache miss", meta.reason, `${meta.dt}ms`);
  }

  /**
   * Track optimistic price application
   */
  price_optimistic_apply(meta: PriceOptimisticApplyMeta): void {
    this.logEvent("price_optimistic_apply", meta);
    console.debug(
      "⚡ Optimistic update applied",
      `confidence: ${(meta.confidence * 100).toFixed(0)}%`,
    );
  }

  /**
   * Track optimistic rollback (server disagreed significantly)
   */
  price_optimistic_rollback(meta: PriceOptimisticRollbackMeta): void {
    this.logEvent("price_optimistic_rollback", meta);
    console.warn(
      "🔄 Optimistic rollback",
      `deviation: ${(meta.deviation * 100).toFixed(1)}%`,
      { optimistic: meta.optimisticTotal, server: meta.serverTotal },
    );
  }

  /**
   * Track pricing errors
   */
  price_error(meta: PriceErrorMeta): void {
    this.logEvent("price_error", meta);
    console.error("❌ Pricing error", meta.message, meta);
  }

  /**
   * Track general pricing metric
   */
  price_metric(name: string, value: number, meta?: Record<string, any>): void {
    this.logEvent("price_metric", { name, value, ...meta });
  }

  /**
   * Internal event logger
   */
  private logEvent(eventName: string, data: any): void {
    const event: TelemetryEvent = {
      timestamp: Date.now(),
      event: eventName,
      ...data,
    };

    this.events.push(event);

    // Limit memory usage
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // In production, send to analytics
    this.sendToAnalytics(event);
  }

  /**
   * Send event to analytics platform
   * TODO: Implement actual analytics integration
   */
  // eslint-disable-next-line class-methods-use-this
  private sendToAnalytics(_event: TelemetryEvent): void {
    // Example integrations:
    // - Google Analytics: gtag('event', event.event, event);
    // - Mixpanel: mixpanel.track(event.event, event);
    // - Custom: fetch('/api/analytics', { method: 'POST', body: JSON.stringify(event) });

    // For now, just log in development
    if (process.env.NODE_ENV === "development") {
      // Already logged above
    }
  }

  /**
   * Get recent events for debugging
   */
  getRecentEvents(count: number = 50): TelemetryEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Calculate cache hit rate
   */
  getCacheHitRate(windowMs: number = 60000): number {
    const cutoff = Date.now() - windowMs;
    const recent = this.events.filter((e) => e.timestamp > cutoff);

    const hits = recent.filter((e) => e.event === "price_cache_hit").length;
    const misses = recent.filter((e) => e.event === "price_cache_miss").length;
    const total = hits + misses;

    return total > 0 ? hits / total : 0;
  }

  /**
   * Calculate optimistic rollback rate
   */
  getRollbackRate(windowMs: number = 60000): number {
    const cutoff = Date.now() - windowMs;
    const recent = this.events.filter((e) => e.timestamp > cutoff);

    const applies = recent.filter(
      (e) => e.event === "price_optimistic_apply",
    ).length;
    const rollbacks = recent.filter(
      (e) => e.event === "price_optimistic_rollback",
    ).length;

    return applies > 0 ? rollbacks / applies : 0;
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }
}

// Singleton instance
export const telemetry = new Telemetry();

// Export for testing
export { Telemetry };
