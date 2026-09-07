"use client";

import { DeckAnalysis } from "@/lib/deckPrompt";
import { useState } from "react";

const GREEN = "#03fb83";
const CARD_BG = "#161616";
const CARD_BORDER = "#242424";
const MUTED = "#6B7280";

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

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: "16px", padding: "28px", ...style }}>
      {children}
    </div>
  );
}

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

interface ReportLayoutProps {
  data: {
    id: string;
    business_name: string;
    score: number;
    verdict: string;
    verdict_type: "pass" | "review" | "flag";
    most_damaging_issue: string;
    best_asset: string;
    analysis_json: DeckAnalysis;
    created_at: string;
    deck_file_path: string | null;
  };
  hidePaywall?: boolean;
  showBackButton?: boolean;
  backUrl?: string;
}

export function ReportLayout({ data, hidePaywall = false, showBackButton = true, backUrl = "/admin/submissions" }: ReportLayoutProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "breakdown" | "slides">("overview");
  const [animated, setAnimated] = useState(false);

  const a = data.analysis_json;
  const verdictColor = data.verdict_type === "pass" ? GREEN : data.verdict_type === "review" ? "#FBBF24" : "#EF4444";
  const verdictLabel = data.verdict_type === "pass" ? "Investor Ready" : data.verdict_type === "review" ? "Needs Work" : "Not Ready";
  const slideCount = a.slideAssessments?.length ?? 0;
  const filename = data.deck_file_path ? data.deck_file_path.split("/").pop() : null;

  // Always treat as unlocked for admin
  const isUnlocked = hidePaywall ? true : (data as any).paid ?? false;

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", padding: "40px 24px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {showBackButton && (
          <div style={{ marginBottom: "40px" }}>
            <a href={backUrl} style={{ color: GREEN, textDecoration: "none", fontSize: "14px", marginBottom: "16px", display: "inline-block" }}>← Back</a>
            <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>{data.business_name}</h1>
            <p style={{ color: MUTED, fontSize: "14px" }}>
              Submission ID: {data.id} {filename && `• ${filename}`} {slideCount > 0 && `• ${slideCount} slides`}
            </p>
          </div>
        )}

        {/* Score Card */}
        <div style={{ marginBottom: "40px" }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: "32px", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "14px", color: MUTED, marginBottom: "8px", fontWeight: 600 }}>INVESTOR VIABILITY SCORE</div>
                <ScoreCircle score={Math.round(data.score)} animated={animated} />
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "14px", color: MUTED, marginBottom: "8px", fontWeight: 600 }}>VERDICT</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: verdictColor }}>{verdictLabel}</div>
                <p style={{ color: MUTED, fontSize: "12px", marginTop: "12px", lineHeight: 1.5 }}>{data.verdict}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div style={{ marginBottom: "32px", display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" }}>
          <Tab label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <Tab label="Breakdown" active={activeTab === "breakdown"} onClick={() => setActiveTab("breakdown")} />
          <Tab label="Slide by Slide" active={activeTab === "slides"} onClick={() => setActiveTab("slides")} />
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
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

            {a.drivingLowScore && a.drivingLowScore.length > 0 && (
              <Card>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>What&apos;s Holding It Back</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
                  {a.drivingLowScore.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "9px", color: "#EF4444", marginTop: "1px" }}>✕</span>
                      <p style={{ fontSize: "15px", color: "#9CA3AF", lineHeight: 1.7 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {a.genuinelyWorking && a.genuinelyWorking.length > 0 && (
              <Card>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "14px" }}>What&apos;s Genuinely Working</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {a.genuinelyWorking.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(3,251,131,0.12)", border: "1px solid rgba(3,251,131,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "9px", color: GREEN, marginTop: "1px" }}>✓</span>
                      <p style={{ fontSize: "15px", color: "#9CA3AF", lineHeight: 1.7 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Breakdown Tab */}
        {activeTab === "breakdown" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Card>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "22px" }}>Dimension Scores</h2>
              {a.dimensions?.map(d => <DimBar key={d.name} name={d.name} score={d.score} animated={animated} />)}
            </Card>
            <Card>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>Bottom Line</h2>
              <p style={{ fontSize: "16px", color: "#9CA3AF", lineHeight: 1.8 }}>{a.bottomLine}</p>
            </Card>
          </div>
        )}

        {/* Slide by Slide Tab */}
        {activeTab === "slides" && (
          <Card>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "18px" }}>Slide-by-Slide Feedback</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {a.slideAssessments?.map((s, i) => {
                const c = s.verdict === "Strong" ? { color: GREEN } : s.verdict === "Acceptable" ? { color: "#FBBF24" } : s.verdict === "Weak" ? { color: "#EF4444" } : { color: MUTED };
                return (
                  <div key={i} style={{ background: "#111", border: `1px solid ${CARD_BORDER}`, borderRadius: "10px", padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 600, color: "#E5E7EB" }}>{s.slide}</span>
                      <span style={{ padding: "2px 9px", background: c.color + "20", border: `1px solid ${c.color}40`, borderRadius: "99px", color: c.color, fontSize: "11px", fontWeight: 700 }}>{s.verdict}</span>
                    </div>
                    <p style={{ fontSize: "15px", color: "#9CA3AF", lineHeight: 1.7 }}>{s.assessment}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
