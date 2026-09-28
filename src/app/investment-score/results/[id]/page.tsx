"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { DeckAnalysis, SlideAssessment } from "@/lib/deckPrompt";
import posthog from "posthog-js";
import { pixel } from "@/lib/fpixel";
import { DECK_EARLY_PRICE, DECK_FULL_PRICE, OFFER_WINDOW_MS, deckCheckoutUrl, isOfferExpired } from "@/lib/whop";

interface SubmissionResult {
  id: string;
  business_name: string;
  deck_file_path: string | null;
  created_at: string;
  status: string;
  score: number;
  verdict: string;
  verdict_type: "pass" | "review" | "flag";
  most_damaging_issue: string;
  best_asset: string;
  analysis_summary: string;
  analysis_json: DeckAnalysis;
  error_message?: string;
  paid: boolean;
}

const GREEN = "#03fb83";
const CARD_BG = "#161616";
const CARD_BORDER = "#242424";
const MUTED = "#6B7280";
const LOGO = "https://raw.githubusercontent.com/edwardjanes/source-capital/0147b27fad891686f67559992e43319411f07ba4/logo.png";

const checkoutUrl = (submissionId: string) => deckCheckoutUrl(submissionId, false);
const fullCheckoutUrl = (submissionId: string) => deckCheckoutUrl(submissionId, true);
const isExpired = (createdAt: string) => isOfferExpired(createdAt);

function captureCheckout(score?: number) {
  posthog.capture("checkout_initiated", { score });
  pixel.initiateCheckout();
}

// ── Score circle ──────────────────────────────────────────────
function ScoreCircle({ score, animated }: { score: number; animated: boolean }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score, 100) / 100;
  const offset = animated ? circ - pct * circ : circ;
  const color = score >= 85 ? GREEN : score >= 50 ? "#FBBF24" : "#EF4444";
  return (
    <div style={{ position: "relative", width: "136px", height: "136px", flexShrink: 0 }}>
      <svg width="136" height="136" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="68" cy="68" r={r} fill="none" stroke="#242424" strokeWidth="10" />
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: animated ? "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1) 0.2s" : "none" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "38px", fontWeight: 800, color: "#fff", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: "12px", color: MUTED, marginTop: "2px" }}>/ 100</span>
      </div>
    </div>
  );
}

// ── Tab button ─────────────────────────────────────────────────
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "9px 20px", borderRadius: "99px",
      border: active ? "none" : `1px solid ${CARD_BORDER}`,
      background: active ? GREEN : "transparent",
      color: active ? "#000" : MUTED,
      fontSize: "16px", fontWeight: active ? 700 : 500,
      cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s", flexShrink: 0,
    }}>
      {label}
    </button>
  );
}

// ── Content card ───────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: "16px", padding: "28px", ...style }}>
      {children}
    </div>
  );
}

// ── Dim bar ────────────────────────────────────────────────────
function DimBar({ name, score, animated }: { name: string; score: number; animated: boolean }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? GREEN : score >= 5 ? "#FBBF24" : "#EF4444";
  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "16px", color: "#E5E7EB" }}>{name}</span>
        <span style={{ fontSize: "16px", fontWeight: 700, color }}>{score}/10</span>
      </div>
      <div style={{ height: "6px", background: "#242424", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "99px",
          transition: animated ? "width 1.2s cubic-bezier(0.4,0,0.2,1) 0.3s" : "none" }} />
      </div>
    </div>
  );
}

