// Raise listing file uploads. Limits match the Storage buckets' own
// file_size_limit / allowed_mime_types — change both together.
//
// Files go straight from the browser to Storage with a signed upload URL
// (the upload route only hands out the token), because Vercel rejects
// function request bodies over ~4.5 MB before the route runs.

export type ListingFileField = 'company_logo_path' | 'pitch_deck_file_path';

export const LISTING_UPLOADS: Record<
  ListingFileField,
  { bucket: string; maxBytes: number; mimeTypes: string[]; label: string }
> = {
  company_logo_path: {
    bucket: 'raise-listing-logos',
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    label: 'Logo',
  },
  pitch_deck_file_path: {
    bucket: 'raise-listing-decks',
    maxBytes: 20 * 1024 * 1024,
    mimeTypes: ['application/pdf'],
    label: 'Pitch deck',
  },
};

export function isListingFileField(value: unknown): value is ListingFileField {
  return value === 'company_logo_path' || value === 'pitch_deck_file_path';
}

// Returns a user-facing error, or null when the file is acceptable.
export function checkListingFile(
  field: ListingFileField,
  file: { type: string; size: number }
): string | null {
  const config = LISTING_UPLOADS[field];
  if (file.size === 0) return 'The file is empty. Please choose another file.';
  if (file.size > config.maxBytes) {
    return `File too large (max ${config.maxBytes / 1024 / 1024}MB)`;
  }
  if (!config.mimeTypes.includes(file.type)) return 'Invalid file type';
  return null;
}
