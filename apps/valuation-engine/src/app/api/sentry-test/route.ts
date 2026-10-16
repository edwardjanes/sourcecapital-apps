import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// TEMPORARY: smoke test that server-side Sentry events reach the dashboard
// from a Vercel deployment. Remove once confirmed.
//
// Gated on VALUATION_SERVICE_KEY, passed as ?key= or the x-service-key header
// (the same header n8n uses). Surrounding whitespace is ignored on both sides
// so a stray space or newline from copying does not block the test. Distinct
// status codes say which check failed without revealing anything about the key.
//
// ?mode=status reports whether the server-side Sentry client is initialised
// instead of throwing. The default mode flushes the captured message before
// throwing, so a function frozen straight after the response cannot lose it.

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

  if (request.nextUrl.searchParams.get('mode') === 'status') {
    const client = Sentry.getClient();
    const options = client?.getOptions();
    return NextResponse.json({
      clientInitialised: Boolean(client),
      dsnHost: options?.dsn ? new URL(options.dsn).host : null,
      sdkVersion: client?.getSdkMetadata()?.sdk?.version ?? null,
      environment: options?.environment ?? null,
      runtime: process.env.NEXT_RUNTIME ?? null,
      nodeVersion: process.version,
    });
  }

  const eventId = Sentry.captureMessage('valuation-engine sentry test');
  const flushed = await Sentry.flush(5000);
  console.log(`sentry-test: captured ${eventId}, flushed=${flushed}`);
  throw new Error('valuation-engine sentry test error');
}
