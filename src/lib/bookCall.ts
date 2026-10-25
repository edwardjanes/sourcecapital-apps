// "Book a call with Edward" — the link, and what makes a booking traceable
// back to the deck that produced it.
//
// The join key is the attendee's email: Cal.com prefills `email` from the query
// string, so a booking made from a report carries the same address as
// `deck_submissions.email` and the two can be matched directly. UTM parameters
// mark where the booking came from, and `metadata[submission_id]` carries the
// exact submission on the webhook payload for anything that wants an exact
// join rather than an email one.

export const CAL_BOOKING_URL = "https://cal.com/edward-janes/60-min";
export const BOOKING_SOURCE = "deck-review";

export type BookCallPrefill = {
  submissionId: string;
  email?: string | null;
  name?: string | null;
};

export function calBookingUrl({ submissionId, email, name }: BookCallPrefill): string {
  const params = new URLSearchParams({
    utm_source: BOOKING_SOURCE,
    utm_medium: "report",
    utm_campaign: "deck-review-call",
    source: BOOKING_SOURCE,
    "metadata[submission_id]": submissionId,
  });
  if (email) params.set("email", email);
  if (name) params.set("name", name);
  return `${CAL_BOOKING_URL}?${params.toString()}`;
}

/** Where the report's CTA points. The email is filled in server-side. */
export function bookCallHref(submissionId: string): string {
  return `/api/book-call?submission_id=${encodeURIComponent(submissionId)}`;
}