// ── Locked overlay ─────────────────────────────────────────────
function LockedSection({ children, label = "Unlock to reveal", href }: { children: React.ReactNode; label?: string; href: string }) {
  return (
    <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden" }}>
      <div style={{ filter: "blur(6px)", userSelect: "none", pointerEvents: "none", opacity: 0.5 }}>
        {children}
      </div>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.75) 55%, rgba(10,10,10,0.97) 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
        padding: "32px",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(3,251,131,0.12)", border: `1px solid rgba(3,251,131,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2.5" y="7" width="11" height="8" rx="1.5" stroke={GREEN} strokeWidth="1.5"/>
              <path d="M5 7V5a3 3 0 016 0v2" stroke={GREEN} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>{label}</p>
          <p style={{ fontSize: "15px", color: MUTED, marginBottom: "16px" }}>Unlock the full report for $7</p>
          <a href={href} onClick={() => captureCheckout()} style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "10px 22px", background: GREEN, borderRadius: "8px",
            color: "#000", fontSize: "15px", fontWeight: 700, textDecoration: "none",
          }}>
            Show Me How to Fix This — $7
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Blurred preview (change 7) ─────────────────────────────────
// Shows top portion clearly, lower portion blurred with "Unlock" label
function BlurredPreview({ preview, full, href }: { preview: React.ReactNode; full: React.ReactNode; href: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Visible portion */}
      {preview}
      {/* Blurred remainder */}
      <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ filter: "blur(4px)", userSelect: "none", pointerEvents: "none", opacity: 0.55 }}>
          {full}
        </div>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0.6) 40%, rgba(10,10,10,0.96) 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
          padding: "28px",
        }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: MUTED, marginBottom: "10px", letterSpacing: "0.04em" }}>Unlock to view full breakdown</p>
            <a href={href} onClick={() => captureCheckout()} style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "10px 22px", background: GREEN, borderRadius: "8px",
              color: "#000", fontSize: "15px", fontWeight: 700, textDecoration: "none",
            }}>
              Show Me How to Fix This — $7
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── OVERVIEW TAB ───────────────────────────────────────────────
function OverviewTab({ a, paid, buyHref, fullBuyHref, createdAt, slideCount }: { a: DeckAnalysis; paid: boolean; buyHref: string; fullBuyHref: string; createdAt: string; slideCount: number }) {
  const firstPara = a.executiveSummary?.split("\n\n")[0] ?? a.executiveSummary ?? "";
  const fixes = (a as unknown as { highestLeverageFixes?: { fix: string; action: string; effort?: string }[] }).highestLeverageFixes ?? [];

  const fullContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Card>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "16px" }}>Overall Assessment</h2>
        {a.executiveSummary?.split("\n\n").map((p, i) => (
          <p key={i} style={{ fontSize: "16px", color: "#9CA3AF", lineHeight: 1.85, marginBottom: "14px" }}>{p}</p>
        ))}
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Card>
          <p style={{ fontSize: "10px", color: "#EF4444", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Most Damaging Issue</p>
          <p style={{ fontSize: "15px", color: "#D1D5DB", lineHeight: 1.7 }}>{a.mostDamagingIssue}</p>
        </Card>
        <Card>
          <p style={{ fontSize: "10px", color: GREEN, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Best Asset</p>
          <p style={{ fontSize: "15px", color: "#D1D5DB", lineHeight: 1.7 }}>{a.bestAsset}</p>
        </Card>
      </div>
      <Card>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>What&apos;s Holding It Back</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
          {a.drivingLowScore?.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "9px", color: "#EF4444", marginTop: "1px" }}>✕</span>
              <p style={{ fontSize: "15px", color: "#9CA3AF", lineHeight: 1.7 }}>{item}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "14px" }}>What&apos;s Genuinely Working</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {a.genuinelyWorking?.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(3,251,131,0.12)", border: "1px solid rgba(3,251,131,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "9px", color: GREEN, marginTop: "1px" }}>✓</span>
              <p style={{ fontSize: "15px", color: "#9CA3AF", lineHeight: 1.7 }}>{item}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Free preview */}
      {!paid && (
        <Card>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "14px" }}>Overall Assessment</h2>
          <p style={{ fontSize: "16px", color: "#9CA3AF", lineHeight: 1.85 }}>{firstPara}</p>
        </Card>
      )}

      {/* Change 4 — bridging statement */}
      {!paid && (
        <p style={{ textAlign: "center", fontSize: "15px", color: "#9CA3AF", lineHeight: 1.75, margin: "8px 0 4px" }}>
          You&apos;re a handful of specific fixes away from investor-ready. The full report tells you exactly what they are.
        </p>
      )}

      {/* Change 6 — testimonial */}
      {!paid && (
        <div style={{ background: "#111", border: `1px solid ${CARD_BORDER}`, borderRadius: "12px", padding: "20px 24px" }}>
          <p style={{ fontSize: "16px", color: "#D1D5DB", lineHeight: 1.8, marginBottom: "12px", fontStyle: "italic" }}>
            &ldquo;I restructured my deck based on this report. Had three investor meetings booked the following week.&rdquo;
          </p>
          <p style={{ fontSize: "12px", color: MUTED, fontWeight: 600 }}>— Jamie R., Founder, SaaS / Pre-Seed</p>
        </div>
      )}

      {/* Upsell banner — shown immediately after the free preview */}
      {!paid && createdAt && <UpsellBanner createdAt={createdAt} buyHref={buyHref} fullBuyHref={fullBuyHref} slideCount={slideCount} />}

      {/* Full content — locked or free */}
      {paid ? fullContent : (
        <LockedSection label="Full assessment, score drivers & strengths" href={buyHref}>
          {fullContent}
        </LockedSection>
      )}

      {/* Next 3 Actions */}
      {fixes.length > 0 && (
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "8px 0 14px" }}>Next {Math.min(fixes.length, 3)} Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {fixes.slice(0, 3).map((f, i) => (
              paid ? (
                <Card key={i} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(3,251,131,0.12)", border: `1px solid rgba(3,251,131,0.25)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "16px", fontWeight: 800, color: GREEN }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", gap: "12px", flexWrap: "wrap" }}>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>{f.fix}</p>
                      {f.effort && (
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "99px", background: "rgba(251,191,36,0.1)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.25)", flexShrink: 0 }}>
                          {f.effort} effort
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "15px", color: "#9CA3AF", lineHeight: 1.7 }}>{f.action}</p>
                  </div>
                </Card>
              ) : (
                <LockedSection key={i} label="Unlock to see action steps" href={buyHref}>
                  <Card style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(3,251,131,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "16px", fontWeight: 800, color: GREEN }}>{i + 1}</div>
                    <div>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>{f.fix}</p>
                      <p style={{ fontSize: "15px", color: "#9CA3AF", lineHeight: 1.7 }}>{f.action}</p>
                    </div>
                  </Card>
                </LockedSection>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── BREAKDOWN TAB ──────────────────────────────────────────────
