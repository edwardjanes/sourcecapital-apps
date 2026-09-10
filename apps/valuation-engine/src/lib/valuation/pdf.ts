import { supabaseAdmin } from '@/lib/supabaseAdmin';

const PDFSHIFT_ENDPOINT = 'https://api.pdfshift.io/v3/convert/pdf';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Renders the print-only report page for a snapshot to PDF via PDFShift
 * (a hosted URL-to-PDF service), uploads it to Supabase Storage, records
 * the URL on the snapshot row, and returns a signed URL.
 *
 * Returns null on any failure rather than throwing -- callers (the
 * compute route especially) should treat a failed render as "no PDF
 * yet", not as a reason to fail an otherwise-successful valuation.
 */
export async function renderAndUploadReportPdf(
  snapshotId: string,
  origin: string
): Promise<string | null> {
  const serviceKey = process.env.VALUATION_SERVICE_KEY;
  if (!serviceKey) {
    console.error('VALUATION_SERVICE_KEY is not set -- cannot render PDF for', snapshotId);
    return null;
  }

  const pdfshiftKey = process.env.PDFSHIFT_API_KEY;
  if (!pdfshiftKey) {
    console.error('PDFSHIFT_API_KEY is not set -- cannot render PDF for', snapshotId);
    return null;
  }

  try {
    const printUrl = `${origin}/print/valuation/${snapshotId}`;

    const pdfshiftResponse = await fetch(PDFSHIFT_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-Key': pdfshiftKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: printUrl,
        // Auth for the print page itself -- PDFShift forwards this header
        // when it loads the source URL.
        http_headers: {
          'x-service-key': serviceKey,
        },
        format: 'A4',
        margin: '0',
        use_print: true,
      }),
    });

    if (!pdfshiftResponse.ok) {
      const errorBody = await pdfshiftResponse.text().catch(() => '<unreadable>');
      console.error(
        `PDFShift request for snapshot ${snapshotId} failed with ${pdfshiftResponse.status}: ${errorBody}`
      );
      return null;
    }

    const pdfBuffer = Buffer.from(await pdfshiftResponse.arrayBuffer());

    // Path is company-scoped so an admin browsing storage can find every
    // report for a client without cross-referencing snapshot IDs.
    const { data: snapshot } = await supabaseAdmin
      .from('valuation_snapshots')
      .select('company_id')
      .eq('id', snapshotId)
      .single();

    const storagePath = `${snapshot?.company_id || 'unknown'}/${snapshotId}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('valuation-reports')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('PDF upload error for snapshot', snapshotId, uploadError);
      return null;
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('valuation-reports')
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signedUrlError || !signedUrlData) {
      console.error('Signed URL error for snapshot', snapshotId, signedUrlError);
      return null;
    }

    await supabaseAdmin
      .from('valuation_snapshots')
      .update({
        report_url: signedUrlData.signedUrl,
        report_generated_at: new Date().toISOString(),
      })
      .eq('id', snapshotId);

    return signedUrlData.signedUrl;
  } catch (error) {
    console.error('PDF render error for snapshot', snapshotId, error);
    return null;
  }
}
