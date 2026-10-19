import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  WhopPlanKey,
  createCheckoutUrl,
  whopCheckoutUrl,
} from "@/lib/whop";

// Single entry point for starting a Whop checkout.
//
// Whop's current API attaches custom metadata to a checkout configuration
// created server-side; the `?metadata[submission_id]=...` query param on a plain
// plan link is an API v2 behaviour and is not documented on the current API. So
// create the configuration here, and redirect to the plain link only if that
// fails — taking the payment matters more than attaching the metadata, and an
// unmatched payment can still be reconciled from the payer's email.

export const dynamic = "force-dynamic";

const PLANS: WhopPlanKey[] = ["deck", "pro", "community"];

export async function GET(req: NextRequest) {
  const submissionId = req.nextUrl.searchParams.get("submission_id") ?? "";
  const requested = req.nextUrl.searchParams.get("plan") ?? "deck";
  const plan = (PLANS as string[]).includes(requested)
    ? (requested as WhopPlanKey)
    : "deck";

  const fallback = whopCheckoutUrl(submissionId, plan);

  if (!submissionId) {
    // Nothing to attach — the plain link is all a checkout needs.
    return NextResponse.redirect(fallback, { status: 307 });
  }

  try {
    const url = await createCheckoutUrl(submissionId, plan);
    return NextResponse.redirect(url ?? fallback, { status: 307 });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { context: "whop_checkout" },
      extra: { submissionId, plan },
    });
    console.error("[whop/checkout] Falling back to a direct plan link:", err);
    return NextResponse.redirect(fallback, { status: 307 });
  }
}
