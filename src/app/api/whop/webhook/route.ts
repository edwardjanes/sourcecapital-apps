import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPaymentConfirmationEmail, createOrUpdateContact } from "@/lib/loops";
import {
  COMMUNITY_PLAN_ID,
  appUrl,
  isPaymentEvent,
  parseWhopEvent,
  payerEmailFrom,
  planIdFrom,
  submissionIdFrom,
  verifyWhopWebhook,
} from "@/lib/whop";

// Whop calls this when a payment completes. We verify the signature, work out
// which submission the payment belongs to, and mark it paid so the results page
// unlocks.
//
// Two rules keep the money visible:
//   - Every verified delivery is logged to `whop_webhook_events` before we touch
//     anything else, so a payment we cannot attribute is still recoverable.
//   - Only a bad signature (or missing config) returns a non-2xx. Anything else
//     answers 200 and reports to Sentry, because Whop disables an endpoint that
//     keeps failing — which is exactly how three weeks of payments went
//     unrecorded.

export const dynamic = "force-dynamic";

type EventLog = {
  id: string;
  event_type: string;
  submission_id: string | null;
  matched_by: "metadata" | "email" | "unmatched";
  payer_email: string | null;
  whop_order_id: string | null;
  payload: Record<string, unknown>;
  handled: boolean;
  error_message: string | null;
};

