import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContentBlockParam = any;
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DECK_ANALYSIS_SYSTEM_PROMPT, DeckAnalysis } from "@/lib/deckPrompt";
import { classifyAnalysisError, serializeError } from "@/lib/errorHandler";
import { compressPdf } from "@/lib/compressPdf";
import { sendAnalysisResultEmail } from "@/lib/loops";
import { createOrUpdateContact as createGHLContact } from "@/lib/ghl";
import { createOrUpdateContact as createLoopsContact } from "@/lib/loops";
import { AWAITING_UPLOAD } from "@/lib/deckUpload";

export const maxDuration = 300; // 5 minutes — allows time for large deck analysis

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [0, 65000, 65000]; // immediate, then wait 65s for rate-limit window to reset

// Sonnet 4.6 published rates (per Anthropic API pricing, Aug 2026) — used only for
// the cost-per-analysis log line below, not for billing. Update if the model or
// its price changes.
const CLAUDE_INPUT_COST_PER_MTOK = 3.0;
const CLAUDE_OUTPUT_COST_PER_MTOK = 15.0;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Missing submission ID" }, { status: 400 });
  }

  // 1. Fetch current status — guard against duplicate runs
  const { data: submission, error: fetchError } = await supabaseAdmin
    .from("deck_submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !submission) {
    console.error("[analyse] fetchError:", fetchError);
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  console.log(`[analyse] id=${id} status=${submission.status} score=${submission.score}`);

  if (submission.status === "complete") {
    return NextResponse.json({ message: "Already complete" });
  }

  if (submission.status === "analysing") {
    return NextResponse.json({ message: "Analysis already in progress" });
  }

  // The browser is still uploading the PDF straight to Storage (or gave up).
  // Leave the row alone so it isn't marked as an error before the upload lands.
  if (submission.status === AWAITING_UPLOAD) {
    return NextResponse.json({ error: "Deck upload not finished" }, { status: 409 });
  }

  if (!submission.deck_file_path) {
    const result = classifyAnalysisError(new Error("No deck file found"), 1);
    await supabaseAdmin
      .from("deck_submissions")
      .update({ status: "error", error_message: serializeError(result, 1) })
      .eq("id", id);
    return NextResponse.json({ error: "No deck file found" }, { status: 400 });
  }

  // 2. Mark as analysing
  await supabaseAdmin
    .from("deck_submissions")
    .update({ status: "analysing" })
    .eq("id", id);

  // 3. Retry loop — up to MAX_ATTEMPTS for transient failures
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      const delay = RETRY_DELAY_MS[attempt - 1] ?? 10000;
      console.log(`[analyse] Retry attempt ${attempt} for ${id} — waiting ${delay}ms`);
      await sleep(delay);

      // Store retry status so the UI can show "retrying..."
      const retryResult = classifyAnalysisError(lastError, attempt - 1);
      await supabaseAdmin
        .from("deck_submissions")
        .update({ error_message: serializeError(retryResult, attempt - 1) })
        .eq("id", id);
    }

    try {
      // 4. Get signed URL for the PDF
      const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
        .from("decks")
        .createSignedUrl(submission.deck_file_path, 3600);

      if (urlError || !signedUrlData?.signedUrl) {
        throw new Error("Failed to get signed URL for deck file");
      }

      // 5. Download the PDF
      const pdfResponse = await fetch(signedUrlData.signedUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to download deck: ${pdfResponse.status}`);
      }
      const pdfBuffer = await pdfResponse.arrayBuffer();

      // Compress the PDF before sending to Claude to reduce token usage
      const { data: compressedPdf, originalBytes, compressedBytes, pageCount } =
        await compressPdf(pdfBuffer);
      console.log(
        `[analyse] PDF compressed: ${(originalBytes / 1024).toFixed(0)}KB → ${(compressedBytes / 1024).toFixed(0)}KB (${pageCount} pages)`
      );

      const pdfBase64 = Buffer.from(compressedPdf).toString("base64");

      // 6. Send to Claude
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      const content: ContentBlockParam[] = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
        } as ContentBlockParam,
        {
          type: "text",
          text: `Please analyse this pitch deck for ${submission.business_name} (${submission.country}). Return only the JSON analysis object — no markdown fences, no preamble, no explanation.`,
        },
      ];

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8096,
        system: DECK_ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      });

      // Log real per-call token usage + estimated cost — this is the data point
      // Track 12 step 1 needed and didn't have (no historical log existed before
      // this). Cost is an estimate off current published Sonnet 4.6 rates, not
      // an authoritative billing figure — cross-check against the Anthropic
      // Console for the real number periodically.
      const inputTokens = message.usage?.input_tokens ?? 0;
      const outputTokens = message.usage?.output_tokens ?? 0;
      const estimatedCostUsd =
        (inputTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_MTOK +
        (outputTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_MTOK;
      console.log(
        `[analyse] Claude usage for ${id}: input=${inputTokens} output=${outputTokens} tokens, ` +
        `pageCount=${pageCount}, estCost=$${estimatedCostUsd.toFixed(4)} (attempt ${attempt})`
      );

      // 7. Parse Claude's response
      const rawText =
        message.content[0].type === "text" ? message.content[0].text : "";

      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      let analysis: DeckAnalysis;
      try {
        analysis = JSON.parse(cleaned);
      } catch {
        throw new Error(`Failed to parse Claude response as JSON: ${rawText.slice(0, 200)}`);
      }

      // 8. Validate basic structure
      if (
        typeof analysis.meetingConversionScore !== "number" ||
        !analysis.verdict
      ) {
        throw new Error("Claude response is missing required fields");
      }

      // 9. Persist results
      const { error: saveError } = await supabaseAdmin
        .from("deck_submissions")
        .update({
          status:               "complete",
          error_message:        null,
          score:                analysis.meetingConversionScore,
          verdict:              analysis.verdict,
          verdict_type:         analysis.verdictType,
          most_damaging_issue:  analysis.mostDamagingIssue,
          best_asset:           analysis.bestAsset,
          analysis_summary:     analysis.executiveSummary,
          analysis_json:        analysis,
        })
        .eq("id", id);

      if (saveError) {
        console.error("Failed to save analysis to DB:", saveError);
        throw new Error(`DB save failed: ${saveError.message}`);
      }

      console.log(`[analyse] Complete for ${id} — score ${analysis.meetingConversionScore} (attempt ${attempt})`);

      // Update contacts with analysis results (non-blocking)
      const resultsUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sourcecapital.co.uk"}/investment-score/results/${id}`;

      if (submission.email) {
        const dimensionMap: Record<string, string> = {
          "Problem": "u1bV8tEnu2zWTsBflXIu",
          "Solution": "xsIZlE6GQYGpSjtGjf7w",
          "Market": "6ViiQIyHWkGRsFBdGeXt",
          "Business Model": "dZ4hNcy8j03li0GSB8IL",
          "Traction": "HcKCNrlfmFeHTA9pZwRQ",
          "Team": "EUcRv01IQp6Vp2Pw622q",
          "Financials": "pgtlybd1fNPvWcyBAsTM",
          "Competition": "UZGCpIfva0egbh1CKnYK",
        };

        const dimensionCustomFields = analysis.dimensions
          .filter(d => dimensionMap[d.name])
          .map(d => ({
            id: dimensionMap[d.name],
            value: String(d.score),
          }));

        // Always push to GHL
        const ghlTags = submission?.is_admin_upload ? ["Admin Upload"] : undefined;
        createGHLContact({
          email: submission.email,
          firstName: submission.first_name ?? "",
          lastName: submission.last_name ?? "",
          customFieldValues: [
            { id: "3bxhCqt09ygRcoBoAZ8B", value: String(analysis.meetingConversionScore) },
            { id: "iZv15mWFhiIMlqZNH4c6", value: analysis.verdict },
            { id: "fzyfynLQ9mVvpYdcOoU1", value: resultsUrl },
            ...dimensionCustomFields,
          ],
          tags: ghlTags,
        }).catch((err) => console.error("[ghl] Contact update error:", err));

        // Push to Loops only for non-admin uploads
        if (!submission?.is_admin_upload) {
          const dimensionScores = analysis.dimensions.reduce((acc, dim) => {
            const scoreKey = dim.name
              .toLowerCase()
              .replace(/\s+/g, "")
              .replace(/competition/g, "competitiveLandscape");
            acc[`${scoreKey}Score`] = String(dim.score);
            return acc;
          }, {} as Record<string, string>);

          createLoopsContact({
            email: submission.email,
            firstName: submission.first_name ?? "",
            lastName: submission.last_name ?? "",
            customProperties: {
              deckScore: String(analysis.meetingConversionScore),
              deckVerdict: analysis.verdict,
              deckResultsUrl: resultsUrl,
              ...dimensionScores,
            },
          }).catch((err) => console.error("[loops] Contact update error:", err));

          // Send results email (non-blocking — don't fail the analysis if email fails)
          sendAnalysisResultEmail({
            email: submission.email,
            firstName: submission.first_name ?? "there",
            businessName: submission.business_name,
            score: analysis.meetingConversionScore,
            verdict: analysis.verdict,
            resultsUrl,
          }).catch((err) => console.error("[loops] Email error:", err));
        }
      }

      return NextResponse.json({
        success: true,
        score: analysis.meetingConversionScore,
        verdict: analysis.verdict,
      });

    } catch (err) {
      lastError = err;
      console.error(`[analyse] Attempt ${attempt} failed for ${id}:`, err);

      const result = classifyAnalysisError(err, attempt);

      // Don't retry if it's not an AUTO_RETRY action
      if (result.action !== "AUTO_RETRY" || attempt >= MAX_ATTEMPTS) {
        // Capture to Sentry with submission context
        Sentry.captureException(err, {
          tags: {
            submission_id: id,
            recovery_action: result.action,
            attempt,
          },
          extra: {
            business_name: submission.business_name,
            country: submission.country,
            deck_file_path: submission.deck_file_path,
            technical_detail: result.technical_detail,
          },
        });

        await supabaseAdmin
          .from("deck_submissions")
          .update({ status: "error", error_message: serializeError(result, attempt) })
          .eq("id", id);

        return NextResponse.json({ error: result.user_facing_message }, { status: 500 });
      }
      // Otherwise loop continues for AUTO_RETRY
    }
  }

  // Should not reach here, but safety net
  const fallback = classifyAnalysisError(lastError, MAX_ATTEMPTS);
  Sentry.captureException(lastError, {
    tags: { submission_id: id, recovery_action: fallback.action, attempt: MAX_ATTEMPTS },
    extra: { business_name: submission.business_name, technical_detail: fallback.technical_detail },
  });
  await supabaseAdmin
    .from("deck_submissions")
    .update({ status: "error", error_message: serializeError(fallback, MAX_ATTEMPTS) })
    .eq("id", id);

  return NextResponse.json({ error: fallback.user_facing_message }, { status: 500 });
}
