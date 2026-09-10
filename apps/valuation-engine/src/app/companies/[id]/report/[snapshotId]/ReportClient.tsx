'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency, formatPercent } from '@/lib/valuation/format';
import { STAGE_DEFAULT_WEIGHTS } from '@/lib/valuation/referenceData';
import { buildDefaultParameters } from '@/lib/valuation/defaults';
import { ReportChart } from '../ReportChart';
import '../report.css';

interface ReportClientProps {
  snapshot: any;
  company: any;
}

interface NavItem {
  id: string;
  label: string;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'cover', label: 'Cover' },
      { id: 'about', label: 'About this report' },
      { id: 'company-summary', label: 'Company summary' },
      { id: 'forecasts', label: 'Forecasts summary' },
      { id: 'funding-ownership', label: 'Funding & ownership' },
      { id: 'valuation-summary', label: 'Valuation summary' },
    ],
  },
  {
    label: 'Methods',
    items: [
      { id: 'scorecard', label: 'Scorecard method' },
      { id: 'checklist', label: 'Checklist method' },
      { id: 'vc-method', label: 'VC method' },
      { id: 'dcf-ltg', label: 'DCF with LTG' },
      { id: 'dcf-multiple', label: 'DCF with multiple' },
      { id: 'multiples', label: 'Simple multiples' },
    ],
  },
  {
    label: 'Detail',
    items: [
      { id: 'qualitative', label: 'Qualitative assessment' },
      { id: 'default-values', label: 'Updated default values' },
      { id: 'pnl', label: 'Financial projections – P&L' },
      { id: 'cash-flow', label: 'Financial projections – cash flow' },
    ],
  },
  {
    label: 'Appendix',
    items: [
      { id: 'method-weights', label: 'Method weights by stage' },
      { id: 'sources-disclaimer', label: 'Sources & disclaimer' },
    ],
  },
];

const ALL_SECTION_IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

