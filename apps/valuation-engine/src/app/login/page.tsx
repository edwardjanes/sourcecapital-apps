"use client";

import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { C, FONT_SANS } from "@/lib/theme";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      setError("Check your email to confirm your account!");
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "12px",
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    color: C.text,
    fontSize: "14px",
    fontFamily: FONT_SANS,
    outline: "none" as const,
    marginBottom: "12px",
  };

  const buttonStyle = {
    width: "100%",
    padding: "12px",
    background: C.accent,
    color: "#000",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    fontFamily: FONT_SANS,
    cursor: "pointer",
    marginTop: "8px",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: FONT_SANS,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "32px",
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: "12px",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "24px" }}>
          Valuation Engine
        </h1>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required
          />

          {error && (
            <div
              style={{
                padding: "12px",
                marginBottom: "12px",
                background: "rgba(239, 68, 68, 0.1)",
                color: "#FCA5A5",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <button
            type="button"
            onClick={handleSignup}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: "transparent",
              color: C.accent,
              border: `1px solid ${C.accentBorder}`,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
