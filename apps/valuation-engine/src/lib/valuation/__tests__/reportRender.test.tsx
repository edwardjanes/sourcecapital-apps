import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReportClient from "@/app/companies/[id]/report/[snapshotId]/ReportClient";
import { computeValuation } from "../compute";
import { computeSensitivity } from "../sensitivity";
import { buildDefaultParameters } from "../defaults";
import {
  NORTHWIND_COMPANY,
  NORTHWIND_FINANCIALS,
  NORTHWIND_BALANCE_SHEET,
  NORTHWIND_QUESTIONNAIRE,
} from "./fixtures/northwind";

/**
 * Renders the client report for real, against both snapshot shapes.
 *
 * Why this exists: the discount-rate build-up, the terminal-value cross-check,
 * the method exclusions and the sensitivity were all wired into the report on
 * 28 Sep 2026, and EVERY snapshot already stored predates all four. Checked
 * directly against production that day -- 23 of 23 carry none of
 * `sensitivity`, `discountRateBuildUp`, `ltgTerminalValue` or a per-method
 * `effectiveWeight`. So the interesting case is not the new report, it is the old
 * one: a founder opening a report generated last week must not get a blank page
 * or a column of "undefined".
 *
 * This is the frontend half of the rule this project already runs on for GHL and
 * Postgres -- never trust a 200, verify by independent read-back. `tsc` and
 * `next build` both pass whether or not these guards are correct, because every
 * new field is optional; only rendering proves it.
 */

const buildOutputs = async () => {
  const profile = NORTHWIND_COMPANY;
  const parameters = {
    ...buildDefaultParameters(
      profile as never, NORTHWIND_FINANCIALS as never, NORTHWIND_BALANCE_SHEET as never
    ),
    comparables: [],
  };
  const outputs: Record<string, unknown> = {
    ...(await computeValuation(
      profile as never, NORTHWIND_FINANCIALS as never,
      { ...NORTHWIND_QUESTIONNAIRE } as never, parameters as never
    )),
    currency: "GBP",
  };
  outputs.sensitivity = await computeSensitivity({
    profile: profile as never,
    financials: NORTHWIND_FINANCIALS as never,
    questionnaire: { ...NORTHWIND_QUESTIONNAIRE } as never,
    parameters: parameters as never,
  });
  const inputs = {
    company: profile,
    financials: NORTHWIND_FINANCIALS,
    questionnaire: { answers: NORTHWIND_QUESTIONNAIRE },
    parameters,
    balanceSheet: NORTHWIND_BALANCE_SHEET,
  };
  return { outputs, inputs, profile };
};

/** Exactly the shape of every snapshot stored before 28 Sep 2026. */
const toLegacy = (outputs: Record<string, unknown>) => {
  const legacy = JSON.parse(JSON.stringify(outputs));
  delete legacy.sensitivity;
  delete legacy.discountRateBuildUp;
  delete legacy.ltgTerminalValue;
  delete legacy.redistributedWeight;
  delete legacy.allMethodsInapplicable;
  legacy.perMethod = legacy.perMethod.map(
    (m: { method: string; valuation: number; weight: number }) => ({
      method: m.method,
      valuation: m.valuation,
      weight: m.weight,
      weightedContribution: m.valuation * m.weight,
    })
  );
  return legacy;
};

const render = (outputs: unknown, inputs: unknown, company: unknown) =>
  renderToStaticMarkup(
    React.createElement(ReportClient, { snapshot: { outputs, inputs }, company } as never)
  );

describe("Report renders for a snapshot taken before any of this existed", () => {
  it("renders at all, rather than throwing", async () => {
    const { outputs, inputs, profile } = await buildOutputs();
    const html = render(toLegacy(outputs), inputs, profile);
    expect(html.length).toBeGreaterThan(10_000);
    expect(html).toContain("Valuation Summary");
    expect(html).toContain("Northwind Analytics Ltd");
  });

  it("omits every new section rather than rendering an empty one", async () => {
    const { outputs, inputs, profile } = await buildOutputs();
    const html = render(toLegacy(outputs), inputs, profile);
    expect(html).not.toContain("What Moves This Number");
    expect(html).not.toContain("How The Discount Rate Was Built");
    expect(html).not.toContain("Terminal Value Cross-Check");
    expect(html).not.toContain("Methods Not Applied");
  });

  it("leaks no undefined or NaN into the page", async () => {
    const { outputs, inputs, profile } = await buildOutputs();
    const html = render(toLegacy(outputs), inputs, profile);
    // The old per-method rows have no effectiveWeight, so the new column falls
    // back to the stage weight rather than printing nothing.
    expect(html).not.toMatch(/undefined/);
    expect(html).not.toMatch(/NaN/);
  });
});

describe("Report renders the new sections for a current snapshot", () => {
  it("shows the sensitivity, the build-up and the cross-check", async () => {
    const { outputs, inputs, profile } = await buildOutputs();
    const html = render(outputs, inputs, profile);
    expect(html).toContain("What Moves This Number");
    expect(html).toContain("How The Discount Rate Was Built");
    expect(html).toContain("Terminal Value Cross-Check");
    expect(html).not.toMatch(/undefined|NaN/);
  });

  it("explains the excluded method instead of showing it as worth nothing", async () => {
    const { outputs, inputs, profile } = await buildOutputs();
    const html = render(outputs, inputs, profile);
    // VC does not clear its hurdle for Northwind, so it is excluded.
    expect(html).toContain("Methods Not Applied");
    expect(html).toContain("does not clear at that hurdle");
    expect(html).toContain("Weight applied");
  });

  it("no longer carries the understated warning, now the benchmark can be varied", async () => {
    // It did, until the benchmark reference table supplied a distribution to move
    // the largest driver over. The warning block is conditional on
    // `sensitivity.understated`, so it disappearing is the correct signal.
    const { outputs, inputs, profile } = await buildOutputs();
    const html = render(outputs, inputs, profile);
    expect(html).not.toContain("Narrower Than It Should Be");
    // The section itself is still there, with the benchmark now in the table.
    expect(html).toContain("What Moves This Number");
    expect(html).toContain("Benchmark pre-money valuation");
  });

  it("no longer claims the stale multiple and beta provenance", async () => {
    const { outputs, inputs, profile } = await buildOutputs();
    const html = render(outputs, inputs, profile);
    // The Data Sources block said "Equidam's published TRBC data (July 2026) and
    // Damodaran UNLEVERED beta". Neither is true since the re-sourcing.
    expect(html).not.toContain("TRBC");
    expect(html).not.toContain("unlevered beta");
    expect(html).toContain("Kroll");
  });
});
