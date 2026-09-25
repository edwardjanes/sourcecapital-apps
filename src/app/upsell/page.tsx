"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { deckCheckoutUrl, deckPrice, isOfferExpired } from "@/lib/whop";

const GREEN = "#03fb83";
const LOGO = "https://raw.githubusercontent.com/edwardjanes/source-capital/0147b27fad891686f67559992e43319411f07ba4/logo.png";
const COMMUNITY_PLAN_ID = process.env.NEXT_PUBLIC_WHOP_COMMUNITY_PLAN_ID ?? "plan_J7CPhtS9G5ffD";
// Must match what the plan above actually charges in Whop. Set
// NEXT_PUBLIC_WHOP_COMMUNITY_PRICE if the Whop price changes, so the copy
// can't drift from the real charge again.
const COMMUNITY_PRICE = process.env.NEXT_PUBLIC_WHOP_COMMUNITY_PRICE ?? "$29.99";

const REPORT_BULLETS = [
  "Slide-by-slide assessment of every page investors will see",
  "Your most damaging issue, named and explained",
  "The highest-leverage fixes, in priority order",
  "Full score breakdown across all 8 dimensions",
  "The bottom-line verdict an investor would reach",
];

const BULLETS = [
  "Weekly live Q&A sessions with active investors",
  "Peer review your deck with other founders raising right now",
  "Investor outreach templates, trackers & scripts",
  "Access to our vetted investor database (500+ contacts)",
  "Direct feedback from the Source Capital team",
  "Private founder community — no noise, no spam",
];

