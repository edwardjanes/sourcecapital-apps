import * as Sentry from "@sentry/nextjs";
import { supabase } from "@/lib/supabase";
import { classifyUploadError, MAX_DECK_BYTES } from "@/lib/errorHandler";

// Browser-side deck submission, shared by every upload page.
//
// 1. POST metadata (no file bytes) to the submit endpoint → { id, path, token }
// 2. Upload the PDF straight to the `decks` bucket with the signed upload token
// 3. POST /api/submit/confirm → the row moves from awaiting_upload to pending
//
// The file never passes through a Vercel function, so its ~4.5 MB request body
// limit no longer applies. Errors are thrown with a message safe to show users.

export type SubmitDeckResult =
  | { status: "ok"; id: string }
  | { status: "free_limit"; existingSubmissionId: string };

type SubmitDeckOptions = {
  file: File;
  fields: Record<string, string>;
  endpoint?: "/api/submit" | "/api/admin/submit";
};

export async function submitDeck({ file, fields, endpoint = "/api/submit" }: SubmitDeckOptions): Promise<SubmitDeckResult> {
  if (file.type !== "application/pdf" || file.size === 0 || file.size > MAX_DECK_BYTES) {
    throw new Error(classifyUploadError(file).user_facing_message);
  }

  // 1. Create the submission and get a signed upload URL
  const created = await postJson(endpoint, {
    ...fields,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  if (created.data.error === "free_limit_reached") {
    return { status: "free_limit", existingSubmissionId: String(created.data.existingSubmissionId) };
  }
  if (!created.ok) throw new Error(errorMessage(created.data, "Submission failed. Please try again."));

  const { id, path, token } = created.data as { id: string; path: string; token: string };

  // 2. Upload the PDF directly to Storage
  const { error: uploadError } = await supabase.storage
    .from("decks")
    .uploadToSignedUrl(path, token, file, { contentType: "application/pdf" });

  if (uploadError) {
    const result = classifyUploadError(file, uploadError.message);
    Sentry.captureException(uploadError, {
      tags: { type: "deck_direct_upload", recovery_action: result.action, submission_id: id },
      extra: { file_name: file.name, file_size: file.size },
    });
    throw new Error(result.user_facing_message);
  }

  // 3. Confirm the upload so analysis can start
  const confirmed = await postJson("/api/submit/confirm", { id });
  if (!confirmed.ok) throw new Error(errorMessage(confirmed.data, "We couldn't finish your upload. Please try again."));

  return { status: "ok", id };
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

// Checks the status and content type before parsing, so a plain-text platform
// error (e.g. a 413 or 502 page) becomes a readable message instead of a
// SyntaxError, and gets reported to Sentry since the server never saw it.
async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("We couldn't reach our servers. Please check your connection and try again.");
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (isJson) {
    try {
      return { ok: res.ok, status: res.status, data: await res.json() };
    } catch {
      // fall through to the non-JSON handling below
    }
  }

  const snippet = await res.text().catch(() => "");
  Sentry.captureMessage(`Non-JSON response from ${url}`, {
    level: "error",
    tags: { type: "submit_non_json_response", status: String(res.status) },
    extra: { url, status: res.status, body: snippet.slice(0, 500) },
  });

  if (res.status === 413) {
    throw new Error("Your file is too large to upload. Please compress your deck and try again.");
  }
  throw new Error(`Something went wrong on our side (error ${res.status}). Please try again in a moment.`);
}
