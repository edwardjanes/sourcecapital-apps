"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: "https://us.i.posthog.com",
      capture_pageview: false, // manual below
      capture_pageleave: true,
      // Share the distinct_id cookie across app.sourcecapital.co.uk and
      // sourcecapital.co.uk (same root domain) so a visitor who arrives
      // from the marketing homepage is tracked as one person, not two --
      // required for the homepage-to-purchase funnel to stitch together.
      cross_subdomain_cookie: true,
    });
  }, []);

  useEffect(() => {
    if (!pathname) return;
    let url = window.location.origin + pathname;
    if (searchParams.toString()) url += `?${searchParams.toString()}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}
