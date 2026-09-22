import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { classifyUploadError } from "@/lib/errorHandler";
import { AWAITING_UPLOAD, createDeckUploadUrl, isValidDeckFile, readDeclaredFile } from "@/lib/deckUpload";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let submissionId: string | undefined;

  try {
    // Verify the caller is an authenticated sc_admin before doing anything else
    const cookieHeader = req.headers.get("cookie") || "";
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            return cookieHeader.split("; ").filter(Boolean).map((c) => {
              const [name, value] = c.split("=");
              return { name, value };
            });
          },
          setAll: () => {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("sc_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.sc_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // JSON metadata only — the PDF is uploaded straight to Storage by the
    // browser (see src/lib/submitDeck.ts) to stay under Vercel's body limit.
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const country      = typeof body.country === "string" ? body.country.trim() : "";
    const file         = readDeclaredFile(body);

    // Validate required fields
    if (!businessName || !country) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Classify file errors before touching the DB
    if (!isValidDeckFile(file)) {
      const result = classifyUploadError(file);
      return NextResponse.json({ error: result.user_facing_message, action: result.action }, { status: 400 });
    }

    // 1. Create submission record
    const { data: submission, error: dbError } = await supabaseAdmin
      .from("deck_submissions")
      .insert({
        first_name:    "Admin",
        last_name:     "Upload",
        email:         "admin@sourcecapital.co.uk",
        business_name: businessName,
        country,
        status:        AWAITING_UPLOAD,
      })
      .select("id")
      .single();

    if (dbError || !submission) {
      console.error("DB insert error:", dbError);
      return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
    }

    submissionId = submission.id;
    console.log(`[admin-submit] Created submission ${submissionId} for ${businessName}`);

    // 2. Signed URL for the direct upload. No compression here: /api/analyse
    // compresses the stored PDF before sending it to Claude.
    try {
      const { path, token } = await createDeckUploadUrl(submissionId!, file.name);
      return NextResponse.json({ id: submissionId, path, token });
    } catch (storageError) {
      const message = storageError instanceof Error ? storageError.message : String(storageError);
      console.error("Signed upload URL error:", storageError);
      const result = classifyUploadError(file, message);
      Sentry.captureException(storageError, {
        tags: { recovery_action: result.action, submission_id: submissionId },
        extra: { business_name: businessName, file_name: file.name, file_size: file.size },
      });
      await supabaseAdmin.from("deck_submissions").delete().eq("id", submissionId);
      return NextResponse.json({ error: result.user_facing_message, action: result.action }, { status: 500 });
    }
  } catch (err) {
    console.error("Admin submit error:", err);
    Sentry.captureException(err, { tags: { type: "admin_submit_route_uncaught" }, extra: { submission_id: submissionId } });
    if (submissionId) {
      await supabaseAdmin
        .from("deck_submissions")
        .update({ status: "error", error_message: "Upload failed" })
        .eq("id", submissionId);
    }
    return NextResponse.json({ error: "Something went wrong uploading your deck. Please try again!" }, { status: 500 });
  }
}