export default function ReportClient({ snapshot, company }: ReportClientProps) {
  const { outputs: report, inputs } = snapshot;
  const snapshotCompany = inputs.company || company;
  const [activeId, setActiveId] = useState<string>('cover');
  const bookRef = useRef<HTMLDivElement>(null);

  // Currency this report's amounts are denominated in. Resolved server-side
  // at compute time (see referenceData.ts's getCurrencyForCountry() and the
  // compute route) and stored on the snapshot's outputs; falls back to the
  // company row's currency, then to USD for any snapshot/company predating
  // this field. Never re-derived here from country -- the stored value is
  // the source of truth for what was actually shown/computed at the time.
  const currency: string = report?.currency || snapshotCompany?.currency || 'USD';
  const fmt = (value: number, decimals?: number) => formatCurrency(value, currency, decimals);

  const handlePrint = () => window.print();

  useEffect(() => {
    function onScroll() {
      let current = ALL_SECTION_IDS[0];
      for (const id of ALL_SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= 120) current = id;
      }
      setActiveId(current);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const getLastYearFinancials = () =>
    (inputs.financials || []).find((f: any) => f.yearOffset === -1) || null;

  const getFcfeByYear = (yearOffset: number) =>
    report.fcfeByYear?.find((f: any) => f.yearOffset === yearOffset);

  const lastYearFinancials = getLastYearFinancials();
  const lastYearRevenue = lastYearFinancials?.revenue || 0;
  const lastYearEbitda = getFcfeByYear(-1)?.ebitda || 0;

  const stageLabel = snapshotCompany.stage
    ? snapshotCompany.stage.charAt(0).toUpperCase() + snapshotCompany.stage.slice(1)
    : '–';

  return (
    <div className="rpt">
      <div className="rpt-topbar">
        <h1>{snapshotCompany.name} – Valuation Report</h1>
        <button onClick={handlePrint} className="rpt-export-btn">
          Export PDF
        </button>
      </div>

      <div className="rpt-shell">
        <nav className="rpt-rail" aria-label="Report sections">
          {NAV.map((group) => (
            <div className="rpt-rail-group" key={group.label}>
              <div className="rpt-rail-group-label">{group.label}</div>
              {group.items.map((item) => (
                <a
                  key={item.id}
                  className={activeId === item.id ? 'active' : ''}
                  onClick={() => goTo(item.id)}
                >
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className="rpt-book" ref={bookRef}>
          {/* Cover */}
          <section id="cover" className="rpt-page rpt-cover">
            <div className="rpt-cover-mark">
              {snapshotCompany.name?.charAt(0)?.toUpperCase() || 'V'}
            </div>
            <div className="rpt-cover-kicker">Valuation Report</div>
            <h2 className="rpt-cover-company">{snapshotCompany.name}</h2>
            <div className="rpt-cover-date">
              As of {new Date(snapshot.created_at).toLocaleDateString()}
            </div>
            <div className="rpt-cover-rule" />
            <div className="rpt-cover-meta">
              <div>
                Generated on <b>{new Date(report.generatedAt).toLocaleDateString()}</b>
              </div>
              <div>
                Prepared via <b>Source Capital Valuation Engine</b>
              </div>
            </div>
          </section>

          {/* About */}
          <section id="about" className="rpt-page">
            <div className="rpt-kicker">Overview</div>
            <h2 className="rpt-title">About This Report</h2>
            <p className="rpt-lede" style={{ marginBottom: 0 }}>
              This valuation report synthesizes six complementary income and market-based approaches to startup valuation: the Scorecard Method (comparing against regional benchmarks), the Checklist Method (assessing business quality criteria), the VC Method (reverse-engineering from exit scenarios), DCF with Long-Term Growth (projecting sustainable terminal cash flow), DCF with Exit Multiple (using comparable company multiples for terminal value), and Simple Multiples (direct comparable company comparison). The final valuation represents a weighted average across these methods, with weights assigned based on the company&apos;s development stage and data quality. Discount rates are calculated using the Capital Asset Pricing Model (CAPM), blending the risk-free rate, industry beta, and equity risk premium for the company&apos;s country.
            </p>
          </section>

          {/* Company summary */}
          <section id="company-summary" className="rpt-page">
            <div className="rpt-kicker">Overview</div>
            <h2 className="rpt-title">Company Summary</h2>
            <div className="rpt-sub">Profile as recorded at time of valuation</div>

            <div className="rpt-field-grid" style={{ marginBottom: 28 }}>
              <Field label="Company Name" value={snapshotCompany.name} />
              <Field label="Stage" value={stageLabel} />
              <Field label="Industry" value={snapshotCompany.industry} />
              <Field label="Country" value={snapshotCompany.country} />
              <Field label="Founded" value={snapshotCompany.started_year} />
              <Field label="Incorporated" value={snapshotCompany.incorporated_year} />
              <Field label="Founders" value={snapshotCompany.founders_count} />
              <Field
                label="Founder Capital Committed"
                value={
                  snapshotCompany.founders_committed_capital
                    ? fmt(snapshotCompany.founders_committed_capital)
                    : null
                }
                numeric
              />
              <Field label="Employees" value={snapshotCompany.employees_count} />
              <Field label="Business Model" value={snapshotCompany.business_model} />
              <Field label="Business Activity" value={snapshotCompany.business_activity} />
              <div className="rpt-field span-2">
                <div className="rpt-field-label">Description</div>
                <div className="rpt-field-value">{snapshotCompany.description || '–'}</div>
              </div>
            </div>

            <div className="rpt-section-h">Latest Operating Performance</div>
            <div className="rpt-table-scroll">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th className="num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Revenue</td>
                    <td className="num">{fmt(lastYearRevenue)}</td>
                  </tr>
                  <tr>
                    <td>EBITDA</td>
                    <td className="num">{fmt(lastYearEbitda)}</td>
                  </tr>
                  <tr>
                    <td>EBITDA Margin</td>
                    <td className="num">
                      {lastYearRevenue > 0 ? formatPercent(lastYearEbitda / lastYearRevenue) : '–'}
                    </td>
                  </tr>
                  <tr>
                    <td>Cash in Hand</td>
                    <td className="num">
                      {inputs.balanceSheet?.cash_and_equivalents
                        ? fmt(inputs.balanceSheet.cash_and_equivalents)
                        : '–'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Forecasts summary */}
          <section id="forecasts" className="rpt-page">
            <div className="rpt-kicker">Overview</div>
            <h2 className="rpt-title">Forecasts Summary</h2>
            <div className="rpt-sub">5-year projection, as entered in the wizard</div>

            <div className="rpt-section-block">
              <div className="rpt-section-h">Revenue Forecast</div>
              <ReportChart
                categories={(inputs.financials || [])
                  .filter((f: any) => f.yearOffset >= 1)
                  .slice(0, 5)
                  .map((f: any) => `Year +${f.yearOffset}`)}
                series={[
                  {
                    name: 'Revenue',
                    values: (inputs.financials || [])
                      .filter((f: any) => f.yearOffset >= 1)
                      .slice(0, 5)
                      .map((f: any) => f.revenue ?? null),
                    color: 'var(--cat-1)',
                  },
                ]}
              />
            </div>

            <div className="rpt-section-block">
              <div className="rpt-section-h">FCFE Forecast</div>
              <ReportChart
                categories={(report.fcfeByYear || [])
                  .filter((f: any) => f.yearOffset >= 1)
                  .map((f: any) => `Year +${f.yearOffset}`)}
                series={[
                  {
                    name: 'FCFE',
                    values: (report.fcfeByYear || [])
                      .filter((f: any) => f.yearOffset >= 1)
                      .map((f: any) => f.fcfe ?? null),
                    color: 'var(--cat-3)',
                  },
                ]}
              />
            </div>
          </section>

          {/* Funding & ownership */}
          <section id="funding-ownership" className="rpt-page">
            <div className="rpt-kicker">Overview</div>
            <h2 className="rpt-title">Funding Rounds &amp; Ownership</h2>

            {inputs.fundingRounds && inputs.fundingRounds.length > 0 && (
              <div className="rpt-section-block">
                <div className="rpt-section-h">Funding History</div>
                <div className="rpt-table-scroll">
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        <th>Round</th>
                        <th>Date</th>
                        <th className="num">Investment</th>
                        <th className="num">Post-Money / Cap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inputs.fundingRounds.map((round: any, idx: number) => (
                        <tr key={idx}>
                          <td>{round.round_name}</td>
                          <td>
                            {round.closed_date
                              ? new Date(round.closed_date).toLocaleDateString()
                              : '–'}
                          </td>
                          <td className="num">{fmt(round.investment_amount)}</td>
                          <td className="num">{fmt(round.post_money_or_cap)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {inputs.capTable && inputs.capTable.length > 0 && (
              <div className="rpt-section-block">
                <div className="rpt-section-h">Cap Table</div>
                <div className="rpt-table-scroll">
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        <th>Shareholder</th>
                        <th className="num">Ownership %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inputs.capTable.map((shareholder: any, idx: number) => (
                        <tr key={idx}>
                          <td>{shareholder.shareholder_name}</td>
                          <td className="num">{formatPercent(shareholder.share_percent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(!inputs.fundingRounds || inputs.fundingRounds.length === 0) &&
              (!inputs.capTable || inputs.capTable.length === 0) && (
                <p className="rpt-muted-dash">No funding or cap table data recorded.</p>
              )}
          </section>

          {/* Valuation summary */}
          <section id="valuation-summary" className="rpt-page">
            <div className="rpt-kicker">Overview</div>
            <h2 className="rpt-title">Valuation Summary</h2>
            <div className="rpt-sub">Weighted across all six methods for this company&apos;s stage</div>

            <div className="rpt-kpi-row">
              <div className="rpt-kpi emph">
                <div className="rpt-kpi-label">Valuation</div>
                <div className="rpt-kpi-value">{fmt(report.weightedValuation)}</div>
              </div>
              <div className="rpt-kpi">
                <div className="rpt-kpi-label">Low Bound (–9.6%)</div>
                <div className="rpt-kpi-value">{fmt(report.lowBound)}</div>
              </div>
              <div className="rpt-kpi">
                <div className="rpt-kpi-label">High Bound (+9.6%)</div>
                <div className="rpt-kpi-value">{fmt(report.highBound)}</div>
              </div>
            </div>

            <div className="rpt-section-h">Method Comparison</div>
            <ReportChart
              categories={(report.perMethod || []).map((m: any) => m.method)}
              series={[
                {
                  name: 'Valuation',
                  values: (report.perMethod || []).map((m: any) => m.valuation ?? null),
                },
              ]}
              height={190}
            />
            <div className="rpt-table-scroll">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th className="num">Valuation</th>
                    <th className="num">Weight</th>
                    <th className="num">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.perMethod || []).map((method: any) => (
                    <tr key={method.method}>
                      <td>{method.method}</td>
                      <td className="num">{fmt(method.valuation)}</td>
                      <td className="num">{formatPercent(method.weight)}</td>
                      <td className="num">{fmt(method.weightedContribution)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Scorecard */}
          <section id="scorecard" className="rpt-page">
            <div className="rpt-kicker">Method</div>
            <h2 className="rpt-title">Scorecard Method</h2>
            <p className="rpt-lede">
              Compares the company against industry benchmarks for factors like team strength, opportunity size, competitive position, product/IP, partnerships, and funding requirements.
            </p>

            {report.methodResults?.scorecard?.criteria && (
              <div className="rpt-table-scroll" style={{ marginBottom: 24 }}>
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Criterion</th>
                      <th className="num">Weight</th>
                      <th className="num">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.methodResults.scorecard.criteria.map((c: any, idx: number) => (
                      <tr key={idx}>
                        <td>{c.key}</td>
                        <td className="num">{formatPercent(c.weight)}</td>
                        <td className="num">{c.score.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rpt-waterfall">
              <div className="rpt-wf-row">
                <span className="k">Regional Baseline (Average Pre-Money)</span>
                <span className="v">
                  {fmt(inputs.parameters?.scorecard?.average_pre_money_valuation || 0)}
                </span>
              </div>
              <div className="rpt-wf-row">
                <span className="k">Scorecard Valuation</span>
                <span className="v">{fmt(report.methodResults?.scorecard?.valuation || 0)}</span>
              </div>
            </div>
          </section>

          {/* Checklist */}
          <section id="checklist" className="rpt-page">
            <div className="rpt-kicker">Method</div>
            <h2 className="rpt-title">Checklist Method</h2>
            <p className="rpt-lede">
              Assigns scores to five key dimensions – Team, Idea, Product/IP, Relationships, and Operating Stage. The weighted sum is capped at the maximum valuation for the company&apos;s region.
            </p>

            {report.methodResults?.checklist?.criteria && (
              <div className="rpt-table-scroll" style={{ marginBottom: 24 }}>
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Criterion</th>
                      <th className="num">Weight</th>
                      <th className="num">Score</th>
                      <th className="num">Achieved Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.methodResults.checklist.criteria.map((c: any, idx: number) => (
                      <tr key={idx}>
                        <td>{c.key}</td>
                        <td className="num">{formatPercent(c.weight)}</td>
                        <td className="num">{c.score.toFixed(2)}</td>
                        <td className="num">{fmt(c.achievedValue || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rpt-waterfall">
              <div className="rpt-wf-row">
                <span className="k">Maximum Valuation (Regional)</span>
                <span className="v">{fmt(inputs.parameters?.checklist?.max_valuation || 0)}</span>
              </div>
              <div className="rpt-wf-row">
                <span className="k">Checklist Valuation</span>
                <span className="v">{fmt(report.methodResults?.checklist?.valuation || 0)}</span>
              </div>
            </div>
          </section>

          {/* VC method */}
          <section id="vc-method" className="rpt-page">
            <div className="rpt-kicker">Method</div>
            <h2 className="rpt-title">VC Method</h2>
            <p className="rpt-lede">
              Projects a terminal valuation based on exit multiples, then discounts it back using a required return rate commensurate with the company&apos;s stage.
            </p>

            <div className="rpt-field-grid" style={{ marginBottom: 24 }}>
              <Field
                label="Exit Multiple"
                value={`${(inputs.parameters?.vc_method?.industry_multiple ?? 0).toFixed(2)}x`}
                numeric
              />
              <Field
                label="Required ROI"
                value={formatPercent(inputs.parameters?.vc_method?.required_roi || 0, 0)}
                numeric
              />
            </div>

            <div className="rpt-waterfall">
              <div className="rpt-wf-row">
                <span className="k">VC Method Valuation</span>
                <span className="v">{fmt(report.methodResults?.vc?.valuation || 0)}</span>
              </div>
            </div>
          </section>

          {/* DCF LTG */}
          <section id="dcf-ltg" className="rpt-page">
            <div className="rpt-kicker">Method</div>
            <h2 className="rpt-title">DCF with Long-Term Growth</h2>
            <p className="rpt-lede">
              Projects free cash flows over 5 years and assumes a steady-state terminal value growing at a long-term rate perpetually.
            </p>

            <div className="rpt-field-grid" style={{ marginBottom: 24 }}>
              <Field label="Discount Rate" value={formatPercent(report.discountRate, 2)} numeric />
              <Field
                label="Terminal Growth Rate"
                value={formatPercent(inputs.parameters?.dcf_ltg?.terminal_growth_rate || 0, 2)}
                numeric
              />
              <Field
                label="Discounted FCF Sum"
                value={fmt(report.methodResults?.dcfLtg?.discountedFcfSum || 0)}
                numeric
              />
              <Field
                label="Terminal Value (Discounted)"
                value={fmt(report.methodResults?.dcfLtg?.discountedTerminalValue || 0)}
                numeric
              />
            </div>

            <div className="rpt-waterfall">
              <div className="rpt-wf-row">
                <span className="k">DCF-LTG Valuation</span>
                <span className="v">{fmt(report.methodResults?.dcfLtg?.valuation || 0)}</span>
              </div>
            </div>
          </section>

          {/* DCF Multiple */}
          <section id="dcf-multiple" className="rpt-page">
            <div className="rpt-kicker">Method</div>
            <h2 className="rpt-title">DCF with Exit Multiple</h2>
            <p className="rpt-lede">
              Uses an industry-specific exit multiple applied to a future revenue or EBITDA figure to set the terminal value.
            </p>

            <div className="rpt-field-grid" style={{ marginBottom: 24 }}>
              <Field
                label="Exit Multiple"
                value={`${(inputs.parameters?.dcf_multiple?.exit_multiple ?? 0).toFixed(2)}x`}
                numeric
              />
              <Field label="Discount Rate" value={formatPercent(report.discountRate, 2)} numeric />
            </div>

            <div className="rpt-waterfall">
              <div className="rpt-wf-row">
                <span className="k">DCF-Multiple Valuation</span>
                <span className="v">{fmt(report.methodResults?.dcfMultiple?.valuation || 0)}</span>
              </div>
            </div>
          </section>

          {/* Simple multiples */}
          <section id="multiples" className="rpt-page">
            <div className="rpt-kicker">Method</div>
            <h2 className="rpt-title">Simple Multiples Method</h2>
            <p className="rpt-lede">
              Values the company by applying the median multiple from comparable companies to the company&apos;s current revenue or EBITDA.
            </p>

            {inputs.comparables && inputs.comparables.length > 0 && (
              <div className="rpt-table-scroll" style={{ marginBottom: 24 }}>
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th className="num">Multiple</th>
                      <th>Metric Type</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inputs.comparables.map((comp: any, idx: number) => (
                      <tr key={idx}>
                        <td>{comp.company_name}</td>
                        <td className="num">{(comp.multiple ?? 0).toFixed(2)}x</td>
                        <td>{comp.metric_type}</td>
                        <td>{comp.source || '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rpt-waterfall">
              <div className="rpt-wf-row">
                <span className="k">Multiples Valuation</span>
                <span className="v">{fmt(report.methodResults?.multiples?.valuation || 0)}</span>
              </div>
            </div>
          </section>

          {/* Qualitative assessment */}
          <section id="qualitative" className="rpt-page">
            <div className="rpt-kicker gold">Detail</div>
            <h2 className="rpt-title">Qualitative Assessment</h2>
            {inputs.questionnaire && (
              <div className="rpt-two-col">
                <div>
                  <div className="rpt-trait-group">
                    <h4 style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 10 }}>Team</h4>
                    <TraitRow k="Team Size" v={inputs.questionnaire.team_size ?? '–'} />
                    <TraitRow k="Has CTO" v={yn(inputs.questionnaire.team_has_cto)} />
                    <TraitRow k="Has Business Lead" v={yn(inputs.questionnaire.team_has_business_lead)} />
                    <TraitRow k="Prior Exits" v={yn(inputs.questionnaire.team_prior_exits)} />
                  </div>
                  <div className="rpt-trait-group">
                    <h4 style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 10 }}>Business Model</h4>
                    <TraitRow k="Business Model Type" v={inputs.questionnaire.business_model_type || '–'} />
                    <TraitRow k="Recurring Revenue" v={yn(inputs.questionnaire.recurring_revenue)} />
                    <TraitRow
                      k="TAM Size"
                      v={inputs.questionnaire.tam_size ? fmt(inputs.questionnaire.tam_size) : '–'}
                    />
                    <TraitRow
                      k="Market Growth Rate"
                      v={
                        inputs.questionnaire.market_growth_rate
                          ? formatPercent(inputs.questionnaire.market_growth_rate)
                          : '–'
                      }
                    />
                  </div>
                </div>
                <div>
                  <div className="rpt-trait-group">
                    <h4 style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 10 }}>Product &amp; Market</h4>
                    <TraitRow k="Product Status" v={inputs.questionnaire.product_status || '–'} />
                    <TraitRow k="Has Customers" v={yn(inputs.questionnaire.has_customers)} />
                    <TraitRow k="Product-Market Fit" v={yn(inputs.questionnaire.product_market_fit)} />
                  </div>
                  <div className="rpt-trait-group">
                    <h4 style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 10 }}>IP &amp; Legal</h4>
                    <TraitRow k="Has Patents" v={yn(inputs.questionnaire.has_patents)} />
                    <TraitRow k="Has IP" v={yn(inputs.questionnaire.has_ip)} />
                    <TraitRow k="IP Protection Stage" v={inputs.questionnaire.ip_protection_stage || '–'} />
                    <TraitRow k="Legal Risks" v={yn(inputs.questionnaire.legal_risks)} />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Updated default values */}
          <section id="default-values" className="rpt-page">
            <div className="rpt-kicker gold">Detail</div>
            <h2 className="rpt-title">Updated Default Values</h2>
            <p className="rpt-lede">
              Parameters overridden from the platform&apos;s baseline for this company.
            </p>
            <DefaultValuesTable snapshotCompany={snapshotCompany} inputs={inputs} currency={currency} />
          </section>

          {/* P&L */}
          <section id="pnl" className="rpt-page">
            <div className="rpt-kicker gold">Detail</div>
            <h2 className="rpt-title">Financial Projections – P&amp;L</h2>
            {inputs.financials && inputs.financials.length > 0 && (
              <div className="rpt-table-scroll">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {inputs.financials.map((f: any, idx: number) => (
                        <th key={idx} className="num">
                          Year {f.yearOffset >= 0 ? '+' : ''}
                          {f.yearOffset}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <PnlRow label="Revenue" values={inputs.financials.map((f: any) => f.revenue)} currency={currency} />
                    <PnlRow label="COGS" values={inputs.financials.map((f: any) => f.cogs)} currency={currency} />
                    <PnlRow label="Salaries" values={inputs.financials.map((f: any) => f.salaries)} currency={currency} />
                    <PnlRow label="OpEx" values={inputs.financials.map((f: any) => f.otherOpex)} currency={currency} />
                    <PnlRow
                      label="EBITDA"
                      bold
                      values={report.fcfeByYear.map((f: any) => f.ebitda)}
                      currency={currency}
                    />
                    <tr>
                      <td>EBITDA Margin</td>
                      {inputs.financials.map((f: any, idx: number) => {
                        const ebitda = report.fcfeByYear[idx]?.ebitda || 0;
                        return (
                          <td key={idx} className="num">
                            {f.revenue ? formatPercent(ebitda / f.revenue) : '–'}
                          </td>
                        );
                      })}
                    </tr>
                    <PnlRow label="D&amp;A" values={report.fcfeByYear.map((f: any) => f.da)} currency={currency} />
                    <PnlRow label="EBIT" bold values={report.fcfeByYear.map((f: any) => f.ebit)} currency={currency} />
                    <tr>
                      <td>EBIT Margin</td>
                      {inputs.financials.map((f: any, idx: number) => {
                        const ebit = report.fcfeByYear[idx]?.ebit || 0;
                        return (
                          <td key={idx} className="num">
                            {f.revenue ? formatPercent(ebit / f.revenue) : '–'}
                          </td>
                        );
                      })}
                    </tr>
                    <PnlRow label="Interest" values={inputs.financials.map((f: any) => f.interest)} currency={currency} />
                    <PnlRow label="EBT" values={report.fcfeByYear.map((f: any) => f.ebt)} currency={currency} />
                    <PnlRow label="Taxes" values={inputs.financials.map((f: any) => f.taxes)} currency={currency} />
                    <PnlRow
                      label="Net Profit"
                      bold
                      values={report.fcfeByYear.map((f: any) => f.netIncome)}
                      currency={currency}
                    />
                    <tr>
                      <td>Net Margin</td>
                      {inputs.financials.map((f: any, idx: number) => {
                        const netIncome = report.fcfeByYear[idx]?.netIncome || 0;
                        return (
                          <td key={idx} className="num">
                            {f.revenue ? formatPercent(netIncome / f.revenue) : '–'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Cash flow */}
          <section id="cash-flow" className="rpt-page">
            <div className="rpt-kicker gold">Detail</div>
            <h2 className="rpt-title">Financial Projections – Cash Flow</h2>
            {report.fcfeByYear && report.fcfeByYear.length > 0 && inputs.financials && (
              <div className="rpt-table-scroll">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {inputs.financials.map((f: any, idx: number) => (
                        <th key={idx} className="num">
                          Year {f.yearOffset >= 0 ? '+' : ''}
                          {f.yearOffset}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <PnlRow label="Net Income" values={report.fcfeByYear.map((f: any) => f.netIncome)} currency={currency} />
                    <PnlRow label="D&amp;A" values={report.fcfeByYear.map((f: any) => f.da)} currency={currency} />
                    <PnlRow label="ΔWorking Capital" values={report.fcfeByYear.map((f: any) => f.deltaWc)} currency={currency} />
                    <PnlRow
                      label="Working Capital"
                      values={inputs.financials.map(
                        (f: any) => (f.receivables || 0) + (f.inventory || 0) - (f.payables || 0)
                      )}
                      currency={currency}
                    />
                    <PnlRow label="Receivables" values={inputs.financials.map((f: any) => f.receivables || 0)} currency={currency} />
                    <PnlRow label="Inventory" values={inputs.financials.map((f: any) => f.inventory || 0)} currency={currency} />
                    <PnlRow label="Payables" values={inputs.financials.map((f: any) => f.payables || 0)} currency={currency} />
                    <PnlRow label="Capex" values={inputs.financials.map((f: any) => f.capex || 0)} currency={currency} />
                    <PnlRow label="ΔDebt" values={report.fcfeByYear.map((f: any) => f.deltaDebt)} currency={currency} />
                    <PnlRow label="Debt (Year-end)" values={inputs.financials.map((f: any) => f.debt || 0)} currency={currency} />
                    <PnlRow
                      label="Equity Fundraising"
                      values={inputs.financials.map((f: any) => f.fundraisingPlan || 0)}
                      currency={currency}
                    />
                    <PnlRow label="FCFE" bold values={report.fcfeByYear.map((f: any) => f.fcfe)} currency={currency} />
                    <PnlRow
                      label="Free Cash Flow (FCFE + Fundraising)"
                      bold
                      values={inputs.financials.map((f: any, idx: number) => {
                        const fcfe = report.fcfeByYear[idx]?.fcfe || 0;
                        return fcfe + (f.fundraisingPlan || 0);
                      })}
                      currency={currency}
                    />
                    <tr className="row-sub">
                      <td>Cash Balance (Illustrative)</td>
                      {inputs.financials.map((f: any, idx: number) => {
                        let cashBalance = inputs.balanceSheet?.cash_and_equivalents || 0;
                        for (let i = 0; i <= idx; i++) {
                          const fcfe = report.fcfeByYear[i]?.fcfe || 0;
                          const freeCF = fcfe + (inputs.financials[i]?.fundraisingPlan || 0);
                          cashBalance += freeCF;
                        }
                        return (
                          <td key={idx} className="num">
                            {fmt(cashBalance)}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Appendix: method weights */}
          <section id="method-weights" className="rpt-page">
            <div className="rpt-kicker gold">Appendix</div>
            <h2 className="rpt-title">Method Weights by Stage</h2>
            <div className="rpt-table-scroll">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th className="num">Scorecard</th>
                    <th className="num">Checklist</th>
                    <th className="num">VC</th>
                    <th className="num">DCF-LTG</th>
                    <th className="num">DCF-Multi</th>
                    <th className="num">Multiples</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(STAGE_DEFAULT_WEIGHTS).map(([stage, weights]: [string, any]) => (
                    <tr
                      key={stage}
                      style={
                        snapshotCompany.stage === stage
                          ? { background: 'var(--accent-soft)', fontWeight: 600 }
                          : undefined
                      }
                    >
                      <td>{stage}</td>
                      <td className="num">{formatPercent(weights.scorecard)}</td>
                      <td className="num">{formatPercent(weights.checklist)}</td>
                      <td className="num">{formatPercent(weights.vc)}</td>
                      <td className="num">{formatPercent(weights.dcf_ltg)}</td>
                      <td className="num">{formatPercent(weights.dcf_multiple)}</td>
                      <td className="num">{formatPercent(weights.multiples)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Appendix: sources & disclaimer */}
          <section id="sources-disclaimer" className="rpt-page">
            <div className="rpt-kicker gold">Appendix</div>
            <h2 className="rpt-title">Data Sources &amp; Disclaimer</h2>

            <div className="rpt-section-block">
              <div className="rpt-section-h">Data Sources</div>
              <div className="rpt-callout">
                Country pre-money/max valuation baselines: Equidam Parameters Update, Feb 2026, derived from 30 months of real transaction data. Discount rate: CAPM (risk-free rate from Trading Economics, beta from Damodaran/NYU Stern, equity risk premium from Damodaran). Industry multiples: Equidam TRBC published data (July 2026) and Damodaran unlevered beta (Jan 2026).
              </div>
            </div>

            <div className="rpt-section-block">
              <div className="rpt-section-h">Disclaimer</div>
              <div className="rpt-callout">
                This valuation is illustrative and based on the data provided. It should not be considered financial advice. Consult with professional advisors before making investment decisions. All assumptions and data are subject to change.
              </div>
            </div>

            <div className="rpt-page-footer">
              <span>Source Capital Valuation Engine</span>
              <span>Report generated on {new Date(report.generatedAt).toLocaleDateString()}</span>
            </div>
          </section>

          <div className="rpt-footer">
            Vantage Metrics Ltd Valuation Report · Generated {new Date(report.generatedAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function yn(v: any) {
  return v ? 'Yes' : 'No';
}

function Field({
  label,
  value,
  numeric,
}: {
  label: string;
  value: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className="rpt-field">
      <div className="rpt-field-label">{label}</div>
      <div className={`rpt-field-value${numeric ? ' num' : ''}`}>
        {value === null || value === undefined || value === '' ? '–' : value}
      </div>
    </div>
  );
}

function TraitRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '5px 0',
        borderBottom: '1px dashed var(--border)',
        fontSize: 12.5,
      }}
    >
      <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

function PnlRow({
  label,
  values,
  bold,
  currency,
}: {
  label: string;
  values: number[];
  bold?: boolean;
  currency: string;
}) {
  return (
    <tr className={bold ? 'row-total' : undefined}>
      <td>{label}</td>
      {values.map((v, idx) => (
        <td key={idx} className="num">
          {formatCurrency(v || 0, currency)}
        </td>
      ))}
    </tr>
  );
}

function DefaultValuesTable({
  snapshotCompany,
  inputs,
  currency,
}: {
  snapshotCompany: any;
  inputs: any;
  currency: string;
}) {
  const defaultParams = buildDefaultParameters(
    {
      name: snapshotCompany.name,
      country: snapshotCompany.country,
      industry: snapshotCompany.industry,
      stage: snapshotCompany.stage,
    },
    inputs.financials || [],
    inputs.balanceSheet
  );

  const fields: { label: string; current: number; default: number; format: 'currency' | 'percent' }[] = [];

  if (inputs.parameters?.dcf_shared?.discount_rate !== defaultParams.dcf_shared.discount_rate) {
    fields.push({
      label: 'Discount Rate',
      current: inputs.parameters?.dcf_shared?.discount_rate || 0,
      default: defaultParams.dcf_shared.discount_rate,
      format: 'percent',
    });
  }
  if (inputs.parameters?.vc_method?.industry_multiple !== defaultParams.vc_method.industry_multiple) {
    fields.push({
      label: 'VC Method Exit Multiple',
      current: inputs.parameters?.vc_method?.industry_multiple || 0,
      default: defaultParams.vc_method.industry_multiple,
      format: 'currency',
    });
  }
  if (inputs.parameters?.dcf_multiple?.exit_multiple !== defaultParams.dcf_multiple.exit_multiple) {
    fields.push({
      label: 'DCF Multiple Exit Multiple',
      current: inputs.parameters?.dcf_multiple?.exit_multiple || 0,
      default: defaultParams.dcf_multiple.exit_multiple,
      format: 'currency',
    });
  }
  if (
    inputs.parameters?.scorecard?.average_pre_money_valuation !==
    defaultParams.scorecard.average_pre_money_valuation
  ) {
    fields.push({
      label: 'Scorecard Average Pre-Money',
      current: inputs.parameters?.scorecard?.average_pre_money_valuation || 0,
      default: defaultParams.scorecard.average_pre_money_valuation,
      format: 'currency',
    });
  }
  if (inputs.parameters?.checklist?.max_valuation !== defaultParams.checklist.max_valuation) {
    fields.push({
      label: 'Checklist Maximum Valuation',
      current: inputs.parameters?.checklist?.max_valuation || 0,
      default: defaultParams.checklist.max_valuation,
      format: 'currency',
    });
  }
  if (inputs.parameters?.dcf_ltg?.terminal_growth_rate !== defaultParams.dcf_ltg.terminal_growth_rate) {
    fields.push({
      label: 'DCF Terminal Growth Rate',
      current: inputs.parameters?.dcf_ltg?.terminal_growth_rate || 0,
      default: defaultParams.dcf_ltg.terminal_growth_rate,
      format: 'percent',
    });
  }
  if (
    inputs.parameters?.dcf_shared?.illiquidity_discount !== defaultParams.dcf_shared.illiquidity_discount
  ) {
    fields.push({
      label: 'Illiquidity Discount',
      current: inputs.parameters?.dcf_shared?.illiquidity_discount || 0,
      default: defaultParams.dcf_shared.illiquidity_discount,
      format: 'percent',
    });
  }

  if (fields.length === 0) {
    return <p className="rpt-muted-dash">No parameters were overridden – this report uses platform defaults throughout.</p>;
  }

  return (
    <div className="rpt-table-scroll">
      <table className="rpt-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th className="num">Platform Default</th>
            <th className="num">Used Value</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, idx) => (
            <tr key={idx}>
              <td>{field.label}</td>
              <td className="num">
                {field.format === 'percent' ? formatPercent(field.default, 2) : formatCurrency(field.default, currency)}
              </td>
              <td className="num">
                {field.format === 'percent' ? formatPercent(field.current, 2) : formatCurrency(field.current, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
