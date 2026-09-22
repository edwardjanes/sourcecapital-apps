export type RecoveryAction =
  | "AUTO_RETRY"
  | "REQUEST_REUPLOAD"
  | "PARTIAL_SUCCESS"
  | "ESCALATE_TO_SUPPORT"
  | "FAIL_GRACEFULLY";

export interface ErrorResult {
  action: RecoveryAction;
  user_facing_message: string;
  technical_detail: string;
}

// Tags stored in DB error_message so the frontend can parse them
export interface StoredError {
  action: RecoveryAction;
  message: string;
  technical: string;
  attempt?: number;
}

export function parseStoredError(raw: string | null | undefined): StoredError | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.action && parsed.message) return parsed as StoredError;
  } catch { /* not JSON — legacy plain string */ }
  return null;
}

export function serializeError(result: ErrorResult, attempt?: number): string {
  const stored: StoredError = {
    action: result.action,
    message: result.user_facing_message,
    technical: result.technical_detail,
    ...(attempt !== undefined ? { attempt } : {}),
  };
  return JSON.stringify(stored);
}

// ── File / upload error classification ───────────────────────────────────────

// Single deck size limit, shared by the upload pages, the submit routes and
// matching the `decks` bucket's file_size_limit (20 MB). Change all three together.
export const MAX_DECK_MB = 20;
export const MAX_DECK_BYTES = MAX_DECK_MB * 1024 * 1024;

const FILE_TOO_LARGE_MESSAGE =
  `Your file is over ${MAX_DECK_MB} MB. Try compressing images in your deck or exporting at a slightly lower quality — most decks come in well under 10 MB.`;

// Only the declared type and size are needed, so this works for a File in the
// browser and for the metadata the submit routes receive.
export type DeckFileInfo = { type: string; size: number };

export function classifyUploadError(
  file: DeckFileInfo | null,
  storageErrorMessage?: string
): ErrorResult {
  if (!file) {
    return {
      action: "REQUEST_REUPLOAD",
      user_facing_message:
        "We didn't receive a file. Please select your pitch deck PDF and try again — we're looking forward to reviewing it!",
      technical_detail: "No file details in request",
    };
  }

  if (file.size === 0) {
    return {
      action: "REQUEST_REUPLOAD",
      user_facing_message:
        "The file you uploaded appears to be empty. Could you try exporting your deck again as a PDF and re-uploading?",
      technical_detail: "File size is 0 bytes",
    };
  }

  if (file.type !== "application/pdf") {
    return {
      action: "REQUEST_REUPLOAD",
      user_facing_message:
        "We currently accept PDF files only. Please export your deck as a PDF (File → Export → PDF in most presentation tools) and upload it again.",
      technical_detail: `Unsupported MIME type: ${file.type}`,
    };
  }

  if (file.size > MAX_DECK_BYTES) {
    return {
      action: "REQUEST_REUPLOAD",
      user_facing_message: FILE_TOO_LARGE_MESSAGE,
      technical_detail: `File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds ${MAX_DECK_MB} MB limit`,
    };
  }

  // Storage-level failure
  const msg = storageErrorMessage?.toLowerCase() ?? "";
  if (msg.includes("maximum allowed size") || msg.includes("too large")) {
    return {
      action: "REQUEST_REUPLOAD",
      user_facing_message: FILE_TOO_LARGE_MESSAGE,
      technical_detail: `Storage rejected file size: ${storageErrorMessage}`,
    };
  }
  if (msg.includes("bucket") || msg.includes("storage")) {
    return {
      action: "ESCALATE_TO_SUPPORT",
      user_facing_message:
        "We hit a storage issue on our end — this is on us, not your file. Our team has been notified. Please try again in a few minutes.",
      technical_detail: `Storage error: ${storageErrorMessage}`,
    };
  }

  return {
    action: "REQUEST_REUPLOAD",
    user_facing_message:
      "Something went wrong uploading your deck. Please try re-uploading — it usually works on the second attempt!",
    technical_detail: `Storage upload failed: ${storageErrorMessage}`,
  };
}