function BreakdownTab({ a, animated, paid, buyHref }: { a: DeckAnalysis; animated: boolean; paid: boolean; buyHref: string }) {
  const dims = a.dimensions ?? [];
  const previewDims = dims.slice(0, 2);   // first 2 bars visible
  const remainingDims = dims.slice(2);     // rest blurred

  if (paid) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Card>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "22px" }}>Dimension Scores</h2>
          {dims.map(d => <DimBar key={d.name} name={d.name} score={d.score} animated={animated} />)}
        </Card>
        <Card>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>Bottom Line</h2>
          <p style={{ fontSize: "16px", color: "#9CA3AF", lineHeight: 1.8 }}>{a.bottomLine}</p>
        </Card>
      </div>
    );
  }

  return (
    <BlurredPreview
      href={buyHref}
      preview={
        <Card>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "22px" }}>Dimension Scores</h2>
          {previewDims.map(d => <DimBar key={d.name} name={d.name} score={d.score} animated={animated} />)}
        </Card>
      }
      full={
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Card>
            {remainingDims.map(d => <DimBar key={d.name} name={d.name} score={d.score} animated={false} />)}
          </Card>
          <Card>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>Bottom Line</h2>
            <p style={{ fontSize: "16px", color: "#9CA3AF", lineHeight: 1.8 }}>{a.bottomLine}</p>
          </Card>
        </div>
      }
    />
  );
}

