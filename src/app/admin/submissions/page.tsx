"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Link from "next/link";

interface Submission {
  id: string;
  business_name: string;
  score: number;
  verdict: string;
  created_at: string;
  status: string;
  user_id: string;
}

const GREEN = "#03fb83";
const CARD_BG = "#161616";
const CARD_BORDER = "#242424";
const MUTED = "#6B7280";

export default function AdminSubmissionsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  async function checkAuthAndLoad() {
    try {
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

      const { data, error: queryError } = await supabase
        .from("deck_submissions")
        .select("id, business_name, score, verdict, created_at, status, user_id")
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;
      setSubmissions(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading submissions");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", color: "#F8FAFC" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", color: "#F8FAFC" }}>
        <p style={{ color: "#EF4444" }}>{error}</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  const verdictColor = (type: string) => {
    const colors: Record<string, string> = {
      pass: "#10B981",
      review: "#FBBF24",
      flag: "#EF4444",
    };
    return colors[type] || MUTED;
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", color: "#F8FAFC", padding: "40px 24px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "32px" }}>📋 All Submissions</h1>

        {submissions.length === 0 ? (
          <p style={{ color: MUTED }}>No submissions found</p>
        ) : (
          <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${CARD_BORDER}`, background: "#1a1a1a" }}>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: MUTED }}>Business</th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: MUTED }}>Score</th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: MUTED }}>Verdict</th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: MUTED }}>Status</th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: MUTED }}>Date</th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: MUTED }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                    <td style={{ padding: "16px", fontWeight: 600 }}>{sub.business_name}</td>
                    <td style={{ padding: "16px", textAlign: "center", fontWeight: 700 }}>{Math.round(sub.score)}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <span style={{ padding: "4px 8px", background: verdictColor(sub.verdict) + "20", color: verdictColor(sub.verdict), fontSize: "11px", fontWeight: 600, borderRadius: "4px" }}>
                        {sub.verdict}
                      </span>
                    </td>
                    <td style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: MUTED }}>{sub.status}</td>
                    <td style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: MUTED }}>{new Date(sub.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <Link href={`/admin/submissions/${sub.id}`} style={{ color: GREEN, textDecoration: "none", fontWeight: 600 }}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
