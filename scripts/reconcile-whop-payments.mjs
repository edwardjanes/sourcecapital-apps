#!/usr/bin/env node
//
// Reconcile Whop payments against deck_submissions.
//
// The webhook rejected every delivery with a 401 from the day it was written
// until 19 Oct 2026, so payments taken in that window were never recorded.
// This walks the Whop payments list and marks the matching submissions paid.
//
//   WHOP_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
//     node scripts/reconcile-whop-payments.mjs --since 2026-09-24
//
// Dry run by default: it prints what it would change and touches nothing.
// Add --apply once the list looks right.
//
// Matching mirrors the webhook: metadata.submission_id first, then the payer's
// email against their most recent unpaid submission. Anything it cannot match
// is listed at the end for you to place by hand — those are the ones worth
// looking at, not the ones it got right.

const WHOP_API = process.env.WHOP_API_BASE ?? "https://api.whop.com/api/v1";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const since = (args[args.indexOf("--since") + 1] ?? "2026-09-24").trim();

const whopKey = process.env.WHOP_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!whopKey || !supabaseUrl || !serviceKey) {
  console.error("Need WHOP_API_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const sb = async (path, init = {}) => {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
};

async function* whopPayments() {
  let after = null;
  for (;;) {
    const params = new URLSearchParams({ first: "50", created_after: new Date(since).toISOString() });
    if (after) params.set("after", after);
    const res = await fetch(`${WHOP_API}/payments?${params}`, {
      headers: { Authorization: `Bearer ${whopKey}` },
    });
    if (!res.ok) throw new Error(`Whop ${res.status}: ${await res.text()}`);
    const body = await res.json();
    for (const payment of body.data ?? []) yield payment;
    if (!body.page_info?.has_next_page) return;
    after = body.page_info.end_cursor;
  }
}

const matched = [];
const unmatched = [];
const alreadyPaid = [];

for await (const payment of whopPayments()) {
  // Only money actually collected.
  if (!payment.paid_at) continue;

  const email = payment.user?.email ?? null;
  const metaId = payment.metadata?.submission_id ?? null;
  const label = `${payment.id}  ${payment.paid_at}  ${payment.total ?? "?"} ${payment.currency ?? ""}  ${email ?? "no email"}`;

  let submission = null;
  if (metaId) {
    const rows = await sb(`deck_submissions?id=eq.${metaId}&select=id,email,business_name,paid`);
    submission = rows[0] ?? null;
  }
  if (!submission && email) {
    const rows = await sb(
      `deck_submissions?email=ilike.${encodeURIComponent(email)}&select=id,email,business_name,paid&order=created_at.desc&limit=1`
    );
    submission = rows[0] ?? null;
  }

  if (!submission) { unmatched.push(label); continue; }
  if (submission.paid) { alreadyPaid.push(`${label}  ->  ${submission.business_name}`); continue; }

  matched.push({ payment, submission, label });
}

console.log(`\nPayments since ${since} that are collected and match an unpaid submission: ${matched.length}`);
for (const { label, submission } of matched) {
  console.log(`  ${label}  ->  ${submission.business_name} (${submission.id})`);
}

if (alreadyPaid.length) {
  console.log(`\nAlready marked paid (nothing to do): ${alreadyPaid.length}`);
  for (const line of alreadyPaid) console.log(`  ${line}`);
}

if (unmatched.length) {
  console.log(`\nCould not be matched — place these by hand: ${unmatched.length}`);
  for (const line of unmatched) console.log(`  ${line}`);
}

if (!apply) {
  console.log("\nDry run. Re-run with --apply to write these to the database.");
  process.exit(0);
}

for (const { payment, submission } of matched) {
  await sb(`deck_submissions?id=eq.${submission.id}`, {
    method: "PATCH",
    body: JSON.stringify({ paid: true, whop_order_id: payment.id }),
  });
  console.log(`marked paid: ${submission.business_name} (${submission.id}) <- ${payment.id}`);
}
console.log(`\nDone. ${matched.length} submission(s) updated.`);