// ── SLIDE BY SLIDE TAB ─────────────────────────────────────────
function SlideBySlideTab({ a, paid, buyHref }: { a: DeckAnalysis; paid: boolean; buyHref: string }) {
  const slides = a.slideAssessments ?? [];

  function verdictStyle(v: string) {
    switch (v) {
      case "Strong":     return { bg: "rgba(3,251,131,0.1)",  color: GREEN,      border: "rgba(3,251,131,0.25)" };
      case "Acceptable": return { bg: "rgba(251,191,36,0.1)", color: "#FBBF24",  border: "rgba(251,191,36,0.25)" };
      case "Weak":       return { bg: "rgba(239,68,68,0.1)",  color: "#EF4444",  border: "rgba(239,68,68,0.25)" };
      case "Cut":        return { bg: "rgba(239,68,68,0.12)", color: "#EF4444",  border: "rgba(239,68,68,0.3)" };
      default:           return { bg: "rgba(36,36,36,0.6)",   color: MUTED,      border: CARD_BORDER };
    }
  }

  function slideCard(s: SlideAssessment, i: number) {
    const c = verdictStyle(s.verdict);
    return (
      <div key={i} style={{ background: "#111", border: `1px solid ${CARD_BORDER}`, borderRadius: "10px", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "16px", fontWeight: 600, color: "#E5E7EB" }}>{s.slide}</span>
          <span style={{ padding: "2px 9px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: "99px", color: c.color, fontSize: "11px", fontWeight: 700 }}>{s.verdict}</span>
        </div>
        <p style={{ fontSize: "15px", color: "#9CA3AF", lineHeight: 1.7 }}>{s.assessment}</p>
      </div>
    );
  }

  if (paid) {
    return (
      <Card>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "18px" }}>Slide-by-Slide Feedback</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {slides.map((s, i) => slideCard(s, i))}
        </div>
      </Card>
    );
  }

  const previewSlides = slides.slice(0, Math.max(2, Math.floor(slides.length * 0.25)));
  const remainingSlides = slides.slice(previewSlides.length);

  return (
    <BlurredPreview
      href={buyHref}
      preview={
        <Card>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "18px" }}>Slide-by-Slide Feedback</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {previewSlides.map((s, i) => slideCard(s, i))}
          </div>
        </Card>
      }
      full={
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {remainingSlides.map((s, i) => slideCard(s, i + previewSlides.length))}
          </div>
        </Card>
      }
    />
  );
}

// ── Countdown timer ────────────────────────────────────────────
const EARLY_PRICE = DECK_EARLY_PRICE;
const FULL_PRICE = DECK_FULL_PRICE;

function useCountdown(createdAt: string) {
  const expiry = new Date(createdAt).getTime() + OFFER_WINDOW_MS;
  const [remaining, setRemaining] = useState(() => Math.max(0, expiry - Date.now()));

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      const left = Math.max(0, expiry - Date.now());
      setRemaining(left);
      if (left === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiry, remaining]);

  const expired = remaining <= 0;
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return { expired, formatted, price: expired ? FULL_PRICE : EARLY_PRICE };
}

