"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

const GREEN = "#03fb83";
const LOGO = "https://raw.githubusercontent.com/edwardjanes/source-capital/0147b27fad891686f67559992e43319411f07ba4/logo.png";

function ThankYouInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("submission_id");
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!unlocked) return;
    posthog.capture("upgrade_purchased", { submission_id: submissionId });
    // Take them to the report they just paid for; the confirmation above stays
    // on screen briefly so the purchase is acknowledged.
    const timer = setTimeout(() => router.push(`/investment-score/results/${submissionId}`), 1800);
    return () => clearTimeout(timer);
  }, [unlocked, submissionId, router]);

  // Poll until the webhook has marked the submission as paid
  useEffect(() => {
    if (!submissionId) { setChecking(false); return; }
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/status/${submissionId}`);
        const data = await res.json();
        if (data.paid) {
          setUnlocked(true);
          setChecking(false);
          clearInterval(interval);
        }
      } catch { /* ignore */ }
      if (attempts >= 20) { setChecking(false); clearInterval(interval); }
    }, 2000);
    return () => clearInterval(interval);
  }, [submissionId]);

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } } * { box-sizing: border-box; }`}</style>

      <div style={{ width: "100%", maxWidth: "480px", textAlign: "center" }}>
        <div style={{ marginBottom: "32px" }}>
          <img src={LOGO} alt="Source Capital" style={{ height: "30px", width: "auto" }} />
        </div>

        {/* Animated checkmark */}
        <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "rgba(3,251,131,0.12)", border: `2px solid rgba(3,251,131,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", animation: "pop 0.5s ease forwards" }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M8 18l7 7 13-13" stroke={GREEN} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "12px" }}>Payment confirmed</h1>
        <p style={{ fontSize: "16px", color: "#9CA3AF", lineHeight: 1.7, marginBottom: "32px" }}>
          Thank you for your purchase. Your full report is now unlocked — you&apos;ll also receive a confirmation email shortly.
        </p>

        {/* Status card */}
        <div style={{ background: "#161616", border: "1px solid #242424", borderRadius: "16px", padding: "24px", marginBottom: "28px" }}>
          {checking ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "center" }}>
              <div style={{ width: "18px", height: "18px", border: `2px solid #2A2A2A`, borderTopColor: GREEN, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
              <p style={{ fontSize: "14px", color: "#9CA3AF" }}>Confirming your payment...</p>
            </div>
          ) : unlocked ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "center" }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(3,251,131,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l3 3 4-4" stroke={GREEN} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <p style={{ fontSize: "14px", color: GREEN, fontWeight: 600 }}>Payment confirmed — opening your report…</p>
            </div>
          ) : (
            <p style={{ fontSize: "14px", color: "#9CA3AF" }}>Payment received. Your report will unlock within a few seconds.</p>
          )}
        </div>

        {submissionId && (
          <a
            href={`/investment-score/results/${submissionId}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 32px", background: GREEN, borderRadius: "10px", color: "#000", fontSize: "15px", fontWeight: 700, textDecoration: "none", marginBottom: "16px" }}
          >
            View Full Report
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7h9M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        )}

        <p style={{ fontSize: "12px", color: "#4B5563", marginTop: "16px" }}>
          A confirmation email has been sent to your inbox.
        </p>
      </div>
    </main>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "32px", height: "32px", border: `3px solid #242424`, borderTopColor: "#03fb83", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </main>
    }>
      <ThankYouInner />
    </Suspense>
  );
}
