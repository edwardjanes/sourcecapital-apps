import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AWAITING_UPLOAD } from "@/lib/deckUpload";

export const maxDuration = 30;

// Step 3 of the deck upload: the browser has uploaded the PDF straight to the
// `decks` bucket, so check the object exists and release the submission for analysis.
export async function POST(req: NextRequest) {
  let submissionId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    submissionId = typeof body.id === "string" ? body.id : undefined;
    if (!submissionId) {
      return NextResponse.json({ error: "Missing submission ID" }, { status: 400 });
    }

    const { data: submission } = await supabaseAdmin
      .from("deck_submissions")
      .select("id, status, user_id")
      .eq("id", submissionId)
      .maybeSingle();

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Already confirmed (e.g. a double click) — treat as success.
    if (submission.status !== AWAITING_UPLOAD) {
      return NextResponse.json({ id: submissionId });
    }

    const { data: objects, error: listError } = await supabaseAdmin.storage
      .from("decks")
      .list(submissionId);

    if (listError) throw listError;

    const deck = objects?.find(o => o.name.toLowerCase().endsWith(".pdf"));
    if (!deck) {
      return NextResponse.json(
        { error: "We couldn't find your uploaded deck. Please try uploading it again." },
        { status: 409 },
      );
    }

    const deckFilePath = `${submissionId}/${deck.name}`;

    // Conditional on status so two concurrent confirms can't both proceed.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("deck_submissions")
      .update({ deck_file_path: deckFilePath, status: "pending" })
      .eq("id", submissionId)
      .eq("status", AWAITING_UPLOAD)
      .select("id");

    if (updateError) throw updateError;

    // Count the analysis only once the upload has actually landed.
    if (updated?.length && submission.user_id) {
      await supabaseAdmin.rpc("increment_analyses_used", { user_id_input: submission.user_id });
    }

    return NextResponse.json({ id: submissionId });
  } catch (err) {
    console.error("Submit confirm error:", err);
    Sentry.captureException(err, {
      tags: { type: "submit_confirm_uncaught" },
      extra: { submission_id: submissionId },
    });
    return NextResponse.json(
      { error: "Something went wrong finishing your upload. Please try again!" },
      { status: 500 },
    );
  }
}
