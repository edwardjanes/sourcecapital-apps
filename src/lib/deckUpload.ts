import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MAX_DECK_BYTES } from "@/lib/errorHandler";

// Server-side helpers for the direct-to-Storage deck upload. The browser sends
// only file metadata to the submit routes, uploads the PDF straight to the
// `decks` bucket with a signed upload URL, then calls /api/submit/confirm.
// Keeping file bytes out of the function avoids Vercel's request body limit.

export const AWAITING_UPLOAD = "awaiting_upload";

export type DeclaredDeckFile = { name: string; type: string; size: number };

// Reads the file metadata the client declares. Returns null when there is no
// usable file description, so classifyUploadError can report "no file".
export function readDeclaredFile(body: Record<string, unknown>): DeclaredDeckFile | null {
  const name = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const type = typeof body.fileType === "string" ? body.fileType : "";
  const size = typeof body.fileSize === "number" && Number.isFinite(body.fileSize) ? body.fileSize : NaN;
  if (!name || Number.isNaN(size)) return null;
  return { name, type, size };
}

export function isValidDeckFile(file: DeclaredDeckFile | null): file is DeclaredDeckFile {
  return !!file && file.type === "application/pdf" && file.size > 0 && file.size <= MAX_DECK_BYTES;
}

// Storage keys reject some characters that appear in real deck file names, so
// keep the name readable but safe.
function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\- ()]/g, "_").trim();
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "deck"}.pdf`;
}

export async function createDeckUploadUrl(submissionId: string, fileName: string) {
  const path = `${submissionId}/${safeFileName(fileName)}`;
  const { data, error } = await supabaseAdmin.storage.from("decks").createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("createSignedUploadUrl returned no data");
  return { path: data.path, token: data.token };
}
