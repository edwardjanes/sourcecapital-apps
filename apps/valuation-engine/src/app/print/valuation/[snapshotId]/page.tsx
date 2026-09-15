import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import ReportClient from '@/app/companies/[id]/report/[snapshotId]/ReportClient';
import '../../../companies/[id]/report/print.css';

export default async function PrintReportPage({
  params,
}: {
  params: { snapshotId: string };
}) {
  const serviceKey = process.env.VALUATION_SERVICE_KEY;
  const providedKey = headers().get('x-service-key');

  // Same fail-closed posture as the compute route: an unset env var
  // must never silently open this page up.
  if (!serviceKey || !providedKey || providedKey !== serviceKey) {
    notFound();
  }

  const { data: snapshot } = await supabaseAdmin
    .from('valuation_snapshots')
    .select('*')
    .eq('id', params.snapshotId)
    .single();

  if (!snapshot) {
    notFound();
  }

  const { data: company } = await supabaseAdmin
    .from('valuation_companies')
    .select('*')
    .eq('id', snapshot.company_id)
    .single();

  if (!company) {
    notFound();
  }

  return <ReportClient snapshot={snapshot} company={company} />;
}
