"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { C, FONT_SANS } from "@/lib/theme";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface Snapshot {
  id: string;
  label: string | null;
  created_at: string;
  is_current: boolean;
}

interface Company {
  id: string;
  name: string;
  industry: string | null;
  stage: string;
  report_status: "draft" | "ready" | "archived";
  updated_at: string;
  snapshots: Snapshot[];
}

const STATUS_LABEL: Record<Company["report_status"], string> = {
  draft: "Draft",
  ready: "Ready",
  archived: "Archived",
};

const STATUS_COLOR: Record<Company["report_status"], string> = {
  draft: "#f59e0b",
  ready: "#10b981",
  archived: "#6b7280",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardClient({
  user,
  companies,
}: {
  user: User;
  companies: Company[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleNewValuation() {
    try {
      const response = await fetch("/companies/new", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        console.error("Create company error:", data);
        alert(`Error: ${data.error}`);
        return;
      }
      if (data.redirect) {
        router.push(data.redirect);
      }
    } catch (err) {
      console.error("Create company failed:", err);
      alert("Failed to create company. Check console.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: FONT_SANS,
      }}
    >
      {/* Nav */}
      <nav
        style={{
          background: C.nav,
          borderBottom: `1px solid ${C.border}`,
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 700 }}>Valuation Engine</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            background: "transparent",
            color: C.accent,
            border: `1px solid ${C.accent}`,
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontFamily: FONT_SANS,
          }}
        >
          Logout
        </button>
      </nav>

      {/* Main */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "32px",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
              Welcome, {user.email}
            </h2>
            <p style={{ color: C.textMuted, fontSize: "14px" }}>
              Create and manage company valuations
            </p>
          </div>

          <button
            onClick={handleNewValuation}
            style={{
              padding: "12px 24px",
              background: C.accent,
              color: "#000",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: FONT_SANS,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + New Valuation
          </button>
        </div>

        {companies.length === 0 ? (
          <div
            style={{
              padding: "32px",
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: "12px",
              textAlign: "center",
              color: C.textMuted,
            }}
          >
            <p>No companies yet. Create your first valuation to get started.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {companies.map((company) => {
              const current = company.snapshots.find((s) => s.is_current) || company.snapshots[0];
              const history = company.snapshots.filter((s) => s.id !== current?.id);
              const isExpanded = expandedId === company.id;

              return (
                <div
                  key={company.id}
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: "12px",
                    padding: "20px 24px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h3 style={{ fontSize: "17px", fontWeight: 600 }}>{company.name}</h3>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: STATUS_COLOR[company.report_status],
                          }}
                        >
                          {STATUS_LABEL[company.report_status]}
                        </span>
                      </div>
                      <p style={{ color: C.textMuted, fontSize: "13px", marginTop: "4px" }}>
                        {[company.industry, company.stage].filter(Boolean).join(" · ") || "—"}
                        {" · updated "}
                        {formatDate(company.updated_at)}
                        {company.snapshots.length > 0 &&
                          ` · ${company.snapshots.length} saved report${company.snapshots.length === 1 ? "" : "s"}`}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {current && (
                        <button
                          onClick={() => router.push(`/companies/${company.id}/report/${current.id}`)}
                          style={{
                            padding: "8px 16px",
                            background: C.accent,
                            color: "#000",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: 600,
                            fontFamily: FONT_SANS,
                            cursor: "pointer",
                          }}
                        >
                          View report
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/companies/${company.id}/edit`)}
                        style={{
                          padding: "8px 16px",
                          background: "transparent",
                          color: C.accent,
                          border: `1px solid ${C.accent}`,
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: 600,
                          fontFamily: FONT_SANS,
                          cursor: "pointer",
                        }}
                      >
                        {current ? "Edit inputs" : "Continue setup"}
                      </button>
                      {history.length > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : company.id)}
                          style={{
                            padding: "8px 16px",
                            background: "transparent",
                            color: C.textMuted,
                            border: `1px solid ${C.border}`,
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: 600,
                            fontFamily: FONT_SANS,
                            cursor: "pointer",
                          }}
                        >
                          History ({history.length}) {isExpanded ? "▲" : "▼"}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && history.length > 0 && (
                    <div
                      style={{
                        marginTop: "16px",
                        paddingTop: "16px",
                        borderTop: `1px solid ${C.border}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {history.map((snap) => (
                        <div
                          key={snap.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "13px",
                          }}
                        >
                          <span style={{ color: C.textMuted }}>
                            {snap.label || "Report"} · {formatDate(snap.created_at)}
                          </span>
                          <button
                            onClick={() => router.push(`/companies/${company.id}/report/${snap.id}`)}
                            style={{
                              background: "transparent",
                              color: C.accent,
                              border: "none",
                              fontSize: "13px",
                              fontWeight: 600,
                              fontFamily: FONT_SANS,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            View →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
