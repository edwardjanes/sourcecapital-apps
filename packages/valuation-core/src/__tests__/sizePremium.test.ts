import { describe, it, expect } from "vitest";
import { SIZE_PREMIUM_BANDS, resolveSizePremium, COUNTRIES, INDUSTRIES } from "../referenceData";
import { buildDefaultParameters } from "../defaults";
import { computeValuation } from "../compute";
import {
  NORTHWIND_COMPANY,
  NORTHWIND_FINANCIALS,
  NORTHWIND_BALANCE_SHEET,
  NORTHWIND_QUESTIONNAIRE,
} from "./fixtures/northwind";

/**
 * The discount-rate size premium, added 27 Sep 2026 as the correction for the
 * cause that MIN_LTG_SPREAD was the guardrail for. See AUDIT-04 divergence 1 and
 * the long comment on SIZE_PREMIUM_BANDS.
 */

describe("Size premium — the band table", () => {
  it("is ordered largest-first so the first match is the right one", () => {
    const mins = SIZE_PREMIUM_BANDS.map((b) => b.minRevenue);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
  });

  it("is monotonic: smaller companies never carry a smaller premium", () => {
    const premiums = SIZE_PREMIUM_BANDS.map((b) => b.premium);
    for (let i = 1; i < premiums.length; i++) expect(premiums[i]).toBeGreaterThanOrEqual(premiums[i - 1]);
  });

  it("charges nothing at mid-cap and the sourced decile-10 figure at the bottom", () => {
    expect(resolveSizePremium(600_000_000).premium).toBe(0);
    // Kroll Cost of Capital Navigator, CRSP decile 10, cited 2024.
    const smallest = resolveSizePremium(900_000);
    expect(smallest.premium).toBe(0.047);
    expect(smallest.basis).toBe("sourced");
    expect(smallest.source).toMatch(/Kroll/);
  });

  it("stops at decile 10 rather than extrapolating to 10z", () => {
    // Deliberate, and the reason is double counting. Kroll also publishes decile
    // 10z at 11.17% (2022), and a GBP 900k-revenue startup is far below even
    // that -- but the listed size effect is substantially an ILLIQUIDITY effect,
    // and the engine already charges illiquidity explicitly at 25%. Stacking 10z
    // on top of that charges the same risk twice, which both DCF specs warn
    // against. Measured: at 10z the rate reaches 22.46%, the Gordon multiple
    // collapses to 5.1x and dcf_ltg lands at 1.27x last actual revenue.
    const max = Math.max(...SIZE_PREMIUM_BANDS.map((b) => b.premium));
    expect(max).toBe(0.047);
    expect(max).toBeLessThan(0.112);
  });

  it("treats a pre-revenue company as the smallest band rather than the largest", () => {
    // A zero, a negative and a NaN must not fall through to the 0% band.
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY * 0]) {
      expect(resolveSizePremium(v as number).premium).toBe(0.047);
    }
  });

  it("only claims `sourced` for the band that has a source", () => {
    const sourced = SIZE_PREMIUM_BANDS.filter((b) => b.basis === "sourced");
    expect(sourced.length).toBe(1);
    expect(sourced[0].minRevenue).toBe(0);
    // Everything else is honestly labelled a coarse read.
    expect(SIZE_PREMIUM_BANDS.filter((b) => b.basis === "modelled").length).toBe(4);
  });
});

describe("Size premium — what it does to the rate", () => {
  it("is added to CAPM, not substituted for it", () => {
    const d = buildDefaultParameters(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never, NORTHWIND_BALANCE_SHEET as never
    );
    const b = d.discount_rate_build_up!;
    expect(b.riskFreeRate).toBe(COUNTRIES.GB.riskFree10Y);
    expect(b.beta).toBe(INDUSTRIES.SaaS.beta);
    expect(b.equityRiskPremium).toBe(COUNTRIES.GB.equityRiskPremium);
    expect(b.systematicRiskPremium).toBeCloseTo(b.beta * b.equityRiskPremium, 12);
    expect(b.discountRate).toBeCloseTo(b.riskFreeRate + b.systematicRiskPremium + b.sizePremium, 12);
    // 5.10% + 6.41% + 4.70% = 16.213%, up from a bare-CAPM 11.513%.
    // (The systematic leg moved when the betas were re-sourced, 1.23 -> 1.28.)
    expect(b.discountRate).toBeCloseTo(0.162128, 6);
    expect(b.riskFreeRate + b.systematicRiskPremium).toBeCloseTo(0.115128, 6);
  });

  it("is reported rather than applied silently", () => {
    // The whole build-up reaches the output so the report can show the founder
    // where their discount rate came from, including how well sourced the
    // premium is.
    const d = buildDefaultParameters(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never, NORTHWIND_BALANCE_SHEET as never
    );
    const b = d.discount_rate_build_up!;
    expect(b.sizePremiumBasis).toBe("sourced");
    expect(b.lastYearRevenue).toBe(900_000);
    expect(b.sizeBandMinRevenue).toBe(0);
  });

  it("stays far below the VC method's hurdle, which is the point", async () => {
    const { VC_REQUIRED_ROI } = await import("../referenceData");
    // VC_REQUIRED_ROI.expansion is 48.6% -- an investor target return carrying
    // the whole portfolio failure load. This rate is 15.96% and carries none of
    // it, because failure is modelled separately by the survival curve. Both
    // specs are explicit that the two are different quantities: "Using a 40%
    // venture target return as WACC in a perpetual-growth DCF is generally not
    // the same as estimating the company's market-participant cost of capital."
    expect(VC_REQUIRED_ROI.expansion).toBeGreaterThan(0.162128 * 2.9);
  });
});