function CountdownBanner({ createdAt, href, fullHref }: { createdAt: string; href: string; fullHref: string }) {
  const { expired, formatted, price } = useCountdown(createdAt);
  const activeHref = expired ? fullHref : href;
  return (
    <div style={{
      background: expired ? "rgba(239,68,68,0.08)" : "rgba(3,251,131,0.06)",
      border: `1px solid ${expired ? "rgba(239,68,68,0.25)" : "rgba(3,251,131,0.2)"}`,
      borderRadius: "12px", padding: "14px 20px", marginBottom: "16px",
      display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke={expired ? "#EF4444" : GREEN} strokeWidth="1.4"/>
          <path d="M8 5v3.5l2 1.5" stroke={expired ? "#EF4444" : GREEN} strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <div>
          {expired ? (
            <p style={{ fontSize: "15px", fontWeight: 600, color: "#EF4444" }}>Early access offer expired</p>
          ) : (
            <p style={{ fontSize: "15px", fontWeight: 600, color: "#fff" }}>
              Early access price expires in{" "}
              <span style={{ fontFamily: "monospace", color: GREEN, fontWeight: 800 }}>{formatted}</span>
            </p>
          )}
          <p style={{ fontSize: "12px", color: MUTED, marginTop: "2px" }}>
            {expired ? `Full price now applies — ${FULL_PRICE}` : "Early access pricing — closes when your session ends"}
          </p>
        </div>
      </div>
      <a href={activeHref} onClick={() => captureCheckout()} style={{
        padding: "8px 18px", borderRadius: "8px", background: expired ? "#EF4444" : GREEN,
        color: "#000", fontSize: "15px", fontWeight: 700, textDecoration: "none", flexShrink: 0,
      }}>
        Fix My Deck — {price}
      </a>
    </div>
  );
}

// ── Upsell banner ──────────────────────────────────────────────
function UpsellBanner({ createdAt, buyHref, fullBuyHref, slideCount }: { createdAt: string; buyHref: string; fullBuyHref: string; slideCount: number }) {
  const { expired, formatted, price } = useCountdown(createdAt);
  const activeHref = expired ? fullBuyHref : buyHref;
  return (
    <div style={{ background: CARD_BG, border: `1px solid rgba(3,251,131,0.2)`, borderRadius: "16px", padding: "32px", textAlign: "center", marginTop: "20px" }}>
      <p style={{ fontSize: "11px", color: GREEN, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Full Implementation Plan</p>
      <h3 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "10px" }}>
        {slideCount > 0 ? `${slideCount} slides reviewed.` : "Analysis complete."} Now fix them.
      </h3>
      <p style={{ fontSize: "16px", color: "#9CA3AF", lineHeight: 1.8, maxWidth: "480px", margin: "0 auto 16px" }}>
        Unlock the full report: slide-by-slide feedback, your most damaging issue, highest-leverage fixes, and the bottom-line truth investors will see.
      </p>
      {!expired && (
        <p style={{ fontSize: "15px", color: MUTED, marginBottom: "20px" }}>
          Early price of <span style={{ color: GREEN, fontWeight: 700 }}>{EARLY_PRICE}</span> expires in{" "}
          <span style={{ fontFamily: "monospace", color: "#fff", fontWeight: 700 }}>{formatted}</span>
          {" "}— then {FULL_PRICE}
        </p>
      )}
      <a href={activeHref} onClick={() => captureCheckout()} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px", background: GREEN, borderRadius: "10px", color: "#000", fontSize: "15px", fontWeight: 700, textDecoration: "none" }}>
        Show Me How to Fix This — {price}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7h9M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </a>
      <p style={{ fontSize: "11px", color: MUTED, marginTop: "12px", opacity: 0.6 }}>Instant access · Full PDF report · Prioritised fix checklist</p>
    </div>
  );
}

// ── Nav ────────────────────────────────────────────────────────
function Nav() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
  }, [supabase]);

  return (
    <nav style={{ borderBottom: "1px solid #1A1A1A", height: "56px", marginBottom: "32px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 32px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <img src={LOGO} alt="Source Capital" style={{ height: "26px", width: "auto" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        {loggedIn && (
          <a href="/dashboard" style={{ fontSize: "16px", color: MUTED, textDecoration: "none", fontWeight: 500 }}>Dashboard</a>
        )}
        {[
          { label: "Pricing", href: "https://sourcecapital.co.uk/pricing" },
          { label: "About", href: "https://sourcecapital.co.uk/about" },
          { label: "Contact", href: "https://sourcecapital.co.uk/contact" },
        ].map(({ label, href }) => (
          <a key={label} href={href} style={{ fontSize: "16px", color: MUTED, textDecoration: "none", fontWeight: 500 }}>{label}</a>
        ))}
        {loggedIn && (
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 16px", borderRadius: "99px", border: `1px solid ${CARD_BORDER}`, background: "transparent", color: "#fff", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 12H3a1 1 0 01-1-1V3a1 1 0 011-1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Logout
          </button>
        )}
      </div>
      </div>
    </nav>
  );
}

