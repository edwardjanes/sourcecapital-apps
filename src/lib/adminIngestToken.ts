import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

// Lets scripted callers (the deck-funnel-submit skill) use /api/admin/submit
// without an sc_admin browser session, by sending
//   Authorization: Bearer <ADMIN_INGEST_TOKEN>
// Disabled unless ADMIN_INGEST_TOKEN is set (32+ characters). Only
// /api/admin/submit accepts it — no other admin route does.
export function hasAdminIngestToken(req: NextRequest): boolean {
  const expected = process.env.ADMIN_INGEST_TOKEN;
  if (!expected || expected.length < 32) return false;

  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;

  const given = Buffer.from(header.slice("Bearer ".length).trim());
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}
