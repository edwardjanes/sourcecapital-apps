// Deck report checkout.
//
// Two genuine one-time Whop plans sell the same product (the full report for
// one submission): the early price within 24h of the analysis, the full price
// after that. Both are verified against the Whop dashboard — keep the price
// strings and the plan IDs in step, or use the env vars below.
//
// The community plan (see src/app/upsell/page.tsx) is a separate, recurring
// product and must never be used for report checkout.

const EARLY_PLAN_ID = process.env.NEXT_PUBLIC_WHOP_PLAN_ID ?? "plan_AUP8u87FOYnEZ";
const FULL_PLAN_ID = process.env.NEXT_PUBLIC_WHOP_PLAN_ID_PRO ?? "plan_7LlelIvBnFah9";

export const DECK_EARLY_PRICE = process.env.NEXT_PUBLIC_WHOP_DECK_EARLY_PRICE ?? "$7";
export const DECK_FULL_PRICE = process.env.NEXT_PUBLIC_WHOP_DECK_FULL_PRICE ?? "$97";

export const OFFER_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isOfferExpired(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  return Date.now() > new Date(createdAt).getTime() + OFFER_WINDOW_MS;
}

export function deckPrice(expired: boolean): string {
  return expired ? DECK_FULL_PRICE : DECK_EARLY_PRICE;
}

// The price shown on the page and the plan charged at checkout are derived
// from the same `expired` flag, so they can't disagree.
export function deckCheckoutUrl(submissionId: string, expired: boolean): string {
  const planId = expired ? FULL_PLAN_ID : EARLY_PLAN_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sourcecapital.co.uk";
  const params = new URLSearchParams({
    "metadata[submission_id]": submissionId,
    // Bring the buyer back so they land on their unlocked report instead of
    // being left on Whop's own confirmation page.
    redirect_url: `${appUrl}/thank-you?submission_id=${submissionId}`,
  });
  return `https://whop.com/checkout/${planId}/?${params.toString()}`;
}
