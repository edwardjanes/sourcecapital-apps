import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: companies } = await supabase
    .from("valuation_companies")
    .select("id, name, industry, stage, report_status, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  const companyIds = (companies || []).map((c) => c.id);

  const { data: snapshots } = companyIds.length
    ? await supabase
        .from("valuation_snapshots")
        .select("id, company_id, label, created_at, is_current")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const companiesWithSnapshots = (companies || []).map((company) => ({
    ...company,
    snapshots: (snapshots || []).filter((s) => s.company_id === company.id),
  }));

  return <DashboardClient user={user} companies={companiesWithSnapshots} />;
}