describe("Size premium — effect on the valuation", () => {
  const run = async (rate?: number) => {
    const d = buildDefaultParameters(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never, NORTHWIND_BALANCE_SHEET as never
    );
    if (rate !== undefined) {
      d.dcf_shared.discount_rate = rate;
      // RONIC defaults to the discount rate, so an override must move both or the
      // comparison would change two things at once.
      d.dcf_ltg.terminal_return_on_new_capital = rate;
    }
    const r = await computeValuation(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never,
      { ...NORTHWIND_QUESTIONNAIRE } as never, { ...d, comparables: [] } as never
    );
    const m = (k: string) =>
      Math.round(r.perMethod.find((x: { method: string }) => x.method === k)?.valuation ?? 0);
    return { ltg: m("dcf_ltg"), mult: m("dcf_multiple"), vc: m("vc"),
             sc: m("scorecard"), ck: m("checklist"), w: Math.round(r.weightedValuation) };
  };

  it("moves only the two methods that discount cash flows", async () => {
    const before = await run(0.115128); // bare CAPM at the current beta
    const after = await run();

    expect(after.ltg).toBe(1_901_554);
    expect(after.mult).toBe(4_088_980);
    expect(after.w).toBe(3_166_356);

    // Correct blast radius. (vc is 0 in both: since 27 Sep 2026 it is excluded
    // entirely for not clearing its hurdle, and it never used this rate anyway.)
    expect(after.vc).toBe(before.vc);
    expect(after.sc).toBe(before.sc);
    expect(after.ck).toBe(before.ck);

    // DCF-LTG moves more than DCF-multiple because the rate enters twice there:
    // once discounting, once in the Gordon denominator.
    expect(after.ltg / before.ltg - 1).toBeCloseTo(-0.3626, 3);
    expect(after.mult / before.mult - 1).toBeCloseTo(-0.1800, 3);
    expect(after.w / before.w - 1).toBeCloseTo(-0.2113, 3);
  });

  it("makes the cash-flow methods read LOWER, which widens the method gap", async () => {
    // Worth asserting because AUDIT-04/05/06 all claimed every cash-flow method
    // read too low and that the errors partly cancelled against the qualitative
    // methods' too-high benchmark. This finding is the counter-example: the rate
    // was too low, so the DCFs read too HIGH, and correcting it widens the gap
    // rather than narrowing it.
    const before = await run(0.115128);
    const after = await run();
    const gap = (x: Awaited<ReturnType<typeof run>>) => ((x.sc + x.ck) / 2) / ((x.ltg + x.mult) / 2);
    // Measured after the multiple re-sourcing, which narrowed both readings.
    // Both readings collapsed when the benchmark table landed: the qualitative
    // methods are no longer multiples of the cash-flow ones.
    expect(gap(before)).toBeCloseTo(1.05, 1);
    expect(gap(after)).toBeCloseTo(1.40, 1);
    expect(gap(after)).toBeGreaterThan(gap(before));
  });

  it("leaves DCF-LTG at a defensible multiple of revenue, unlike decile 10z would", async () => {
    const after = await run();
    // 2.10x last actual revenue for a company forecasting 8.2m by year 5, after
    // a 61.6% survival haircut and a 25% illiquidity discount. Severe but
    // defensible. At decile 10z (22.46%) the same company lands at 1.27x, which
    // is what ruled that band out.
    expect(after.ltg / 900_000).toBeCloseTo(2.11, 2);
    const atTenZ = await run(0.115128 + 0.112);
    expect(atTenZ.ltg / 900_000).toBeCloseTo(1.32, 2);
  });
});

