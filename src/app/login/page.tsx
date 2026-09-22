"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const GREEN = "#03fb83";
const CARD_BG = "#161616";
const CARD_BORDER = "#242424";
const MUTED = "#6B7280";
const LOGO = "https://raw.githubusercontent.com/edwardjanes/source-capital/0147b27fad891686f67559992e43319411f07ba4/logo.png";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "#111", border: "1px solid #2A2A2A",
  borderRadius: "8px", color: "#fff", fontSize: "16px",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "12px", fontWeight: 500,
  color: "#9CA3AF", marginBottom: "6px",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();
  const nextUrl = searchParams.get('next') || '/dashboard';

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Shown while the browser is on its way to Google or the dashboard, which can
  // take several seconds; without it the page looks like nothing happened.
  const [status, setStatus] = useState("");

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setStatus("Redirecting you to Google…");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setStatus("");
      setLoading(false);
    }
    // On success, browser redirects to Google — no further action needed
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess("Account created! Check your email to confirm, then log in.");
        setMode("login");
      }
    } else {
      setStatus("Signing you in…");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setStatus("");
      } else {
        // Keep the loading state until the next page replaces this one.
        setStatus("Signed in. Redirecting you now…");
        router.push(nextUrl);
        router.refresh();
        return;
      }
    }
    setLoading(false);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>

      <div style={{ width: "100%", maxWidth: "400px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <img src={LOGO} alt="Source Capital" style={{ height: "36px", width: "auto" }} />
        </div>

        {/* Card */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: "20px", padding: "32px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "6px", textAlign: "center" }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p style={{ fontSize: "15px", color: MUTED, textAlign: "center", marginBottom: "28px" }}>
            {mode === "login" ? "Sign in to access your analyses" : "Start analysing your pitch deck"}
          </p>

          {success && (
            <div style={{ background: "rgba(3,251,131,0.08)", border: "1px solid rgba(3,251,131,0.25)", borderRadius: "8px", padding: "12px", marginBottom: "20px", fontSize: "15px", color: GREEN }}>
              {success}
            </div>
          )}

          {status && (
            <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(3,251,131,0.08)", border: "1px solid rgba(3,251,131,0.25)", borderRadius: "8px", padding: "12px", marginBottom: "20px", fontSize: "15px", color: GREEN }}>
              <span style={{ width: "16px", height: "16px", flexShrink: 0, border: "2px solid rgba(3,251,131,0.25)", borderTopColor: GREEN, borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
              {status}
            </div>
          )}

          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "12px", marginBottom: "20px", fontSize: "15px", color: "#EF4444" }}>
              {error}
            </div>
          )}

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              width: "100%", padding: "12px", borderRadius: "10px",
              border: "1px solid #2A2A2A", background: "#111",
              color: "#fff", fontSize: "16px", fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              marginBottom: "20px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ flex: 1, height: "1px", background: "#2A2A2A" }} />
            <span style={{ fontSize: "12px", color: "#6B7280" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "#2A2A2A" }} />
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={labelStyle}>First name</label>
                  <input style={inputStyle} type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Edward" />
                </div>
                <div>
                  <label style={labelStyle}>Last name</label>
                  <input style={inputStyle} type="text" required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Janes" />
                </div>
              </div>
            )}

            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={8} />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px", borderRadius: "10px", border: "none",
                background: loading ? "#2A2A2A" : GREEN,
                color: loading ? MUTED : "#000",
                fontSize: "16px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              {loading ? (
                <span style={{ width: "16px", height: "16px", border: "2px solid #444", borderTopColor: GREEN, borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
              ) : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "15px", color: MUTED, marginTop: "20px" }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setSuccess(""); }}
              style={{ background: "none", border: "none", color: GREEN, fontWeight: 600, cursor: "pointer", fontSize: "15px" }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "32px", height: "32px", border: "3px solid #242424", borderTopColor: GREEN, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