async function recordEvent(log: EventLog): Promise<void> {
  const { error } = await supabaseAdmin
    .from("whop_webhook_events")
    .upsert(log, { onConflict: "id" });
  if (error) {
    // Losing the audit row must not lose the payment, so report and carry on.
    Sentry.captureException(new Error(`whop_webhook_events upsert failed: ${error.message}`), {
      tags: { context: "whop_webhook" },
      extra: { eventId: log.id, eventType: log.event_type },
    });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;

  // Fail closed: without the secret, anyone who finds this URL could mark
  // submissions paid. A 500 is loud, and that is the point.
  if (!webhookSecret) {
    Sentry.captureException(new Error("WHOP_WEBHOOK_SECRET is not configured"), {
      tags: { context: "whop_webhook" },
    });
    console.error("[whop/webhook] WHOP_WEBHOOK_SECRET is not set — rejecting delivery");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const verified = verifyWhopWebhook(
    body,
    {
      id: req.headers.get("webhook-id"),
      timestamp: req.headers.get("webhook-timestamp"),
      signature: req.headers.get("webhook-signature"),
    },
    webhookSecret
  );

  if (!verified.ok) {
    // Report every rejection. Silent 401s are what let the previous breakage
    // run for weeks without anyone noticing.
    Sentry.captureException(new Error(`Whop webhook signature rejected: ${verified.reason}`), {
      tags: { context: "whop_webhook", reason: verified.reason },
      extra: { hasWebhookId: Boolean(req.headers.get("webhook-id")) },
    });
    console.warn(`[whop/webhook] Signature rejected: ${verified.reason}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = parseWhopEvent(parsed);
  const eventId = event.messageId ?? `local_${crypto.randomUUID()}`;
  const data = event.data;
  const payerEmail = payerEmailFrom(data);
  const orderId = (data.id ?? data.order_id ?? null) as string | null;

  console.log(`[whop/webhook] ${event.type} (${eventId})`);

  if (!isPaymentEvent(event.type)) {
    await recordEvent({
      id: eventId,
      event_type: event.type,
      submission_id: null,
      matched_by: "unmatched",
      payer_email: payerEmail,
      whop_order_id: orderId,
      payload: parsed,
      handled: true,
      error_message: null,
    });
    return NextResponse.json({ received: true });
  }

  // A retry of an event we already fulfilled must not re-send emails.
  const { data: existing } = await supabaseAdmin
    .from("whop_webhook_events")
    .select("id, handled")
    .eq("id", eventId)
    .maybeSingle();
  if (existing?.handled) {
    console.log(`[whop/webhook] ${eventId} already handled — ignoring retry`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Prefer the metadata we attached at checkout. When it is absent — a plain
  // plan link no longer carries `metadata[...]` on Whop's current API — fall
  // back to the payer's email and take their most recent unpaid submission.
  let submissionId = submissionIdFrom(data);
  let matchedBy: EventLog["matched_by"] = submissionId ? "metadata" : "unmatched";

  if (!submissionId && payerEmail) {
    const { data: candidate } = await supabaseAdmin
      .from("deck_submissions")
      .select("id")
      .ilike("email", payerEmail)
      .eq("paid", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (candidate?.id) {
      submissionId = candidate.id;
      matchedBy = "email";
    }
  }

  if (!submissionId) {
    // Money has changed hands and we cannot say for what. Keep the payload and
    // shout, but answer 200 so the endpoint stays healthy.
    await recordEvent({
      id: eventId,
      event_type: event.type,
      submission_id: null,
      matched_by: "unmatched",
      payer_email: payerEmail,
      whop_order_id: orderId,
      payload: parsed,
      handled: false,
      error_message: "No submission_id in metadata and no unpaid submission for the payer email",
    });
    Sentry.captureException(new Error("Whop payment could not be matched to a submission"), {
      tags: { context: "whop_webhook" },
      extra: { eventId, eventType: event.type, payerEmail, orderId },
    });
    console.error(`[whop/webhook] Unmatched payment ${eventId} (${payerEmail ?? "no email"})`);
    return NextResponse.json({ received: true, matched: false });
  }

  const { data: submission, error } = await supabaseAdmin
    .from("deck_submissions")
    .update({ paid: true, whop_order_id: orderId })
    .eq("id", submissionId)
    .select("email, first_name, business_name")
    .single();

  if (error) {
    await recordEvent({
      id: eventId,
      event_type: event.type,
      submission_id: submissionId,
      matched_by: matchedBy,
      payer_email: payerEmail,
      whop_order_id: orderId,
      payload: parsed,
      handled: false,
      error_message: error.message,
    });
    Sentry.captureException(new Error(error.message), {
      tags: { context: "whop_webhook" },
      extra: { submissionId, orderId, eventType: event.type },
    });
    console.error("[whop/webhook] DB update failed:", error);
    // 500 here is deliberate: a Whop retry is the cheapest way to recover from
    // a transient database error, and the row above records the attempt.
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  console.log(
    `[whop/webhook] Marked submission ${submissionId} paid via ${matchedBy} (order: ${orderId ?? "—"})`
  );

  // Deliberately not touching `profiles.plan` here. plan_J7CPhtS9G5ffD is the
  // $29.99/month community subscription, and `profiles.plan = 'pro'` is what
  // lifts the free-analysis limit in /api/submit — so flipping it on a
  // community purchase would quietly ship the unlimited product nobody has
  // decided to sell. The payload is kept in `whop_webhook_events`, so this can
  // be added once that call is made.
  if (planIdFrom(data) === COMMUNITY_PLAN_ID) {
    console.log(
      `[whop/webhook] Community subscription for ${payerEmail ?? "unknown"} — profile entitlements left unchanged`
    );
  }

  await recordEvent({
    id: eventId,
    event_type: event.type,
    submission_id: submissionId,
    matched_by: matchedBy,
    payer_email: payerEmail,
    whop_order_id: orderId,
    payload: parsed,
    handled: true,
    error_message: null,
  });

  if (submission?.email) {
    const resultsUrl = `${appUrl()}/investment-score/results/${submissionId}`;

    createOrUpdateContact({
      email: submission.email,
      firstName: submission.first_name ?? "",
      customProperties: { paid: "true" },
    }).catch(err => console.error("[loops] Contact paid update error:", err));

    sendPaymentConfirmationEmail({
      email: submission.email,
      firstName: submission.first_name ?? "there",
      businessName: submission.business_name,
      resultsUrl,
      orderId: orderId || "—",
    }).catch(err => console.error("[loops] Payment email error:", err));
  }

  return NextResponse.json({ received: true, matched: true });
}
