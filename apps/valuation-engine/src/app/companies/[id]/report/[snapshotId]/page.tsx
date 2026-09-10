import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import ReportClient from './ReportClient';
import '../print.css';

export default async function ReportPage({
  params,
}: {
  params: { id: string; snapshotId: string };
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently fail
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Verify ownership
  const { data: company } = await supabase
    .from('valuation_companies')
    .select('*')
    .eq('id', params.id)
    .eq('owner_id', user.id)
    .single();

  if (!company) {
    redirect('/dashboard');
  }

  // Fetch snapshot
  const { data: snapshot } = await supabase
    .from('valuation_snapshots')
    .select('*')
    .eq('id', params.snapshotId)
    .eq('company_id', params.id)
    .single();

  if (!snapshot) {
    redirect(`/companies/${params.id}/edit`);
  }

  return <ReportClient snapshot={snapshot} company={company} />;
}
