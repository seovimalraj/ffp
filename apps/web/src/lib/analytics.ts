// Analytics tracking utility
export interface AnalyticsEvent {
  event_type: string;
  quote_id?: string;
  organization_id?: string;
  properties?: Record<string, any>;
  created_at?: string;
}

export class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private events: AnalyticsEvent[] = [];
  private isInitialized = false;

  private constructor() {}

  static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  async initialize() {
    if (this.isInitialized) return;
    if (typeof window === "undefined") return;

    // Load any existing session data
    const sessionData = window.localStorage.getItem("analytics_session");
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        this.events = parsed.events || [];
      } catch {
        console.warn("Failed to parse analytics session data");
      }
    }

    this.isInitialized = true;
  }

  async trackEvent(event: Omit<AnalyticsEvent, "created_at">) {
    const fullEvent: AnalyticsEvent = {
      ...event,
      created_at: new Date().toISOString(),
    };

    this.events.push(fullEvent);

    // Store in localStorage for persistence
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "analytics_session",
        JSON.stringify({
          events: this.events.slice(-50), // Keep last 50 events
        }),
      );
    }

    // Send to server
    try {
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullEvent),
      });
    } catch (error) {
      console.warn("Failed to send analytics event:", error);
    }
  }

  // Checkout funnel events
  async trackCheckoutStarted(
    quoteId: string,
    properties?: Record<string, any>,
  ) {
    await this.trackEvent({
      event_type: "checkout_started",
      quote_id: quoteId,
      properties: {
        ...properties,
        step: "checkout_initiated",
      },
    });
  }

  async trackCheckoutStep(
    quoteId: string,
    step: string,
    properties?: Record<string, any>,
  ) {
    await this.trackEvent({
      event_type: "checkout_step_completed",
      quote_id: quoteId,
      properties: {
        ...properties,
        step,
      },
    });
  }

  async trackPaymentSucceeded(
    quoteId: string,
    orderId: string,
    properties?: Record<string, any>,
  ) {
    await this.trackEvent({
      event_type: "payment_succeeded",
      quote_id: quoteId,
      properties: {
        ...properties,
        order_id: orderId,
      },
    });
  }

  async trackOrderCreated(
    quoteId: string,
    orderId: string,
    properties?: Record<string, any>,
  ) {
    await this.trackEvent({
      event_type: "order_created",
      quote_id: quoteId,
      properties: {
        ...properties,
        order_id: orderId,
      },
    });
  }

  async trackCheckoutAbandoned(
    quoteId: string,
    step: string,
    properties?: Record<string, any>,
  ) {
    await this.trackEvent({
      event_type: "checkout_abandoned",
      quote_id: quoteId,
      properties: {
        ...properties,
        step,
        abandoned_at: new Date().toISOString(),
      },
    });
  }

  // Get events for debugging
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  // Clear events (for testing)
  clearEvents() {
    this.events = [];
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("analytics_session");
    }
  }
}

// Export singleton instance
export const analytics = AnalyticsTracker.getInstance();
