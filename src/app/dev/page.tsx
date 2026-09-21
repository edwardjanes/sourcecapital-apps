"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { submitDeck } from "@/lib/submitDeck";

const TEST_SUBMISSION_ID = "b8a652a9-3b16-4f82-a796-d68ef92fee74";

const SAVED_SUBMISSIONS = [
  {
    label: "Wellvyl",
    id: "13781e90-d1b2-4fb9-89b3-f365d85dfa20",
  },
];

export default function DevPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [quickFile, setQuickFile] = useState<File | null>(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [testEmail, setTestEmail] = useState("edward@edwardjanes.co.uk");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<Record<string, unknown> | null>(null);
  const [contactEmail, setContactEmail] = useState("edward@edwardjanes.co.uk");
  const [contactSending, setContactSending] = useState(false);
  const [contactResult, setContactResult] = useState<Record<string, unknown> | null>(null);

  const quickSubmit = async () => {
    if (!quickFile) { setError("Drop a PDF first"); return; }
    setQuickSubmitting(true);
    setError(null);
    try {
      const result = await submitDeck({
        file: quickFile,
        fields: {
          firstName: "Dev",
          lastName: "Test",
          email: "dev@test.com",
          businessName: quickFile.name.replace(".pdf", ""),
          website: "https://example.com",
          country: "United Kingdom",
        },
      });
      if (result.status === "free_limit") throw new Error("free_limit_reached for dev@test.com");
      router.push(`/investment-score/analysing/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setQuickSubmitting(false);
    }
  };

  const clone = async (sourceId: string, label: string) => {
    setCloning(label);
    setError(null);
    try {
      const res = await fetch("/api/dev/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clone failed");
      router.push(`/investment-score/analysing/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCloning(null);
    }
  };

  const sendTestContact = async () => {
    setContactSending(true);
    setContactResult(null);
    try {
      const res = await fetch("/api/dev/test-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contactEmail }),
      });
      const data = await res.json();
      setContactResult(data);
    } catch (err) {
      setContactResult({ error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setContactSending(false);
    }
  };

  const sendTestEmail = async () => {
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/dev/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: TEST_SUBMISSION_ID, overrideEmail: testEmail }),
      });
      const data = await res.json();
      setEmailResult(data);
    } catch (err) {
      setEmailResult({ error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setEmailSending(false);
    }
  };

  const simulatePayment = async (submissionId: string, label: string) => {
    setPaying(label);
    setError(null);
    try {
      const res = await fetch("/api/whop/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payment.completed",
          data: {
            id: `test_order_${Date.now()}`,
            metadata: { submission_id: submissionId },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment simulation failed");
      setPaid(prev => ({ ...prev, [label]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPaying(null);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#080C14", color: "#F8FAFC", padding: "60px 32px", fontFamily: "monospace" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700 }}>Dev Tools</h1>
        <a href="/dev/analytics" style={{ fontSize: "13px", color: "#03fb83", textDecoration: "none", fontWeight: 600 }}>
          → Analytics Dashboard
        </a>
      </div>
      <p style={{ color: "#6B7280", fontSize: "13px", marginBottom: "40px" }}>
        One-click test submissions — clone a deck, simulate payment, view results.
      </p>

      {/* Quick submit */}
      <div style={{ background: "#0F1929", border: "1px solid #1A2438", borderRadius: "10px", padding: "20px", maxWidth: "560px", marginBottom: "32px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: "#03fb83" }}>Quick Submit — drop a PDF, skip the form</div>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") setQuickFile(f); }}
          style={{
            border: `2px dashed ${quickFile ? "#03fb83" : "#1A2438"}`, borderRadius: "8px",
            padding: "20px", textAlign: "center", cursor: "pointer", marginBottom: "12px",
            background: quickFile ? "rgba(3,251,131,0.05)" : "transparent",
          }}
        >
          {quickFile
            ? <span style={{ color: "#03fb83", fontSize: "13px" }}>📄 {quickFile.name} ({(quickFile.size / 1024 / 1024).toFixed(1)} MB)</span>
            : <span style={{ color: "#6B7280", fontSize: "13px" }}>Click or drag a PDF here</span>}
        </div>
        <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) setQuickFile(f); }} />
        <button
          onClick={quickSubmit}
          disabled={!quickFile || quickSubmitting}
          style={{
            background: quickSubmitting ? "#374151" : "#03fb83", color: "#000",
            border: "none", borderRadius: "8px", padding: "10px 20px",
            fontSize: "13px", fontWeight: 700, cursor: quickFile && !quickSubmitting ? "pointer" : "not-allowed", width: "100%",
          }}
        >
          {quickSubmitting ? "Submitting…" : "Submit & Analyse →"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "560px" }}>
        {SAVED_SUBMISSIONS.map(({ label, id }) => (
          <div
            key={id}
            style={{
              background: "#0F1929",
              border: "1px solid #1A2438",
              borderRadius: "10px",
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{label}</div>
                <div style={{ color: "#6B7280", fontSize: "11px", marginTop: "2px" }}>{id}</div>
              </div>
              <button
                onClick={() => clone(id, label)}
                disabled={cloning === label}
                style={{
                  background: cloning === label ? "#374151" : "#03fb83",
                  color: "#fff", border: "none", borderRadius: "8px",
                  padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                  cursor: cloning === label ? "not-allowed" : "pointer",
                }}
              >
                {cloning === label ? "Cloning…" : "Re-test →"}
              </button>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid #1A2438", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>Simulate Whop payment for this submission</span>
              <button
                onClick={() => simulatePayment(id, label)}
                disabled={paying === label || paid[label]}
                style={{
                  background: paid[label] ? "rgba(34,197,94,0.15)" : paying === label ? "#374151" : "rgba(249,115,22,0.15)",
                  color: paid[label] ? "#22C55E" : paying === label ? "#9CA3AF" : "#F97316",
                  border: `1px solid ${paid[label] ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)"}`,
                  borderRadius: "8px", padding: "7px 14px", fontSize: "12px", fontWeight: 600,
                  cursor: paid[label] || paying === label ? "not-allowed" : "pointer",
                }}
              >
                {paid[label] ? "✓ Payment simulated" : paying === label ? "Simulating…" : "Simulate payment"}
              </button>
            </div>

            {paid[label] && (
              <div style={{ marginTop: "10px" }}>
                <a
                  href={`/investment-score/results/${id}`}
                  style={{ fontSize: "12px", color: "#03fb83", textDecoration: "none" }}
                >
                  → View unlocked results page
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Loops email tester */}
      <div style={{ background: "#0F1929", border: "1px solid #1A2438", borderRadius: "10px", padding: "20px", maxWidth: "560px", marginTop: "32px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#03fb83" }}>Loops Email Tester</div>
        <div style={{ fontSize: "11px", color: "#6B7280", marginBottom: "16px" }}>
          Sends a real results email using submission <span style={{ color: "#9CA3AF" }}>{TEST_SUBMISSION_ID.slice(0, 8)}…</span>
          {" "}(<a href={`/investment-score/results/${TEST_SUBMISSION_ID}`} target="_blank" style={{ color: "#03fb83", textDecoration: "none" }}>view results ↗</a>)
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder="Send to email..."
            style={{
              flex: 1, padding: "9px 12px", background: "#111927",
              border: "1px solid #1A2438", borderRadius: "8px",
              color: "#F8FAFC", fontSize: "13px", outline: "none",
            }}
          />
          <button
            onClick={sendTestEmail}
            disabled={emailSending || !testEmail}
            style={{
              background: emailSending ? "#374151" : "#03fb83", color: "#000",
              border: "none", borderRadius: "8px", padding: "9px 18px",
              fontSize: "13px", fontWeight: 700,
              cursor: emailSending || !testEmail ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {emailSending ? "Sending…" : "Send Test Email →"}
          </button>
        </div>
        {emailResult && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", fontSize: "12px",
            background: emailResult.ok ? "rgba(3,251,131,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${emailResult.ok ? "rgba(3,251,131,0.2)" : "rgba(239,68,68,0.2)"}`,
            color: emailResult.ok ? "#03fb83" : "#EF4444",
          }}>
            <div style={{ marginBottom: "6px" }}>
              {emailResult.ok ? `✓ Sent to ${emailResult.sentTo}` : `✗ Failed`}
            </div>
            <pre style={{ margin: 0, fontSize: "11px", color: "#9CA3AF", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(emailResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Loops contact property tester */}
      <div style={{ background: "#0F1929", border: "1px solid #1A2438", borderRadius: "10px", padding: "20px", maxWidth: "560px", marginTop: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#03fb83" }}>Loops Contact Property Tester</div>
        <div style={{ fontSize: "11px", color: "#6B7280", marginBottom: "16px" }}>
          Creates/updates a contact in Loops with dummy score, verdict, businessName and results properties.
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input
            type="email"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            placeholder="Contact email..."
            style={{
              flex: 1, padding: "9px 12px", background: "#111927",
              border: "1px solid #1A2438", borderRadius: "8px",
              color: "#F8FAFC", fontSize: "13px", outline: "none",
            }}
          />
          <button
            onClick={sendTestContact}
            disabled={contactSending || !contactEmail}
            style={{
              background: contactSending ? "#374151" : "#03fb83", color: "#000",
              border: "none", borderRadius: "8px", padding: "9px 18px",
              fontSize: "13px", fontWeight: 700,
              cursor: contactSending || !contactEmail ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {contactSending ? "Sending…" : "Update Contact →"}
          </button>
        </div>
        {contactResult && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", fontSize: "12px",
            background: contactResult.ok ? "rgba(3,251,131,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${contactResult.ok ? "rgba(3,251,131,0.2)" : "rgba(239,68,68,0.2)"}`,
            color: contactResult.ok ? "#03fb83" : "#EF4444",
          }}>
            <div style={{ marginBottom: "6px" }}>
              {contactResult.ok ? `✓ Contact updated` : `✗ Failed`}
            </div>
            <pre style={{ margin: 0, fontSize: "11px", color: "#9CA3AF", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(contactResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {error && (
        <p style={{ marginTop: "20px", color: "#EF4444", fontSize: "13px" }}>
          Error: {error}
        </p>
      )}
    </main>
  );
}
