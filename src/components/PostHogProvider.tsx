"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { capturePageView, initAnalytics } from "@/lib/analytics/posthog";

export function PostHogProvider() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    capturePageView(pathname);
  }, [pathname]);

  return null;
}
