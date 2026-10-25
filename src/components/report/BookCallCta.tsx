"use client";

import posthog from "posthog-js";
import { bookCallHref } from "@/lib/bookCall";

const GREEN = "#03fb83";
const CARD_BG = "#161616";
const CARD_BORDER = "#242424";
const MUTED = "#6B7280";

type Props = {
  submissionId: string;
  score: number;
  verdictType: string;
  /** Buyers get "walk through your report"; everyone else gets "talk it through". */
  paid: boolean;
};

export default function BookCallCta({ submissionId, score, verdictType, paid }: Props) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "12px",
        padding: "20px 24px",
        marginBottom: "12px",
        display: "flex",
        gap: "20px",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: "240px" }}>
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>
          Want to go through this with someone?
        </p>
        <p style={{ fontSize: "15px", color: MUTED, lineHeight: 1.65 }}>
          {paid
            ? "Book 60 minutes with Edward to walk through your report and plan what to fix first."
            : "Book 60 minutes with Edward to talk through your score and what it would take to raise."}
        </p>
      </div>
      <a
        href={bookCallHref(submissionId)}
        onClick={() =>
          posthog.capture("call_cta_clicked", {
            submissionId,
            score,
            verdictType,
          })
        }
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 22px",
          background: GREEN,
          borderRadius: "10px",
          color: "#000",
          fontSize: "15px",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        Book a call with Edward
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2.5 7h9M7 3l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </div>
  );
}
