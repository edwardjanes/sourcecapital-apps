"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { DeckAnalysis } from "@/lib/deckPrompt";
import { ReportLayout } from "@/components/report/ReportLayout";

interface SubmissionDetail {
  id: string;
  business_name: string;
  score: number;
  verdict: string;
  verdict_type: "pass" | "review" | "flag";
  most_damaging_issue: string;
  best_asset: string;
  analysis_json: DeckAnalysis;
  created_at: string;
  deck_file_path: string | null;
  status: string;
  error_message?: string;
}

export default function AdminSubmissionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("sc_admin")
          .eq("id", user.id)
          .single();

        if (!profile?.sc_admin) {
          setError("Admin access required");
          setLoading(false);
          return;
        }

        setIsAdmin(true);

        const response = await fetch(`/api/status/${id}`);
        const text = await response.text();

        let result;
        try {
          result = JSON.parse(text);
        } catch {
          console.error("Failed to parse response:", text);
          setError("Failed to load submission");
          setLoading(false);
          return;
        }

        if (!response.ok || !result) {
          setError("Submission not found");
          setLoading(false);
          return;
        }

        setData(result);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading submission");
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [id, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", color: "#F8FAFC" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: "440px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>Not Found</h1>
          <p style={{ fontSize: "16px", color: "#6B7280", marginBottom: "24px" }}>{error || "Something went wrong. Please try again."}</p>
          <a href="/admin/submissions" style={{ display: "inline-block", padding: "11px 24px", background: "#03fb83", borderRadius: "8px", color: "#000", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>Back to Submissions</a>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;
  if (!data.analysis_json) return null;

  return (
    <ReportLayout
      data={data}
      hidePaywall={true}
      backUrl="/admin/submissions"
      showBackButton={true}
    />
  );
}
