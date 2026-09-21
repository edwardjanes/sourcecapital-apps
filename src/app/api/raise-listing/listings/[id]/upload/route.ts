import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireListingOwner } from '@/lib/raiseListing/ownership';
import { checkListingFile, isListingFileField, LISTING_UPLOADS } from '@/lib/raiseListing/uploads';

/**
 * POST /api/raise-listing/listings/[id]/upload
 * Step 1 of a logo or pitch deck upload. Takes JSON metadata only
 * ({ field, fileName, fileType, fileSize }) and returns a signed upload token;
 * the browser uploads the file straight to Storage, then calls ./confirm.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireListingOwner(req, params.id);
    if ('response' in owner) return owner.response;

    const body = await req.json().catch(() => null);
    const field = body?.field ?? 'company_logo_path';
    const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
    const fileType = typeof body?.fileType === 'string' ? body.fileType : '';
    const fileSize = typeof body?.fileSize === 'number' ? body.fileSize : NaN;

    if (!fileName || Number.isNaN(fileSize)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!isListingFileField(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    const fileError = checkListingFile(field, { type: fileType, size: fileSize });
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    // Generate file path
    const ext = fileName.split('.').pop();
    const path = `${owner.userId}/${params.id}/${Date.now()}.${ext}`;

    const { data, error: signError } = await supabaseAdmin.storage
      .from(LISTING_UPLOADS[field].bucket)
      .createSignedUploadUrl(path);

    if (signError || !data) {
      Sentry.captureException(signError ?? new Error('createSignedUploadUrl returned no data'), {
        tags: { context: 'file_upload' },
        extra: { listing_id: params.id, field },
      });
      console.error('[upload] Signed upload URL error:', signError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    return NextResponse.json({ path: data.path, token: data.token });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { context: 'file_upload_endpoint' },
    });
    console.error('[upload] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
