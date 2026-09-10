"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const COUNTRIES = [
  "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile", "China",
  "Colombia", "Czech Republic", "Denmark", "Egypt", "Finland", "France",
  "Germany", "Ghana", "Greece", "Hong Kong", "Hungary", "India", "Indonesia",
  "Ireland", "Israel", "Italy", "Japan", "Kenya", "Malaysia", "Mexico",
  "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan", "Philippines",
  "Poland", "Portugal", "Romania", "Saudi Arabia", "Singapore", "South Africa",
  "South Korea", "Spain", "Sweden", "Switzerland", "Taiwan", "Thailand",
  "Turkey", "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
  "Vietnam", "Other",
];

export default function AdminUploadPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const [formData, setFormData] = useState({
    businessName: "",
    website: "",
    country: "",
  });

  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Fetch profile to check sc_admin flag
        const { data: profile } = await supabase
          .from("profiles")
          .select("sc_admin")
          .eq("id", user.id)
          .single();

        if (!profile?.sc_admin) {
          setError("You do not have admin access");
          setIsChecking(false);
          return;
        }

        setIsAdmin(true);
        setError("");
      } catch (err) {
        console.error("Admin check error:", err);
        setError("Failed to verify admin status");
      } finally {
        setIsChecking(false);
      }
    };

    checkAdmin();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        setError("Please upload a PDF file");
        return;
      }
      if (selectedFile.size > 25 * 1024 * 1024) {
        setError("File must be smaller than 25MB");
        return;
      }
      setFile(selectedFile);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessId("");

    if (!formData.businessName || !formData.country || !file) {
      setError("Please fill in all required fields and select a PDF");
      return;
    }

    setIsLoading(true);

    try {
      const submitFormData = new FormData();
      submitFormData.append("businessName", formData.businessName);
      submitFormData.append("website", formData.website);
      submitFormData.append("country", formData.country);
      submitFormData.append("deck", file);

      const response = await fetch("/api/admin/submit", {
        method: "POST",
        body: submitFormData,
      });

      const text = await response.text();
      console.log("API response:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error("Failed to parse JSON:", parseErr, "Response was:", text);
        setError(`Server error: ${text.substring(0, 150)}`);
        return;
      }

      if (!response.ok) {
        setError(data.message || data.error || "Failed to upload deck");
        return;
      }

      setSuccessId(data.id);
      setFormData({ businessName: "", website: "", country: "" });
      setFile(null);

      // Auto-trigger analysis
      setTimeout(() => {
        fetch(`/api/analyse/${data.id}`, { method: "POST" }).catch(() => {
          // Analysis will trigger on the backend
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", padding: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#888888" }}>Checking admin access...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", padding: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ backgroundColor: "#111111", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "40px", maxWidth: "400px", textAlign: "center" }}>
          <h1 style={{ color: "#ff6b6b", marginBottom: "16px" }}>Access Denied</h1>
          <p style={{ color: "#888888", marginBottom: "20px" }}>
            {error || "You do not have admin access to this page."}
          </p>
          <a href="/dashboard" style={{ color: "#2563eb", textDecoration: "none" }}>
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", padding: "20px" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ color: "#FFFFFF", marginBottom: "8px", fontSize: "28px" }}>Internal Deck Upload</h1>
        <p style={{ color: "#888888", marginBottom: "32px" }}>Upload a customer's pitch deck for analysis</p>

        {successId && (
          <div style={{
            backgroundColor: "#1a3a2a",
            border: "1px solid #2d5a47",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "24px",
          }}>
            <p style={{ color: "#4ade80", marginBottom: "8px", fontWeight: "600" }}>✓ Upload successful!</p>
            <p style={{ color: "#888888", marginBottom: "12px" }}>Submission ID: <code style={{ color: "#4ade80" }}>{successId}</code></p>
            <p style={{ color: "#888888", fontSize: "14px" }}>
              Analysis is running. You can view results below.
            </p>
            <a
              href={`/investment-score/results/${successId}`}
              style={{
                display: "inline-block",
                marginTop: "12px",
                color: "#4ade80",
                textDecoration: "none",
                fontSize: "14px",
              }}
            >
              View Results →
            </a>
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: "#3a1a1a",
            border: "1px solid #5a2d2d",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "24px",
            color: "#ff6b6b",
            fontSize: "14px",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{
          backgroundColor: "#111111",
          border: "1px solid #2a2a2a",
          borderRadius: "8px",
          padding: "24px",
        }}>
          {/* Business Name */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", color: "#FFFFFF", marginBottom: "8px", fontSize: "14px", fontWeight: "600" }}>
              Business Name *
            </label>
            <input
              type="text"
              name="businessName"
              value={formData.businessName}
              onChange={handleInputChange}
              placeholder="Acme Inc"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                backgroundColor: "#0A0A0A",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                color: "#FFFFFF",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Website */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", color: "#FFFFFF", marginBottom: "8px", fontSize: "14px", fontWeight: "600" }}>
              Website
            </label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              placeholder="https://acme.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                backgroundColor: "#0A0A0A",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                color: "#FFFFFF",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Country */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", color: "#FFFFFF", marginBottom: "8px", fontSize: "14px", fontWeight: "600" }}>
              Country *
            </label>
            <select
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                backgroundColor: "#0A0A0A",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                color: formData.country ? "#FFFFFF" : "#888888",
                fontSize: "14px",
                boxSizing: "border-box",
                cursor: "pointer",
              }}
            >
              <option value="" disabled>Select your country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c} style={{ background: "#0A0A0A", color: "#FFFFFF" }}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* PDF Upload */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", color: "#FFFFFF", marginBottom: "8px", fontSize: "14px", fontWeight: "600" }}>
              Pitch Deck (PDF) *
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              required
              style={{
                display: "block",
                width: "100%",
                padding: "10px 12px",
                backgroundColor: "#0A0A0A",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                color: "#FFFFFF",
                fontSize: "14px",
                cursor: "pointer",
              }}
            />
            {file && <p style={{ color: "#888888", fontSize: "12px", marginTop: "8px" }}>Selected: {file.name}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: isLoading ? "#444444" : "#2563eb",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "Uploading..." : "Upload & Analyze"}
          </button>
        </form>

        <p style={{ color: "#666666", fontSize: "12px", marginTop: "16px", textAlign: "center" }}>
          This page is for internal use only.
        </p>
      </div>
    </div>
  );
}