// ── Page inner ─────────────────────────────────────────────────
function ResultsPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const hasError = searchParams.get("error") === "1";
  const [data, setData] = useState<SubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [animated, setAnimated] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [buyHref, setBuyHref] = useState("");
  const [fullBuyHref, setFullBuyHref] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/status/${id}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
        setBuyHref(checkoutUrl(d.id));
        setFullBuyHref(fullCheckoutUrl(d.id));
        setCreatedAt(d.created_at);
        setTimeout(() => setAnimated(true), 100);
        posthog.capture("results_viewed", { score: d.score, verdict_type: d.verdict_type, paid: d.paid });
        if (!d.paid) {
          posthog.capture("upgrade_viewed", { submission_id: d.id, score: d.score });
        }
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Derive the active href — switches to $97 plan once 24hr window expires
  const activeHref = createdAt && isExpired(createdAt) ? fullBuyHref : buyHref;

  if (loading) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "36px", height: "36px", border: "3px solid #242424", borderTopColor: GREEN, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
        <p style={{ color: MUTED, fontSize: "16px" }}>Loading your results...</p>
      </div>
    </div>
  );

  if (hasError || !data || data.status === "error") return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ maxWidth: "440px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>Analysis Failed</h1>
        <p style={{ fontSize: "16px", color: MUTED, marginBottom: "24px" }}>{data?.error_message || "Something went wrong. Please try again."}</p>
        <a href="/dashboard" style={{ display: "inline-block", padding: "11px 24px", background: GREEN, borderRadius: "8px", color: "#000", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>Back to Dashboard</a>
      </div>
    </div>
  );

  const a = data.analysis_json;
  if (!a) return null;

  const paid = data.paid ?? false;
  const slideCount = a.slideAssessments?.length ?? 0;
  const filename = data.deck_file_path ? data.deck_file_path.split("/").pop() : null;

  const verdictColor = data.verdict_type === "pass" ? GREEN : data.verdict_type === "review" ? "#FBBF24" : "#EF4444";
  const verdictLabel = data.verdict_type === "pass" ? "Investor Ready" : data.verdict_type === "review" ? "Needs Work" : "Not Ready";

  // Investor sentiment band
  const sentiment = data.score >= 85
    ? { label: "Likely to get an investor reply", detail: "Provided the targeting and messaging is good", color: GREEN, bg: "rgba(3,251,131,0.08)", border: "rgba(3,251,131,0.25)" }
    : data.score >= 50
    ? { label: "Possibility to get a response", detail: "Based on messaging and investor targeting", color: "#FBBF24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)" }
    : { label: "Unlikely to get a response", detail: "Significant improvements required before approaching investors", color: "#EF4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)" };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 32px 80px" }}>

      {/* ── HERO SCORE CARD ── */}
      <Card style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>

          {/* Left: score circle + title */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "24px", flexWrap: "wrap", flex: "0 0 auto" }}>
            <ScoreCircle score={data.score} animated={animated} />
            <div style={{ minWidth: "180px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#fff" }}>Investor Readiness Score</h1>
              </div>
              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, marginBottom: "10px",
                background: `${verdictColor}18`, color: verdictColor, border: `1px solid ${verdictColor}40` }}>
                {verdictLabel}
              </span>
              {filename && <p style={{ fontSize: "13px", color: MUTED, marginBottom: "3px" }}>{filename}</p>}
              {slideCount > 0 && <p style={{ fontSize: "13px", color: MUTED }}>{slideCount} slides analysed</p>}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", background: CARD_BORDER, alignSelf: "stretch", flexShrink: 0 }} />

          {/* Right: dimension bars */}
          {a.dimensions && a.dimensions.length > 0 && (
            <div style={{ flex: 1, minWidth: "280px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Dimension Breakdown</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                {a.dimensions.map(d => {
                  const pct = (d.score / 10) * 100;
                  const color = d.score >= 7 ? GREEN : d.score >= 5 ? "#FBBF24" : "#EF4444";
                  return (
                    <div key={d.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                        <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{d.name}</span>
                        <span style={{ fontSize: "12px", fontWeight: 700, color }}>{d.score}/10</span>
                      </div>
                      <div style={{ height: "4px", background: "#242424", borderRadius: "99px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "99px",
                          transition: animated ? "width 1.2s cubic-bezier(0.4,0,0.2,1) 0.3s" : "none" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {data.verdict && (
          <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: `1px solid ${CARD_BORDER}` }}>
            <p style={{ fontSize: "16px", color: "#9CA3AF", lineHeight: 1.75 }}>{data.verdict}</p>
          </div>
        )}
      </Card>

      {/* ── INVESTOR RESPONSE RATING HEADLINE ── */}
      <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>Investor Response Rating</h2>

      {/* ── INVESTOR SENTIMENT BAND ── */}
      <div style={{ background: sentiment.bg, border: `1px solid ${sentiment.border}`, borderRadius: "12px", padding: "16px 20px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: sentiment.color, flexShrink: 0 }} />
              <p style={{ fontSize: "16px", fontWeight: 700, color: sentiment.color }}>{sentiment.label}</p>
            </div>
            <p style={{ fontSize: "15px", color: MUTED, paddingLeft: "16px" }}>{sentiment.detail}</p>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center", flexShrink: 0 }}>
            {[49, 84, 100].map((threshold, i) => {
              const bands = [
                { label: "<50%", active: data.score < 50, color: "#EF4444" },
                { label: "50–84%", active: data.score >= 50 && data.score <= 84, color: "#FBBF24" },
                { label: ">84%", active: data.score > 84, color: GREEN },
              ];
              const band = bands[i];
              return (
                <div key={threshold} style={{
                  padding: "4px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 600,
                  background: band.active ? `${band.color}20` : "rgba(255,255,255,0.04)",
                  color: band.active ? band.color : "#4B5563",
                  border: `1px solid ${band.active ? `${band.color}40` : "transparent"}`,
                }}>{band.label}</div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RAISE READINESS MESSAGE ── */}
      {!paid && (
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: "12px", padding: "16px 20px", marginBottom: "12px" }}>
          <p style={{ fontSize: "15px", color: "#9CA3AF", lineHeight: 1.75 }}>
            <span style={{ color: "#fff", fontWeight: 600 }}>To run a successful raise you need a score above 90%.</span>
            {data.score >= 90
              ? " Your deck is in strong shape — focus on investor targeting and messaging to maximise response rates."
              : ` Your current score is ${data.score}%. Make the improvements identified in the full report to close the gap and significantly increase your chances of getting investor meetings.`}
          </p>
        </div>
      )}

      {/* ── TRUST LINE ── */}
      <p style={{ textAlign: "center", fontSize: "12px", color: MUTED, opacity: 0.6, marginBottom: "12px" }}>
        Built on 500+ investor-reviewed decks — across pre-seed to Series A
      </p>

      {/* ── COUNTDOWN BANNER ── */}
      {!paid && createdAt && <CountdownBanner createdAt={createdAt} href={buyHref} fullHref={fullBuyHref} />}

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {["Overview", "Breakdown", "Slide by Slide"].map(t => (
          <Tab key={t} label={t} active={activeTab === t} onClick={() => setActiveTab(t)} />
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      {activeTab === "Overview" && <OverviewTab a={a} paid={paid} buyHref={activeHref} fullBuyHref={fullBuyHref} createdAt={createdAt} slideCount={slideCount} />}
      {activeTab === "Breakdown" && <BreakdownTab a={a} animated={animated} paid={paid} buyHref={activeHref} />}
      {activeTab === "Slide by Slide" && <SlideBySlideTab a={a} paid={paid} buyHref={activeHref} />}

    </div>
  );
}

export default function ResultsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; } a { text-decoration: none; }`}</style>
      <Nav />
      <Suspense fallback={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={{ width: "36px", height: "36px", border: `3px solid #242424`, borderTopColor: GREEN, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      }>
        <ResultsPageInner />
      </Suspense>
    </main>
  );
}
