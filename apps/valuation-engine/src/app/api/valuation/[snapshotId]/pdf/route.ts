import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { renderAndUploadReportPdf } from '@/lib/valuation/pdf';

export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { snapshotId: string } }
) {
  const serviceKey = process.env.VALUATION_SERVICE_KEY;
  if (!serviceKey) {
    console.error('VALUATION_SERVICE_KEY is not set -- refusing all requests to /api/valuation/[snapshotId]/pdf');
    return unauthorized();
  }
  const providedKey = request.headers.get('x-service-key');
  if (!providedKey || providedKey !== serviceKey) {
    return unauthorized();
  }

  const { snapshotId } = params;

  const { data: snapshot, error: findError } = await supabaseAdmin
    .from('valuation_snapshots')
    .select('id')
    .eq('id', snapshotId)
    .maybeSingle();

  if (findError) {
    console.error('Snapshot lookup error:', findError);
    return NextResponse.json({ error: 'Failed to look up snapshot' }, { status: 500 });
  }
  if (!snapshot) {
    return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
  }

  const reportUrl = await renderAndUploadReportPdf(snapshotId, request.nextUrl.origin);

  if (!reportUrl) {
    return NextResponse.json({ error: 'PDF render failed -- see server logs' }, { status: 502 });
  }

  return NextResponse.json({ snapshotId, reportUrl });
}
