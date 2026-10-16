import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// TEMPORARY: smoke test that server-side Sentry events reach the dashboard
// from a Vercel deployment. Remove once confirmed.
//
// Gated on ?key= matching VALUATION_SERVICE_KEY. Anything else (including an
// unset key) gets a plain 404 so the route is invisible to the outside world.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const serviceKey = process.env.VALUATION_SERVICE_KEY;
  const providedKey = request.nextUrl.searchParams.get('key');
  if (!serviceKey || !providedKey || providedKey !== serviceKey) {
    return new NextResponse(null, { status: 404 });
  }

  Sentry.captureMessage('valuation-engine sentry test');
  throw new Error('valuation-engine sentry test error');
}
