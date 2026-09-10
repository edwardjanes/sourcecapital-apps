import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { classifyUploadError } from "@/lib/errorHandler";
import { compressPdf } from "@/lib/compressPdf";

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

    const formData = await req.formData();

    const businessName = (formData.get("businessName") as string)?.trim();
    const website      = (formData.get("website") as string)?.trim();
    const country      = (formData.get("country") as string)?.trim();
    const file         = formData.get("deck") as File | null;

    // Validate required fields
    if (!businessName || !country) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Classify file errors before touching the DB
    if (!file || file.type !== "application/pdf" || file.size === 0 || file.size > 25 * 1024 * 1024) {
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
        status:        "pending",
      })
      .select("id")
      .single();

    if (dbError || !submission) {
      console.error("DB insert error:", dbError);
      return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
    }

    submissionId = submission.id;
    console.log(`[admin-submit] Created submission ${submissionId} for ${businessName}`);

    // 2. Compress PDF and upload to Supabase Storage
    let fileBuffer = await file.arrayBuffer();
    const filePath   = `${submissionId}/${file.name}`;

    try {
      const compressed = await compressPdf(fileBuffer);
      fileBuffer = compressed.data.buffer as ArrayBuffer;
      console.log(`[admin-submit] Compressed PDF: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.compressedBytes / 1024 / 1024).toFixed(1)}MB`);
    } catch (compressErr) {
      console.warn("[admin-submit] PDF compression failed, continuing with original:", compressErr);
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from("decks")
      .upload(filePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      const result = classifyUploadError(file, storageError.message);
      Sentry.captureException(new Error(storageError.message), {
        tags: { recovery_action: result.action, submission_id: submissionId },
        extra: { business_name: businessName, file_name: file.name, file_size: file.size },
      });
      await supabaseAdmin.from("deck_submissions").delete().eq("id", submissionId);
      return NextResponse.json({ error: result.user_facing_message, action: result.action }, { status: 500 });
    }

    // 3. Update record with file path
    await supabaseAdmin
      .from("deck_submissions")
      .update({ deck_file_path: filePath })
      .eq("id", submissionId);

    console.log(`[admin-submit] Upload complete for ${submissionId}`);

    return NextResponse.json({ id: submissionId });
  } catch (err) {
    console.error("Admin submit error:", err);
    if (submissionId) {
      await supabaseAdmin
        .from("deck_submissions")
        .update({ status: "error", error_message: "Upload failed" })
        .eq("id", submissionId);
    }
    return NextResponse.json({ error: "Something went wrong uploading your deck. Please try again!" }, { status: 500 });
  }
}