// ── Analysis error classification ────────────────────────────────────────────

export function classifyAnalysisError(err: unknown, attempt: number): ErrorResult {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  // Timeout / transient / rate limit → retry (up to 3 attempts)
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("econnreset") ||
    lower.includes("socket") ||
    lower.includes("network") ||
    lower.includes("rate_limit") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("tokens per minute") ||
    lower.includes("overloaded")
  ) {
    if (attempt < 3) {
      const isRateLimit = lower.includes("rate limit") || lower.includes("rate_limit") || lower.includes("429") || lower.includes("tokens per minute");
      return {
        action: "AUTO_RETRY",
        user_facing_message: isRateLimit
          ? "High demand right now — retrying your analysis in about a minute. Hang tight!"
          : "Hang tight — our AI hit a brief slowdown and is retrying your analysis automatically.",
        technical_detail: `Transient error (attempt ${attempt}): ${message}`,
      };
    }
    return {
      action: "ESCALATE_TO_SUPPORT",
      user_facing_message:
        "Our analysis service is temporarily under heavy load. Please try again in a few minutes — we're looking forward to reviewing your deck!",
      technical_detail: `Persistent transient error after ${attempt} attempts: ${message}`,
    };
  }

  // File / content extraction issues → ask for re-upload
  if (
    lower.includes("no text") ||
    lower.includes("no content") ||
    lower.includes("could not extract") ||
    lower.includes("image-only") ||
    lower.includes("scanned") ||
    lower.includes("password") ||
    lower.includes("encrypted") ||
    lower.includes("corrupted") ||
    lower.includes("not a pitch deck") ||
    lower.includes("no slides")
  ) {
    return {
      action: "REQUEST_REUPLOAD",
      user_facing_message:
        "We couldn't read your deck — it may be image-only or scanned. Please re-export it as a searchable PDF (in PowerPoint: Save As → PDF, ensure 'Standard' quality is selected).",
      technical_detail: `Content extraction failed: ${message}`,
    };
  }

  // Invalid / incomplete JSON from Claude → retry first, then escalate
  if (lower.includes("failed to parse") || lower.includes("missing required fields")) {
    if (attempt < 3) {
      return {
        action: "AUTO_RETRY",
        user_facing_message:
          "Our AI returned an unexpected result — retrying now. This usually sorts itself out on the second pass.",
        technical_detail: `Parse failure (attempt ${attempt}): ${message}`,
      };
    }
    return {
      action: "ESCALATE_TO_SUPPORT",
      user_facing_message:
        "We're having trouble processing your specific deck format. Our team has been alerted and will look into it — please try again shortly.",
      technical_detail: `Persistent parse failure after ${attempt} attempts: ${message}`,
    };
  }

  // DB / infrastructure issues
  if (lower.includes("db save failed") || lower.includes("supabase") || lower.includes("database")) {
    return {
      action: "ESCALATE_TO_SUPPORT",
      user_facing_message:
        "Your analysis completed but we hit an issue saving the results. Our team has been notified — please try again and it should work.",
      technical_detail: `DB error: ${message}`,
    };
  }

  // Signed URL / storage fetch issues
  if (lower.includes("signed url") || lower.includes("failed to download") || lower.includes("deck file")) {
    return {
      action: "REQUEST_REUPLOAD",
      user_facing_message:
        "We couldn't retrieve your deck file. Please try re-uploading — this is usually a one-off glitch.",
      technical_detail: `File retrieval error: ${message}`,
    };
  }

  // Default: retry if early attempt, escalate if repeated
  if (attempt < 2) {
    return {
      action: "AUTO_RETRY",
      user_facing_message:
        "A small hiccup occurred during analysis — retrying automatically. We're excited to get you your results!",
      technical_detail: `Unknown error (attempt ${attempt}): ${message}`,
    };
  }

  return {
    action: "FAIL_GRACEFULLY",
    user_facing_message:
      "We weren't able to complete your analysis after multiple attempts. Please try submitting your deck again — we genuinely want to help your pitch shine.",
    technical_detail: `Unclassified error after ${attempt} attempts: ${message}`,
  };
}
