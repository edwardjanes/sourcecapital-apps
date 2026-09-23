import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireListingOwner } from '@/lib/raiseListing/ownership';
import { isListingFileField, LISTING_UPLOADS } from '@/lib/raiseListing/uploads';

/**
 * POST /api/raise-listing/listings/[id]/upload/confirm
 * Step 3 of a logo or pitch deck upload ({ field, path }). Checks the file the
 * browser uploaded exists, records it on the listing and returns its URL.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireListingOwner(req, params.id);
    if ('response' in owner) return owner.response;

    const body = await req.json().catch(() => null);
    const field = body?.field;
    const path = typeof body?.path === 'string' ? body.path : '';

    if (!isListingFileField(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    // Only files under this owner's folder for this listing can be attached.
    if (!path.startsWith(`${owner.userId}/${params.id}/`) || path.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const bucket = LISTING_UPLOADS[field].bucket;
    const { data: exists } = await supabaseAdmin.storage.from(bucket).exists(path);
    if (!exists) {
      return NextResponse.json(
        { error: "We couldn't find the uploaded file. Please try uploading it again." },
        { status: 409 }
      );
    }

    // Public URL for logos, 7-day signed URL for decks (unchanged from the
    // previous single-request upload).
    let fileUrl: string;
    if (field === 'company_logo_path') {
      fileUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } else {
      const { data: signedData } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (!signedData) {
        return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
      }
      fileUrl = signedData.signedUrl;
    }

    const { error: updateError } = await supabaseAdmin
      .from('raise_listings')
      .update({ [field]: fileUrl })
      .eq('id', params.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, file_path: fileUrl });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { context: 'file_upload_confirm' },
      extra: { listing_id: params.id },
    });
    console.error('[upload confirm] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
