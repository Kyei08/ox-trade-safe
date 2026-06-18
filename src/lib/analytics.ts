type EventProperties = Record<string, string | number | boolean | null | undefined>;

const ANALYTICS_KEY = "ox_analytics_events";

function isDev() {
  return import.meta.env.DEV;
}

/**
 * Track a user event.
 * In development, logs to the console.
 * In production, stores in a lightweight local queue that can be flushed
 * to a real analytics provider later (e.g. GA4, Mixpanel, PostHog).
 */
export function trackEvent(eventName: string, properties?: EventProperties) {
  const payload = {
    event: eventName,
    properties: properties || {},
    timestamp: new Date().toISOString(),
    path: typeof window !== "undefined" ? window.location.pathname : "",
  };

  if (isDev()) {
    // eslint-disable-next-line no-console
    console.log("[Analytics]", payload);
  }

  // Persist events locally so they can be reviewed or batched later.
  try {
    const existing = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
    existing.push(payload);
    // Keep a rolling window of the last 500 events to avoid unbounded growth.
    if (existing.length > 500) existing.shift();
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(existing));
  } catch {
    // Ignore localStorage errors (e.g. private mode, quota exceeded).
  }
}
