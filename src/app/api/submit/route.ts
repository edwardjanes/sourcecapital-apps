import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { classifyUploadError } from "@/lib/errorHandler";
import { createOrUpdateContact as createGHLContact } from "@/lib/ghl";
import { createOrUpdateContact as createLoopsContact } from "@/lib/loops";
import { AWAITING_UPLOAD, createDeckUploadUrl, isValidDeckFile, readDeclaredFile } from "@/lib/deckUpload";

export const maxDuration = 60;

// Step 1 of the deck upload. Receives JSON metadata only — the PDF itself goes
// straight from the browser to Storage (see src/lib/submitDeck.ts), because
// Vercel rejects function request bodies over ~4.5 MB before the route runs.
export async function POST(req: NextRequest) {
  let submissionId: string | undefined;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const str = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");
    const firstName    = str("firstName");
    const lastName     = str("lastName");
    const email        = str("email").toLowerCase();
    const businessName = str("businessName");
    const website      = str("website");
    const country      = str("country");
    const file         = readDeclaredFile(body);
    const userId       = str("userId") || null;

    // Email is optional for logged-in users (userId present)
    if (!firstName || !businessName || !country || (!userId && !email)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check free submission limit (1 free submission per user/email)
    {
      let existingQuery = supabaseAdmin
        .from("deck_submissions")
        .select("id, status, score")
        // An abandoned direct upload leaves an awaiting_upload row; it must not
        // use up the free analysis (the old flow deleted the row on failure).
        .neq("status", AWAITING_UPLOAD)
        .limit(1);

      if (userId) {
        existingQuery = existingQuery.eq("user_id", userId);
      } else if (email) {
        existingQuery = existingQuery.eq("email", email);
      }

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        // Check if user is on pro plan
        let isPro = false;
        if (userId) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("plan")
            .eq("id", userId)
            .single();
          isPro = profile?.plan === "pro";
        }

        if (!isPro) {
          return NextResponse.json({
            error: "free_limit_reached",
            message: "You've used your 1 free deck analysis. Upgrade to Pro for unlimited analyses.",
            existingSubmissionId: existing.id,
          }, { status: 403 });
        }
      }
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
        first_name:    firstName,
        last_name:     lastName,
        email:         email || null,
        business_name: businessName,
        website:       website || null,
        country,
        status:        AWAITING_UPLOAD,
        ...(userId ? { user_id: userId } : {}),
      })
      .select("id")
      .single();

    if (dbError || !submission) {
      console.error("DB insert error:", dbError);
      return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
    }

    submissionId = submission.id;

    // Sync contact to both GHL and Loops (non-blocking)
    if (email) {
      // Push to GHL
      if (submissionId) {
        createGHLContact({
          email,
          firstName,
          lastName: lastName ?? "",
          customFieldValues: [
            { id: "hQDLWShDeKgJBbTYWc9m", value: submissionId },
          ],
        }).catch(err => {
          console.error("[ghl] Contact error:", err);
          Sentry.captureException(err, {
            tags: { type: "ghl_contact_sync" },
            extra: { email, firstName, lastName, businessName },
          });
        });
      }

      // Push to Loops
      if (submissionId) {
        createLoopsContact({
          email,
          firstName,
          lastName: lastName ?? "",
          userGroup: "Pitch Deck Review",
          customProperties: {
            deckSubmissionId: submissionId,
            deckBusinessName: businessName,
            deckWebsite: website,
            deckCountry: country,
          },
        }).catch(err => {
          console.error("[loops] Contact error:", err);
          Sentry.captureException(err, {
            tags: { type: "loops_contact_sync" },
            extra: { email, firstName, lastName, businessName },
          });
        });
      }
    }

    // 2. Signed URL so the browser can upload the PDF directly to Storage
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
    console.error("Submit error:", err);
    Sentry.captureException(err, { tags: { type: "submit_route_uncaught" }, extra: { submission_id: submissionId } });
    if (submissionId) {
      await supabaseAdmin
        .from("deck_submissions")
        .update({ status: "error", error_message: "Upload failed" })
        .eq("id", submissionId);
    }
    return NextResponse.json({ error: "Something went wrong uploading your deck. Please try again!" }, { status: 500 });
  }
}
