import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CAL_BOOKING_URL, calBookingUrl } from "@/lib/bookCall";

// Redirects a report's "Book a call" CTA to Cal.com with the booker's details
// already filled in.
//
// The lookup happens here rather than in the browser so the submission's email
// never has to be returned by /api/status/[id], which is unauthenticated.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const submissionId = req.nextUrl.searchParams.get("submission_id");
  if (!submissionId) {
    return NextResponse.redirect(CAL_BOOKING_URL, { status: 307 });
  }

  try {
    const { data } = await supabaseAdmin
      .from("deck_submissions")
      .select("email, first_name, last_name")
      .eq("id", submissionId)
      .maybeSingle();

    const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
    return NextResponse.redirect(
      calBookingUrl({ submissionId, email: data?.email, name: name || null }),
      { status: 307 }
    );
  } catch (err) {
    // A failed lookup must not cost us the booking — send them to Cal.com with
    // the submission id attached and nothing prefilled.
    Sentry.captureException(err, {
      tags: { context: "book_call" },
      extra: { submissionId },
    });
    return NextResponse.redirect(calBookingUrl({ submissionId }), { status: 307 });
  }
}
