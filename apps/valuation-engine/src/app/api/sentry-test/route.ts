import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// TEMPORARY: smoke test that server-side Sentry events reach the dashboard
// from a Vercel deployment. Remove once confirmed.
//
// Gated on VALUATION_SERVICE_KEY, passed as ?key= or the x-service-key header
// (the same header n8n uses). Surrounding whitespace is ignored on both sides
// so a stray space or newline from copying does not block the test. Distinct
// status codes say which check failed without revealing anything about the key.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const serviceKey = process.env.VALUATION_SERVICE_KEY?.trim();
  if (!serviceKey) {
    return NextResponse.json({ error: 'VALUATION_SERVICE_KEY is not set on this deployment' }, { status: 503 });
  }

  const providedKey = (
    request.nextUrl.searchParams.get('key') ?? request.headers.get('x-service-key') ?? ''
  ).trim();
  if (!providedKey) {
    return NextResponse.json({ error: 'No key supplied' }, { status: 401 });
  }
  if (providedKey !== serviceKey) {
    return NextResponse.json({ error: 'Key does not match' }, { status: 403 });
  }

  Sentry.captureMessage('valuation-engine sentry test');
  throw new Error('valuation-engine sentry test error');
}
