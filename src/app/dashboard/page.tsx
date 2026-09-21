import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("first_name, plan, analyses_used")
    .eq("id", user.id)
    .single();

  // Fetch analysis history for this user
  const { data: analyses } = await supabaseAdmin
    .from("deck_submissions")
    .select("id, business_name, created_at, status, score, analysis_json")
    .eq("user_id", user.id)
    // Hide uploads that never finished (see /api/submit/confirm)
    .neq("status", "awaiting_upload")
    .order("created_at", { ascending: false })
    .limit(50);

  const firstName = profile?.first_name ?? user.email?.split("@")[0] ?? "there";
  const plan = profile?.plan ?? "free";
  const analysesUsed = profile?.analyses_used ?? 0;

  return (
    <DashboardClient
      firstName={firstName}
      plan={plan}
      analysesUsed={analysesUsed}
      analyses={analyses ?? []}
      userId={user.id}
      userEmail={user.email ?? ""}
    />
  );
}
