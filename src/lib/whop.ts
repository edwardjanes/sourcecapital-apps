import crypto from "node:crypto";

// Whop integration.
//
// Two things live here:
//   1. Checkout URLs. Whop's current API attaches custom metadata to a
//      *checkout configuration* created server-side, not to query params on a
//      plain plan link. The old `?metadata[submission_id]=...` form is an API v2
//      behaviour, and when it stops propagating, a completed payment arrives at
//      our webhook with no way to tell which submission it belongs to.
//   2. Webhook verification. Whop signs with the Standard Webhooks scheme.

const WHOP_API_BASE = process.env.WHOP_API_BASE ?? "https://api.whop.com/api/v1";
const WHOP_SITE = "https://whop.com";

export const DECK_PLAN_ID =
  process.env.NEXT_PUBLIC_WHOP_PLAN_ID ?? "plan_AUP8u87FOYnEZ";
export const PRO_PLAN_ID =
  process.env.NEXT_PUBLIC_WHOP_PLAN_ID_PRO ?? "plan_7LlelIvBnFah9";
export const COMMUNITY_PLAN_ID =
  process.env.NEXT_PUBLIC_WHOP_COMMUNITY_PLAN_ID ?? "plan_J7CPhtS9G5ffD";

export type WhopPlanKey = "deck" | "pro" | "community";

export function planIdFor(key: WhopPlanKey): string {
  if (key === "pro") return PRO_PLAN_ID;
  if (key === "community") return COMMUNITY_PLAN_ID;
  return DECK_PLAN_ID;
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sourcecapital.co.uk";
}

/**
 * Direct plan link. Still the fallback whenever a checkout configuration can't
 * be created, because taking the payment matters more than attaching metadata —
 * an unmatched payment can be reconciled from the payer's email, a lost
 * checkout cannot be recovered at all.
 */
export function whopCheckoutUrl(submissionId: string, planKey: WhopPlanKey = "deck"): string {
  const params = new URLSearchParams({
    "metadata[submission_id]": submissionId,
    redirect_url: `${appUrl()}/thank-you?submission_id=${submissionId}`,
  });
  return `${WHOP_SITE}/checkout/${planIdFor(planKey)}/?${params.toString()}`;
}

/**
 * Create a checkout configuration so `metadata.submission_id` is carried on the
 * payment Whop sends back to us. Returns an absolute purchase URL, or null when
 * the call is not possible (no API key) or fails — callers fall back to
 * `whopCheckoutUrl`.
 */
export async function createCheckoutUrl(
  submissionId: string,
  planKey: WhopPlanKey = "deck"
): Promise<string | null> {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${WHOP_API_BASE}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "payment",
      plan_id: planIdFor(planKey),
      metadata: { submission_id: submissionId },
      redirect_url: `${appUrl()}/thank-you?submission_id=${submissionId}`,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Whop checkout_configurations returned ${res.status}: ${(await res.text()).slice(0, 400)}`
    );
  }

  const body = (await res.json()) as { purchase_url?: string };
  if (!body.purchase_url) return null;

  // `purchase_url` is documented path-style (e.g. "/checkout/ch_xxx/").
  return new URL(body.purchase_url, WHOP_SITE).toString();
}

// ── Webhook verification (Standard Webhooks) ──────────────────────────────
//
// Whop sends `webhook-id`, `webhook-timestamp` and `webhook-signature`, and
// signs `{id}.{timestamp}.{raw body}` with HMAC-SHA256, base64-encoded, in a
// `v1,<signature>` header that may hold several space-separated entries during
// a secret rotation.
//
// The previous implementation read a `whop-signature` header that Whop never
// sends, hex-decoded a base64 value and signed the body alone — so every
// delivery was rejected with a 401.

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export type WhopVerifyFailure =
  | "missing_headers"
  | "stale_timestamp"
  | "bad_signature";

export type WhopVerifyResult =
  | { ok: true }
  | { ok: false; reason: WhopVerifyFailure };

/**
 * Whop's docs say to pass the `ws_...` secret through as-is, while the wider
 * Standard Webhooks convention base64-decodes the part after the prefix. Which
 * one is right depends on how the secret was stored, so try every reading —
 * each still requires holding the secret, so accepting any of them does not
 * weaken the check.
 */
function candidateKeys(secret: string): Buffer[] {
  const keys: Buffer[] = [Buffer.from(secret, "utf8")];
  const underscore = secret.indexOf("_");
  if (underscore > 0 && underscore < secret.length - 1) {
    const rest = secret.slice(underscore + 1);
    keys.push(Buffer.from(rest, "utf8"));
    const decoded = Buffer.from(rest, "base64");
    if (decoded.length > 0) keys.push(decoded);
  }
  return keys;
}

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyWhopWebhook(
  rawBody: string,
  headers: {
    id?: string | null;
    timestamp?: string | null;
    signature?: string | null;
  },
  secret: string,
  now: number = Date.now()
): WhopVerifyResult {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing_headers" };

  // `webhook-timestamp` is unix seconds. Reject anything more than five minutes
  // out, in either direction, so a captured delivery can't be replayed.
  const sentAtMs = Number(timestamp) * 1000;
  if (!Number.isFinite(sentAtMs) || Math.abs(now - sentAtMs) > FIVE_MINUTES_MS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const signedPayload = `${id}.${timestamp}.${rawBody}`;
  const expected = candidateKeys(secret).map(key =>
    crypto.createHmac("sha256", key).update(signedPayload).digest("base64")
  );

  // Header form: "v1,<sig> v1,<sig>" — ignore versions we don't know.
  const presented = signature
    .split(" ")
    .map(part => part.trim())
    .filter(part => part.startsWith("v1,"))
    .map(part => part.slice(3));

  for (const candidate of presented) {
    if (expected.some(value => equals(value, candidate))) return { ok: true };
  }
  return { ok: false, reason: "bad_signature" };
}

export function signWhopWebhook(
  rawBody: string,
  id: string,
  timestampSeconds: number,
  secret: string
): string {
  const key = candidateKeys(secret)[0];
  const digest = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestampSeconds}.${rawBody}`)
    .digest("base64");
  return `v1,${digest}`;
}

