"use client";

import posthog from "posthog-js";

const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY || "phc_rb5Gbz6hJGqwbFm6P5XZRYqjAR6tWJVoThEae7PH7sPb";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const DEBUG_STORAGE_KEY = "gait-tracker-analytics-debug";
const APP_NAME = "gait-tracker";
const PROJECT_SLUG = "gait-pattern";

let initialized = false;

function isDebugEnabled() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const queryEnabled = params.get("analytics_debug") === "1";

  if (queryEnabled) {
    window.sessionStorage.setItem(DEBUG_STORAGE_KEY, "1");
  }

  return window.sessionStorage.getItem(DEBUG_STORAGE_KEY) === "1";
}

function eventName(name: string) {
  return `${APP_NAME}:${name}`;
}

function baseProperties() {
  return {
    app: APP_NAME,
    project_slug: PROJECT_SLUG,
    runtime: "web",
  };
}

export function initAnalytics() {
  if (initialized || typeof window === "undefined" || !POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: true,
    loaded: (instance) => {
      instance.register(baseProperties());
      if (isDebugEnabled()) {
        console.log("[analytics] initialized", {
          distinct_id: instance.get_distinct_id(),
          host: POSTHOG_HOST,
          app: APP_NAME,
        });
      }
    },
  });

  initialized = true;
}

export function captureEvent(name: string, properties: Record<string, unknown> = {}) {
  if (!initialized) return;

  const payload = { ...baseProperties(), ...properties };
  if (isDebugEnabled()) {
    console.log("[analytics]", eventName(name), payload);
  }

  posthog.capture(eventName(name), payload);
}

export function capturePageView(path: string) {
  captureEvent("page_view", { path });
}

export function identifyUser(userId: string, properties: Record<string, unknown> = {}) {
  if (!initialized) return;
  posthog.identify(userId, { ...baseProperties(), ...properties });
}

export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
}