function UpsellInner() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("submission_id") ?? "";
  const reason = searchParams.get("reason") ?? "community"; // "community" or "free_limit"

  // For the free-limit variant we sell the full report for the deck they
  // already analysed, so we need that submission's age (early vs full price)
  // and whether they have already paid for it.
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [loadingSubmission, setLoadingSubmission] = useState(reason === "free_limit" && !!submissionId);

  useEffect(() => {
    if (reason !== "free_limit" || !submissionId) return;
    let cancelled = false;
    fetch(`/api/status/${submissionId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        setCreatedAt(data.created_at ?? null);
        setAlreadyPaid(!!data.paid);
      })
      .catch(() => { /* fall back to the early price */ })
      .finally(() => { if (!cancelled) setLoadingSubmission(false); });
    return () => { cancelled = true; };
  }, [reason, submissionId]);

  const expired = isOfferExpired(createdAt);
  const reportPrice = deckPrice(expired);
  const reportUrl = submissionId ? deckCheckoutUrl(submissionId, expired) : "";

  const thankYouUrl = submissionId
    ? `/thank-you?submission_id=${submissionId}`
    : "/thank-you";

  const declineUrl = reason === "free_limit" && submissionId
    ? `/results/${submissionId}`
    : thankYouUrl;

  const communityUrl = `https://whop.com/checkout/${COMMUNITY_PLAN_ID}/?${new URLSearchParams({
    ...(submissionId ? { "metadata[submission_id]": submissionId } : {}),
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sourcecapital.co.uk"}${thankYouUrl}`,
  }).toString()}`;

  // free_limit sells the one-time report plan; the community variant sells the
  // recurring membership. They must never share a URL again.
  const acceptUrl = reason === "free_limit"
    ? (alreadyPaid ? `/investment-score/results/${submissionId}` : reportUrl)
    : communityUrl;

  const handleAccept = () => {
    posthog.capture("upsell_accepted", {
      plan: reason === "free_limit" ? "deck_report" : COMMUNITY_PLAN_ID,
      price: reason === "free_limit" ? reportPrice : COMMUNITY_PRICE,
      expired: reason === "free_limit" ? expired : undefined,
    });
    window.location.href = acceptUrl;
  };

  const handleDecline = () => {
    posthog.capture("upsell_declined", { plan: COMMUNITY_PLAN_ID });
    window.location.href = declineUrl;
  };

  return (
    <main style={{
      minHeight: "100vh", background: "#0A0A0A", color: "#F8FAFC",
      display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif",
    }}>
      <style>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #111927", padding: "0 24px", flexShrink: 0 }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", height: "64px", display: "flex", alignItems: "center" }}>
          <img src={LOGO} alt="Source Capital" style={{ height: "30px", width: "auto" }} />
        </div>
      </nav>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: "680px", animation: "fadein 0.5s ease" }}>

          {/* Badge */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{
              display: "inline-block", padding: "5px 14px",
              background: reason === "free_limit" ? "rgba(249,115,22,0.1)" : "rgba(3,251,131,0.1)",
              border: reason === "free_limit" ? "1px solid rgba(249,115,22,0.25)" : "1px solid rgba(3,251,131,0.25)",
              borderRadius: "20px", fontSize: "12px", fontWeight: 600,
              color: reason === "free_limit" ? "#F59E0B" : GREEN, letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              {reason === "free_limit" ? "You've used your free analysis" : "One-Time Offer — For New Members Only"}
            </span>
          </div>

          {/* Heading */}
          <h1 style={{ fontSize: "32px", fontWeight: 800, textAlign: "center", marginBottom: "12px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
            {reason === "free_limit"
              ? "You've used your 1 free analysis."
              : "Your deck is scored."}
            <br />
            {reason === "free_limit"
              ? "Unlock your full report."
              : "Now let&apos;s get it funded."}
          </h1>
          <p style={{ textAlign: "center", fontSize: "16px", color: "#9CA3AF", marginBottom: "32px", lineHeight: 1.7 }}>
            {reason === "free_limit"
              ? "Get the slide-by-slide breakdown, your most damaging issue and the highest-leverage fixes for the deck you already scored. "
              : ""}
            Join the Raise Launchpad — a private community of founders actively raising, with weekly investor access and everything you need to close your round.
          </p>

          {/* Video — community pitch only */}
          {reason !== "free_limit" && <div style={{
            borderRadius: "14px", overflow: "hidden", marginBottom: "32px",
            border: "1px solid #1E1E1E", background: "#111",
            position: "relative", paddingTop: "56.25%",
          }}>
            <iframe
              src="https://www.loom.com/embed/8a70bff3e4274b9ab9fba88627e1d10c?autoplay=0&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true"
              frameBorder="0"
              allowFullScreen
              style={{
                position: "absolute", top: 0, left: 0,
                width: "100%", height: "100%",
              }}
            />
          </div>}

          {/* Bullets */}
          <div style={{
            background: "#111111", border: "1px solid #1E1E1E",
            borderRadius: "14px", padding: "24px 28px", marginBottom: "28px",
          }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
              {reason === "free_limit" ? "What you unlock" : "What's included"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {(reason === "free_limit" ? REPORT_BULLETS : BULLETS).map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{
                    width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
                    background: "rgba(3,251,131,0.1)", border: "1px solid rgba(3,251,131,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                      <path d="M1.5 4.5l2 2 4-4" stroke={GREEN} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: "14px", color: "#D1D5DB", lineHeight: 1.5 }}>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing + CTA */}
          <div style={{
            background: "#111111", border: `1px solid ${reason === "free_limit" ? "rgba(249,115,22,0.2)" : "rgba(3,251,131,0.2)"}`,
            borderRadius: "14px", padding: "28px", marginBottom: "16px", textAlign: "center",
          }}>
            {reason === "free_limit" && alreadyPaid ? (
              <p style={{ fontSize: "15px", color: "#D1D5DB", marginBottom: "20px" }}>
                You&apos;ve already unlocked this report.
              </p>
            ) : (
              // The price shown and the plan charged both come from `expired`
              // (free_limit) or COMMUNITY_PRICE (community), so the page can
              // never advertise a price the checkout doesn't charge.
              <>
              <p style={{ fontSize: "13px", color: "#4B5563", marginBottom: "6px" }}>
                {reason === "free_limit"
                  ? (expired ? "Full report — full price" : "Full report, early access price")
                  : "Join today for just"}
              </p>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "6px", marginBottom: "20px" }}>
                <span style={{ fontSize: "48px", fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                  {reason === "free_limit" ? reportPrice : COMMUNITY_PRICE}
                </span>
                <span style={{ fontSize: "16px", color: "#6B7280" }}>
                  {reason === "free_limit" ? "one-time" : "/month"}
                </span>
              </div>
              </>
            )}
            <button
              onClick={handleAccept}
              disabled={loadingSubmission}
              style={{
                width: "100%", padding: "16px",
                background: loadingSubmission ? "#2A2A2A" : GREEN,
                color: loadingSubmission ? "#6B7280" : "#000",
                border: "none", borderRadius: "10px",
                fontSize: "16px", fontWeight: 700,
                cursor: loadingSubmission ? "not-allowed" : "pointer", marginBottom: "12px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              {loadingSubmission
                ? "Loading…"
                : reason === "free_limit"
                  ? (alreadyPaid ? "View My Full Report" : `Unlock My Full Report — ${reportPrice}`)
                  : "Yes — Add Raise Launchpad Access"}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <p style={{ fontSize: "12px", color: "#4B5563" }}>
              {reason === "free_limit"
                ? (alreadyPaid ? "" : "One-time payment for this deck's full report. No subscription.")
                : `Recurring monthly subscription at ${COMMUNITY_PRICE}/month. Cancel any time. No lock-in.`}
            </p>
          </div>

          {/* Decline */}
          <div style={{ textAlign: "center" }}>
            <button
              onClick={handleDecline}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "13px", color: "#4B5563", textDecoration: "underline",
                textDecorationColor: "#2A2A2A",
              }}
            >
              {reason === "free_limit"
                ? "No thanks — view my existing analysis"
                : "No thanks — just take me to my report"}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}

export default function UpsellPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "32px", height: "32px", border: "3px solid #242424", borderTopColor: "#03fb83", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </main>
    }>
      <UpsellInner />
    </Suspense>
  );
}