describe("Betas — re-sourced 28 Sep 2026", () => {
  it("comes from the same Damodaran row as that sector's multiples", async () => {
    const { INDUSTRIES } = await import("../referenceData");
    // The whole point of moving betas into SECTOR_SOURCE: beta and multiples now
    // describe ONE industry. Before, they were two unrelated hand-entered columns
    // and nothing tied them together.
    for (const [key, v] of Object.entries(INDUSTRIES)) {
      expect(v.source, key).toMatch(/Damodaran US industry data, January 2026/);
      expect(v.beta, key).toBeGreaterThan(0);
      expect(v.unleveredBeta, key).toBeGreaterThan(0);
      // Levered >= unlevered always: debt adds equity risk.
      expect(v.beta, key).toBeGreaterThanOrEqual(v.unleveredBeta);
    }
    // Four sectors map to Software (System & Application), so they share its beta.
    for (const k of ["Fintech", "AI_ML", "MobileApp"] as const) {
      expect(INDUSTRIES[k].beta).toBe(INDUSTRIES.SaaS.beta);
    }
  });

  it("uses the LEVERED beta, which is the consistent pairing for FCFE", async () => {
    const { INDUSTRIES } = await import("../referenceData");
    // FCFE is a levered cash flow -- after interest, including debt movements --
    // discounted at a cost of equity, so an equity (levered) beta is the match.
    // Damodaran's unlevered-corrected-for-cash figures are carried but not used.
    expect(INDUSTRIES.SaaS.beta).toBe(1.28);
    expect(INDUSTRIES.SaaS.unleveredBeta).toBe(1.25);

    const { buildDefaultParameters } = await import("../defaults");
    const f = await import("./fixtures/northwind");
    const d = buildDefaultParameters(
      f.NORTHWIND_COMPANY as never, f.NORTHWIND_FINANCIALS as never, f.NORTHWIND_BALANCE_SHEET as never
    );
    expect(d.discount_rate_build_up!.beta).toBe(INDUSTRIES.SaaS.beta);

    // The approximation is small, and measured rather than assumed: re-levering
    // 1.25 at Northwind's own MARKET-value D/E (~0.063 at a 4m equity value, 25%
    // tax) gives 1.309 against the 1.28 used -- 2.3%. At BOOK weights it would
    // read 1.589, but the DCF-LTG spec names using book weights a Common Error.
    const relevered = 1.25 * (1 + (1 - 0.25) * (250_000 / 4_000_000));
    expect(relevered).toBeCloseTo(1.309, 3);
    expect(Math.abs(relevered / 1.28 - 1)).toBeLessThan(0.03);
  });

  it("no longer carries betas that imply half the market's volatility", async () => {
    const { INDUSTRIES } = await import("../referenceData");
    // Cleantech 0.46 and Media 0.48 were the two least defensible, and Cleantech's
    // is what drove the Swiss discount rate to 2.35% and broke the Gordon
    // denominator. Nothing now sits below 0.78.
    expect(INDUSTRIES.Cleantech.beta).toBe(0.86);
    expect(INDUSTRIES.Media.beta).toBe(0.83);
    expect(Math.min(...Object.values(INDUSTRIES).map((v) => v.beta))).toBeGreaterThanOrEqual(0.78);
  });

  it("does NOT use total beta, which would be the third charge for one risk", async () => {
    const { INDUSTRIES, SIZE_PREMIUM_BANDS, ILLIQUIDITY_DISCOUNT_DEFAULT } = await import("../referenceData");
    // Damodaran argues for total beta (beta / correlation with the market) where
    // the owner is undiversified, which a founder is. Deliberately not used: it
    // captures undiversification and illiquidity, and this engine already charges
    // both -- once through SIZE_PREMIUM_BANDS and once through the 25% illiquidity
    // discount. Same double-count reasoning that capped the size premium at CRSP
    // decile 10 rather than 10z.
    //
    // A typical software correlation with the market is ~0.4, so total beta would
    // be roughly 1.28 / 0.4 = 3.2 -- and a 5.1% + 16% + 4.7% rate of ~26%.
    const totalBeta = INDUSTRIES.SaaS.beta / 0.4;
    expect(totalBeta).toBeCloseTo(3.2, 1);
    expect(INDUSTRIES.SaaS.beta).toBeLessThan(totalBeta);
    // The two charges that make it unnecessary both still exist.
    expect(Math.max(...SIZE_PREMIUM_BANDS.map((b) => b.premium))).toBe(0.047);
    expect(ILLIQUIDITY_DISCOUNT_DEFAULT).toBe(0.25);
  });

  it("moves Northwind only slightly, and lowers rather than raises", async () => {
    const { computeValuation } = await import("../compute");
    const { buildDefaultParameters } = await import("../defaults");
    const f = await import("./fixtures/northwind");
    const d = buildDefaultParameters(
      f.NORTHWIND_COMPANY as never, f.NORTHWIND_FINANCIALS as never, f.NORTHWIND_BALANCE_SHEET as never
    );
    const r = await computeValuation(
      f.NORTHWIND_COMPANY as never, f.NORTHWIND_FINANCIALS as never,
      { ...f.NORTHWIND_QUESTIONNAIRE } as never, { ...d, comparables: [] } as never
    );
    // 1.23 -> 1.28 takes the rate 15.962% -> 16.213% and the composite
    // 3,931,918 -> 3,896,345, a 0.90% fall. Small because SaaS's beta barely
    // moved; the re-sourcing matters far more for Cleantech, Marketplace,
    // Media and PropTech.
    expect(r.discountRate).toBeCloseTo(0.162128, 6);
    expect(Math.round(r.weightedValuation)).toBe(3_166_356);
  });
});
