/**
 * Dummy PostHog analytics module
 * Replace with actual PostHog implementation when ready
 */

type EventProperties = Record<string, unknown>;

export function trackEvent(
  eventName: string,
  properties?: EventProperties,
): void {
  // Stub implementation - logs to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics]", eventName, properties);
  }
}

export function identifyUser(userId: string, traits?: EventProperties): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics] Identify:", userId, traits);
  }
}

export function resetUser(): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics] Reset user");
  }
}
