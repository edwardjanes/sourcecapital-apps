'use client';

import { useState, useEffect } from 'react';
import { C, FONT_SANS, FONT_MONO } from '@/lib/theme';
import { ValidationIssue, fieldIssue, financialFieldKey } from '@/lib/valuation/validation';

interface FinancialsStepProps {
  company: any;
  onUpdate?: (data: any) => void;
  issues?: ValidationIssue[];
  showErrors?: boolean;
}

interface FinancialRow {
  yearOffset: number;
  revenue: number;
  cogs: number;
  salaries: number;
  otherOpex: number;
  totalDa: number;
  interest: number;
  taxes: number;
  receivables: number;
  inventory: number;
  payables: number;
  capex: number;
  debt: number;
  fundraisingPlan: number;
}

export default function FinancialsStep({ company, onUpdate, issues, showErrors }: FinancialsStepProps) {
  const [financials, setFinancials] = useState<FinancialRow[]>(
    Array.from({ length: 7 }, (_, i) => ({
      yearOffset: i - 1,
      revenue: 0,
      cogs: 0,
      salaries: 0,
      otherOpex: 0,
      totalDa: 0,
      interest: 0,
      taxes: 0,
      receivables: 0,
      inventory: 0,
      payables: 0,
      capex: 0,
      debt: 0,
      fundraisingPlan: 0,
    }))
  );

  const [activeTab, setActiveTab] = useState<'income' | 'balance'>('income');
  const [nonOperatingCash, setNonOperatingCash] = useState(0);
  const [cashAndEquivalents, setCashAndEquivalents] = useState(0);

  useEffect(() => {
    if (onUpdate) {
      onUpdate({
        financials,
        balanceSheet: { non_operating_cash: nonOperatingCash, cash_and_equivalents: cashAndEquivalents },
      });
    }
  }, [financials, nonOperatingCash, cashAndEquivalents]);

  const handleCellChange = (yearOffset: number, field: keyof FinancialRow, value: number) => {
    setFinancials((prev) =>
      prev.map((row) =>
        row.yearOffset === yearOffset ? { ...row, [field]: value } : row
      )
    );
  };

  const getYearLabel = (offset: number): string => {
    if (offset === -1) return 'Previous';
    if (offset === 0) return 'Current';
    return `Year +${offset}`;
  };

  const containerStyle: React.CSSProperties = {
    fontFamily: FONT_SANS,
  };

  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '1rem',
    borderBottom: `1px solid ${C.border}`,
    marginBottom: '2rem',
  };

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '0.75rem 1.5rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: isActive ? C.accent : C.textMuted,
    borderBottom: isActive ? `2px solid ${C.accent}` : 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: isActive ? 600 : 500,
  });

  const scrollContainerStyle: React.CSSProperties = {
    overflowX: 'auto',
    marginBottom: '2rem',
  };

  const tableStyle: React.CSSProperties = {
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
    width: '100%',
    minWidth: '800px',
  };

  const thStyle: React.CSSProperties = {
    backgroundColor: C.border,
    color: C.text,
    padding: '0.75rem',
    textAlign: 'left',
    borderBottom: `1px solid ${C.border}`,
    fontWeight: 600,
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.5rem',
    borderBottom: `1px solid ${C.border}`,
  };

  const labelCellStyle: React.CSSProperties = {
    ...tdStyle,
    backgroundColor: C.panel,
    fontWeight: 500,
    minWidth: '150px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem',
    border: `1px solid ${C.border}`,
    borderRadius: '0.25rem',
    backgroundColor: C.bg,
    color: C.text,
    fontSize: '0.85rem',
    fontFamily: FONT_MONO,
  };

  const errorInputStyle: React.CSSProperties = { ...inputStyle, border: '1px solid #ef4444' };

  // Only surface errors once WizardShell has marked this step "touched" (Next/Generate was blocked,
  // or the step was revisited after that) -- otherwise a blank financials table would greet the user
  // with nothing wrong (all-zero passes validation), so this mainly matters after real negative entry.
  const cellIssue = (yearOffset: number, key: string) =>
    showErrors ? fieldIssue(issues, financialFieldKey(yearOffset, key as any)) : undefined;
  const blockingIssues = showErrors ? (issues || []).filter((i) => i.severity === 'error') : [];

  const renderIncomeTab = () => (
    <div style={scrollContainerStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Income Statement</th>
            {financials.map((row) => (
              <th key={row.yearOffset} style={thStyle}>
                {getYearLabel(row.yearOffset)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { key: 'revenue', label: 'Revenue' },
            { key: 'cogs', label: 'COGS' },
            { key: 'salaries', label: 'Salaries' },
            { key: 'otherOpex', label: 'Other OpEx' },
            { key: 'totalDa', label: 'D&A' },
            { key: 'interest', label: 'Interest' },
            { key: 'taxes', label: 'Taxes' },
          ].map((field) => (
            <tr key={field.key}>
              <td style={labelCellStyle}>{field.label}</td>
              {financials.map((row) => {
                const issue = cellIssue(row.yearOffset, field.key);
                return (
                  <td key={row.yearOffset} style={tdStyle}>
                    <input
                      type="number"
                      value={row[field.key as keyof FinancialRow] || 0}
                      onChange={(e) =>
                        handleCellChange(row.yearOffset, field.key as keyof FinancialRow, parseInt(e.target.value) || 0)
                      }
                      placeholder="0"
                      style={issue ? errorInputStyle : inputStyle}
                      title={issue?.message}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderBalanceTab = () => (
    <div style={scrollContainerStyle}>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: C.accent }}>Cash & Equivalents</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Cash & Equivalents (Base Year)
            </label>
            <input
              type="number"
              value={cashAndEquivalents}
              onChange={(e) => setCashAndEquivalents(parseFloat(e.target.value) || 0)}
              placeholder="0"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: `1px solid ${showErrors && fieldIssue(issues, 'cash_and_equivalents') ? '#ef4444' : C.border}`,
                backgroundColor: C.bg,
                color: C.text,
                fontFamily: FONT_MONO,
              }}
            />
            {showErrors && fieldIssue(issues, 'cash_and_equivalents') && (
              <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                {fieldIssue(issues, 'cash_and_equivalents')!.message}
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Non-Operating Cash (Base Year)
            </label>
            <input
              type="number"
              value={nonOperatingCash}
              onChange={(e) => setNonOperatingCash(parseFloat(e.target.value) || 0)}
              placeholder="0"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: `1px solid ${showErrors && fieldIssue(issues, 'non_operating_cash') ? '#ef4444' : C.border}`,
                backgroundColor: C.bg,
                color: C.text,
                fontFamily: FONT_MONO,
              }}
            />
            {showErrors && fieldIssue(issues, 'non_operating_cash') && (
              <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                {fieldIssue(issues, 'non_operating_cash')!.message}
              </div>
            )}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: C.accent }}>Per-Year Cash Flow</h3>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Cash Flow & Assets</th>
            {financials.map((row) => (
              <th key={row.yearOffset} style={thStyle}>
                {getYearLabel(row.yearOffset)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { key: 'receivables', label: 'Receivables' },
            { key: 'inventory', label: 'Inventory' },
            { key: 'payables', label: 'Payables' },
            { key: 'capex', label: 'CapEx' },
            { key: 'debt', label: 'Debt' },
            { key: 'fundraisingPlan', label: 'Fundraising Plan' },
          ].map((field) => (
            <tr key={field.key}>
              <td style={labelCellStyle}>{field.label}</td>
              {financials.map((row) => {
                const issue = cellIssue(row.yearOffset, field.key);
                return (
                  <td key={row.yearOffset} style={tdStyle}>
                    <input
                      type="number"
                      value={row[field.key as keyof FinancialRow] || 0}
                      onChange={(e) =>
                        handleCellChange(row.yearOffset, field.key as keyof FinancialRow, parseInt(e.target.value) || 0)
                      }
                      placeholder="0"
                      style={issue ? errorInputStyle : inputStyle}
                      title={issue?.message}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={containerStyle}>
      {blockingIssues.length > 0 && (
        <div
          style={{
            backgroundColor: '#3a1a1a',
            border: '1px solid #ef4444',
            borderRadius: '0.5rem',
            padding: '0.85rem 1.1rem',
            marginBottom: '1.5rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>
            {blockingIssues.length} value{blockingIssues.length === 1 ? '' : 's'} can't be negative -- the
            flagged cells are outlined below:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {blockingIssues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div style={tabsStyle}>
        <button
          onClick={() => setActiveTab('income')}
          style={tabButtonStyle(activeTab === 'income')}
        >
          Income Statement
        </button>
        <button
          onClick={() => setActiveTab('balance')}
          style={tabButtonStyle(activeTab === 'balance')}
        >
          Balance Sheet & Cash Flow
        </button>
      </div>

      {activeTab === 'income' && renderIncomeTab()}
      {activeTab === 'balance' && renderBalanceTab()}

      <div style={{ color: C.textMuted, fontSize: '0.85rem', marginTop: '1rem' }}>
        <p>• Year -1 = Previous year (for reference)</p>
        <p>• Year 0 = Current/recent year</p>
        <p>• Year +1 to +5 = Projected years</p>
        <p>• All values in USD</p>
      </div>
    </div>
  );
}
