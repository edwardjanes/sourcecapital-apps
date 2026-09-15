"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

const COUNTRIES = [
  "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile", "China",
  "Colombia", "Czech Republic", "Denmark", "Egypt", "Finland", "France",
  "Germany", "Ghana", "Greece", "Hong Kong", "Hungary", "India", "Indonesia",
  "Ireland", "Israel", "Italy", "Japan", "Kenya", "Malaysia", "Mexico",
  "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan", "Philippines",
  "Poland", "Portugal", "Romania", "Saudi Arabia", "Singapore", "South Africa",
  "South Korea", "Spain", "Sweden", "Switzerland", "Taiwan", "Thailand",
  "Turkey", "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
  "Vietnam", "Other",
];

interface Lead {
  firstName: string;
  lastName: string;
  email: string;
}

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [lead, setLead] = useState<Lead | null>(null);
  // Only true when we arrived via a bare ?email= link (e.g. the homepage
  // hero) rather than the /investment-score LeadModal, which already
  // collects first/last name before sessionStorage is set.
  const [needsNameInput, setNeedsNameInput] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("deckscore-lead");
    if (raw) {
      const parsed: Lead = JSON.parse(raw);
      setLead(parsed);
      setFirstName(parsed.firstName);
      setLastName(parsed.lastName);
      setNeedsNameInput(false);
      return;
    }

    // Arrived from an external email-capture form (e.g. the homepage hero)
    // with just an email — collect the name here instead of bouncing back
    // to /investment-score.
    const emailParam = new URLSearchParams(window.location.search).get("email");
    if (emailParam) {
      setLead({ firstName: "", lastName: "", email: emailParam });
      setNeedsNameInput(true);
      return;
    }

    router.replace("/investment-score");
  }, [router]);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
      setError("");
    } else {
      setError("Please upload a PDF file.");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setError("");
    } else if (selected) {
      setError("Please upload a PDF file.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setError("Please enter your first and last name."); return; }
    if (!file) { setError("Please upload your pitch deck PDF."); return; }
    if (!country) { setError("Please select your country."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("File must be under 20MB."); return; }

    setSubmitting(true);
    setError("");

    const fd = new FormData();
    fd.append("firstName", firstName.trim());
    fd.append("lastName", lastName.trim());
    fd.append("email", lead!.email);
    fd.append("businessName", businessName);
    fd.append("website", website);
    fd.append("country", country);
    fd.append("deck", file);

    try {
      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        // Handle free limit - redirect to upsell
        if (data.error === "free_limit_reached") {
          setSubmitting(false);
          sessionStorage.removeItem("deckscore-lead");
          router.push(`/upsell?reason=free_limit&submission_id=${data.existingSubmissionId}`);
          return;
        }
        throw new Error(data.error || "Submission failed");
      }

      sessionStorage.removeItem("deckscore-lead");
      posthog.capture("deck_uploaded", { business_name: businessName, country });
      posthog.capture("deck_submitted", {
        submission_id: data.id,
        business_name: businessName,
        country,
      });
      router.push(`/investment-score/analysing/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (!lead) return null;

  return (
    <main style={{ minHeight: "100vh", background: "#080C14", color: "#F8FAFC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>

      {/* Logo */}
      <div style={{ marginBottom: "36px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", marginBottom: "8px" }}>
          <img src="https://raw.githubusercontent.com/edwardjanes/source-capital/0147b27fad891686f67559992e43319411f07ba4/logo.png" alt="Source Capital" style={{ height: "32px", width: "auto" }} />
        </div>
        {/* Progress steps */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
          {["Details", "Upload", "Analysing", "Results"].map((step, i) => (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: i === 1 ? "#03fb83" : i === 0 ? "#10B981" : "#1A2438", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: i <= 1 ? "#fff" : "#374151" }}>
                  {i === 0 ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: "12px", color: i === 1 ? "#02d970" : i === 0 ? "#10B981" : "#374151", fontWeight: i === 1 ? 600 : 400 }}>{step}</span>
              </div>
              {i < 3 && <div style={{ width: "20px", height: "1px", background: "#1A2438" }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: "500px", background: "#0D1420", border: "1px solid #1A2438", borderRadius: "16px", padding: "36px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "6px" }}>
          Tell us about your business
        </h1>
        <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "28px" }}>
          {needsNameInput
            ? "A few quick details before we analyse your deck."
            : `Hi ${firstName} — a few quick details before we analyse your deck.`}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Hidden email carried through from the marketing site / LeadModal */}
          <input type="hidden" name="email" value={lead.email} readOnly />

          {/* First / Last name — only asked here when we didn't already
              collect it via the LeadModal (e.g. arrived from ?email=) */}
          {needsNameInput && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={labelStyle}>First name *</label>
                <input
                  type="text"
                  required
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Last name *</label>
                <input
                  type="text"
                  required
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Business Name */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Business name *</label>
            <input
              type="text"
              required
              placeholder="Acme Inc."
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Website */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Website</label>
            <input
              type="url"
              placeholder="https://acme.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Country */}
          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Country *</label>
            <select
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ ...inputStyle, color: country ? "#F8FAFC" : "#475569" }}
            >
              <option value="" disabled>Select your country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c} style={{ background: "#0D1420", color: "#F8FAFC" }}>{c}</option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Pitch deck (PDF, max 20MB) *</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              style={{
                border: `2px dashed ${dragOver ? "#03fb83" : file ? "#10B981" : "#1A2438"}`,
                borderRadius: "10px",
                padding: "28px",
                textAlign: "center",
                cursor: "pointer",
                background: dragOver ? "rgba(3,251,131,0.05)" : file ? "rgba(16,185,129,0.05)" : "transparent",
                transition: "all 0.2s",
              }}
            >
              {file ? (
                <div>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>📄</div>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#10B981" }}>{file.name}</p>
                  <p style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                    {(file.size / 1024 / 1024).toFixed(1)} MB — click to replace
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>☁️</div>
                  <p style={{ fontSize: "14px", color: "#CBD5E1", marginBottom: "4px" }}>
                    <span style={{ color: "#02d970", fontWeight: 600 }}>Click to upload</span> or drag and drop
                  </p>
                  <p style={{ fontSize: "12px", color: "#475569" }}>PDF only · Max 20MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          {error && (
            <p style={{ fontSize: "13px", color: "#EF4444", marginBottom: "16px", padding: "10px 12px", background: "rgba(239,68,68,0.08)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "14px",
              background: submitting ? "#374151" : "linear-gradient(135deg, #03fb83, #03fb83)",
              border: "none",
              borderRadius: "10px",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {submitting ? (
              <>
                <span style={spinnerStyle} />
                Uploading...
              </>
            ) : (
              <>
                Analyse My Deck
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "#94A3B8",
  marginBottom: "7px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#111927",
  border: "1px solid #1A2438",
  borderRadius: "8px",
  color: "#F8FAFC",
  fontSize: "14px",
  outline: "none",
  appearance: "none",
};

const spinnerStyle: React.CSSProperties = {
  width: "16px",
  height: "16px",
  border: "2px solid rgba(255,255,255,0.3)",
  borderTopColor: "#fff",
  borderRadius: "50%",
  animation: "spin 0.7s linear infinite",
  display: "inline-block",
};
