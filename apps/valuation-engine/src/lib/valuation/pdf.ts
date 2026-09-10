import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium } from 'playwright-core';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Renders the print-only report page for a snapshot to PDF in headless
 * Chromium, uploads it to Supabase Storage, records the URL on the
 * snapshot row, and returns a signed URL.
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

  let browser;
  try {
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
    await page.setExtraHTTPHeaders({ 'x-service-key': serviceKey });

    const printUrl = `${origin}/print/valuation/${snapshotId}`;
    const response = await page.goto(printUrl, { waitUntil: 'networkidle', timeout: 45_000 });

    if (!response || !response.ok()) {
      console.error(
        `Print page for snapshot ${snapshotId} returned ${response?.status()} -- aborting PDF render`
      );
      return null;
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

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
  } finally {
    if (browser) {
      await browser.close().catch(() => {
        // Best-effort cleanup -- a close failure shouldn't mask the real error above.
      });
    }
  }
}
