import Link from "next/link";
import { C, FONT_SANS } from "@/lib/theme";

export default function AuthCodeErrorPage() {
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
        textAlign: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "32px",
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: "12px",
        }}
      >
        <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}>
          Sign-in link didn&apos;t work
        </h1>
        <p style={{ fontSize: "14px", color: C.textMid, lineHeight: 1.6, marginBottom: "24px" }}>
          That confirmation or sign-in link is invalid or has expired. This can happen if it was
          already used, or if too much time passed since it was sent. Try signing in again, or
          request a new link.
        </p>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: C.accent,
            color: "#000",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