// ── Event envelope ────────────────────────────────────────────────────────

export type WhopEvent = {
  /** Normalised event name, e.g. "payment.succeeded". */
  type: string;
  /** Whop's message id, used to make handling idempotent. */
  messageId: string | null;
  data: Record<string, unknown>;
};

/**
 * Normalise the two envelopes we may see. The current API sends
 * `{ id, type, data }`; webhooks still pinned to API v2 send `{ action, data }`
 * with the older event names. Accepting both means re-pinning the endpoint in
 * Whop can't silently stop payments being recorded.
 */
const LEGACY_EVENT_NAMES: Record<string, string> = {
  "payment.completed": "payment.succeeded",
  "payment_succeeded": "payment.succeeded",
  "membership.went_valid": "membership.activated",
  "membership_went_valid": "membership.activated",
};

export function parseWhopEvent(parsed: Record<string, unknown>): WhopEvent {
  const rawType = (parsed.type ?? parsed.action ?? "") as string;
  return {
    type: LEGACY_EVENT_NAMES[rawType] ?? rawType,
    messageId: typeof parsed.id === "string" ? parsed.id : null,
    data: (parsed.data as Record<string, unknown>) ?? {},
  };
}

/** Events that mean "this person has paid for something". */
export function isPaymentEvent(type: string): boolean {
  return type === "payment.succeeded" || type === "membership.activated";
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Pull `metadata.submission_id` out of whichever shape the payload uses. */
export function submissionIdFrom(data: Record<string, unknown>): string | null {
  const containers = [
    data.metadata,
    data.checkout_metadata,
    (data.checkout_configuration as Record<string, unknown> | undefined)?.metadata,
    (data.membership as Record<string, unknown> | undefined)?.metadata,
    (data.plan as Record<string, unknown> | undefined)?.metadata,
  ];
  for (const container of containers) {
    if (container && typeof container === "object") {
      const found = asString((container as Record<string, unknown>).submission_id);
      if (found) return found;
    }
  }
  return null;
}

/** Best-effort payer email, used to match a payment with no usable metadata. */
export function payerEmailFrom(data: Record<string, unknown>): string | null {
  const direct =
    asString(data.user_email) ??
    asString(data.email) ??
    asString(data.customer_email) ??
    asString(data.receipt_email);
  if (direct) return direct;

  for (const key of ["user", "customer", "member", "buyer"]) {
    const nested = data[key];
    if (nested && typeof nested === "object") {
      const found = asString((nested as Record<string, unknown>).email);
      if (found) return found;
    }
  }
  return null;
}

/** Plan id on the payment, so a community subscription can flip `profiles.plan`. */
export function planIdFrom(data: Record<string, unknown>): string | null {
  return (
    asString(data.plan_id) ??
    asString((data.plan as Record<string, unknown> | undefined)?.id) ??
    asString((data.membership as Record<string, unknown> | undefined)?.plan_id)
  );
}
