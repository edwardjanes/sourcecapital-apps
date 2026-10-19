import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Cal.com booking webhook.
//
// Records which deck submission a booked call came from, so
// "deck review → call booked" is a query rather than a manual join against
// Cal.com's dashboard. Matching prefers `metadata.submission_id` (set by
// /api/book-call) and falls back to the attendee's email, which the CTA
// prefills from the submission.
//
// Cal.com signs the raw body with HMAC-SHA256 and sends a lowercase hex digest
// in `x-cal-signature-256`. The secret is optional on Cal.com's side; if
// CAL_WEBHOOK_SECRET is unset we accept the delivery and say so in the logs,
// because a missing booking record costs a metric, not a payment.

export const dynamic = "force-dynamic";

function signatureMatches(rawBody: string, presented: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(presented.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Cal.com's BOOKING_CREATED payload shape is not documented field by field, so
 * look in every plausible place rather than assuming one.
 */
function attendeeEmail(payload: Record<string, unknown>): string | null {
  const attendees = payload.attendees;
  if (Array.isArray(attendees)) {
    for (const attendee of attendees) {
      const email = asString((attendee as Record<string, unknown>)?.email);
      if (email) return email;
    }
  }
  const responses = payload.responses as Record<string, unknown> | undefined;
  const responseEmail = responses?.email;
  if (responseEmail && typeof responseEmail === "object") {
    const value = asString((responseEmail as Record<string, unknown>).value);
    if (value) return value;
  }
  return asString(responseEmail) ?? asString(payload.email) ?? null;
}

function submissionIdFromPayload(payload: Record<string, unknown>): string | null {
  const metadata = payload.metadata;
  if (metadata && typeof metadata === "object") {
    const found = asString((metadata as Record<string, unknown>).submission_id);
    if (found) return found;
  }
  return null;
}

const BOOKING_EVENTS = new Set(["BOOKING_CREATED", "BOOKING_REQUESTED", "BOOKING_RESCHEDULED"]);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.CAL_WEBHOOK_SECRET;

  if (secret) {
    const presented = req.headers.get("x-cal-signature-256");
    if (!presented || !signatureMatches(rawBody, presented, secret)) {
      console.warn("[webhooks/cal] Signature rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn("[webhooks/cal] CAL_WEBHOOK_SECRET is not set — accepting unverified delivery");
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const trigger = asString(event.triggerEvent) ?? "";
  if (!BOOKING_EVENTS.has(trigger)) {
    return NextResponse.json({ received: true, ignored: trigger });
  }

  const payload = (event.payload as Record<string, unknown>) ?? {};
  const bookingUid = asString(payload.uid);
  const email = attendeeEmail(payload);
  let submissionId = submissionIdFromPayload(payload);

  if (!submissionId && email) {
    // Their most recent submission is the one the booking came from.
    const { data: candidate } = await supabaseAdmin
      .from("deck_submissions")
      .select("id")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    submissionId = candidate?.id ?? null;
  }

  if (!submissionId) {
    // A booking from someone who never submitted a deck is perfectly normal.
    console.log(`[webhooks/cal] ${trigger} for ${email ?? "unknown"} — no matching submission`);
    return NextResponse.json({ received: true, matched: false });
  }

  const { error } = await supabaseAdmin
    .from("deck_submissions")
    .update({
      // When the call was booked, not when the meeting starts.
      call_booked_at: new Date().toISOString(),
      call_booking_uid: bookingUid,
    })
    .eq("id", submissionId);

  if (error) {
    Sentry.captureException(new Error(error.message), {
      tags: { context: "cal_webhook" },
      extra: { submissionId, bookingUid, trigger },
    });
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  console.log(`[webhooks/cal] ${trigger} linked to submission ${submissionId}`);
  return NextResponse.json({ received: true, matched: true });
}
