'use client';

import { useState, useEffect } from 'react';
import { C, FONT_SANS, FONT_MONO } from '@/lib/theme';
import { STAGE_DEFAULT_WEIGHTS } from '@/lib/valuation/referenceData';

interface ParametersStepProps {
  company: any;
  stage?: string;
  onUpdate?: (data: any) => void;
  onGenerateReport?: () => void;
  isLoading?: boolean;
  // True when the Profile, Questionnaire, or Financials step has an unresolved required-field error --
  // clicking "Generate Report" in that state jumps back to the offending step instead of submitting.
  blockedByOtherSteps?: boolean;
}

export default function ParametersStep({ company, stage, onUpdate, onGenerateReport, isLoading, blockedByOtherSteps }: ParametersStepProps) {
  const getDefaultWeights = () => {
    if (!stage) return STAGE_DEFAULT_WEIGHTS.development;
    const normalized = stage.toLowerCase();
    return STAGE_DEFAULT_WEIGHTS[normalized as keyof typeof STAGE_DEFAULT_WEIGHTS] || STAGE_DEFAULT_WEIGHTS.development;
  };

  const [weights, setWeights] = useState(getDefaultWeights());
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (onUpdate) {
      onUpdate({ method_weights: weights });
    }
  }, [weights]);

  useEffect(() => {
    if (!isDirty) {
      setWeights(getDefaultWeights());
    }
  }, [stage, isDirty]);

  const handleWeightChange = (method: string, value: number) => {
    setIsDirty(true);
    setWeights((prev) => ({ ...prev, [method]: value }));
  };

  const handleResetToDefaults = () => {
    setWeights(getDefaultWeights());
    setIsDirty(false);
  };

  const totalWeight = Object.values(weights).reduce((a: number, b: number) => a + b, 0);
  const isValid = Math.abs(totalWeight - 1.0) < 0.001;

  const containerStyle: React.CSSProperties = {
    fontFamily: FONT_SANS,
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '2rem',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '1.5rem',
    color: C.accent,
  };

  const methodStyle: React.CSSProperties = {
    marginBottom: '1.5rem',
    padding: '1rem',
    backgroundColor: C.bg,
    borderRadius: '0.375rem',
    border: `1px solid ${C.border}`,
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
    fontSize: '0.95rem',
    fontWeight: 500,
  };

  const sliderStyle: React.CSSProperties = {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    backgroundColor: C.border,
    outline: 'none',
    cursor: 'pointer',
  };

  const weightDisplayStyle: React.CSSProperties = {
    fontFamily: FONT_MONO,
    fontSize: '0.9rem',
    fontWeight: 600,
    color: C.accent,
  };

  const summaryStyle: React.CSSProperties = {
    backgroundColor: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: '0.5rem',
    padding: '1.5rem',
    marginBottom: '2rem',
  };

  const summaryGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
    marginBottom: '1rem',
  };

  const summaryItemStyle: React.CSSProperties = {
    padding: '1rem',
    backgroundColor: C.bg,
    borderRadius: '0.375rem',
    border: `1px solid ${C.border}`,
  };

  const summaryLabelStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color: C.textMuted,
    marginBottom: '0.5rem',
  };

  const summaryValueStyle: React.CSSProperties = {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: C.text,
    fontFamily: FONT_MONO,
  };

  const buttonStyle: React.CSSProperties = {
    padding: '1rem 2rem',
    borderRadius: '0.5rem',
    border: 'none',
    backgroundColor: isValid ? C.accent : C.border,
    color: isValid ? C.bg : C.textMuted,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: isValid ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s',
    width: '100%',
  };

  return (
    <div style={containerStyle}>
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={sectionTitleStyle}>Valuation Method Weights</h3>
            <p style={{ color: C.textMuted, fontSize: '0.9rem', marginTop: '-1rem' }}>
              Adjust the weight of each valuation method. Weights must sum to 100%.
            </p>
          </div>
          {isDirty && (
            <button
              onClick={handleResetToDefaults}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: `1px solid ${C.accent}`,
                backgroundColor: 'transparent',
                color: C.accent,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              ↻ Reset to Defaults
            </button>
          )}
        </div>

        {[
          { key: 'scorecard', label: 'Scorecard' },
          { key: 'checklist', label: 'Checklist' },
          { key: 'vc', label: 'VC Method' },
          { key: 'dcf_ltg', label: 'DCF (LTG)' },
          { key: 'dcf_multiple', label: 'DCF (Multiple)' },
          { key: 'multiples', label: 'Simple Multiples' },
        ].map((method) => (
          <div key={method.key} style={methodStyle}>
            <div style={labelStyle}>
              <span>{method.label}</span>
              <span style={weightDisplayStyle}>{(weights[method.key as keyof typeof weights] * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={weights[method.key as keyof typeof weights]}
              onChange={(e) => handleWeightChange(method.key, parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </div>
        ))}
      </div>

      <div style={summaryStyle}>
        <div style={summaryGridStyle}>
          <div style={summaryItemStyle}>
            <div style={summaryLabelStyle}>Total Weight</div>
            <div style={summaryValueStyle}>{(totalWeight * 100).toFixed(1)}%</div>
          </div>
          <div style={summaryItemStyle}>
            <div style={summaryLabelStyle}>Status</div>
            <div style={{ ...summaryValueStyle, color: isValid ? '#10b981' : '#ef4444' }}>
              {isValid ? '✓ Valid' : '✗ Invalid'}
            </div>
          </div>
        </div>
        {!isValid && (
          <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>
            Weights must sum to exactly 100%. Current total: {(totalWeight * 100).toFixed(1)}%
          </p>
        )}
      </div>

      {blockedByOtherSteps && (
        <div
          style={{
            backgroundColor: '#3a1a1a',
            border: '1px solid #ef4444',
            borderRadius: '0.5rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            color: '#fca5a5',
            fontSize: '0.9rem',
          }}
        >
          Some required fields on an earlier step still need attention. Clicking "Generate Report" will
          take you back to fix them.
        </div>
      )}

      <div style={sectionStyle}>
        <button
          onClick={onGenerateReport}
          disabled={isLoading || !isValid}
          style={buttonStyle}
        >
          {isLoading
            ? '📊 Generating Report...'
            : blockedByOtherSteps
            ? '📊 Review Required Fields'
            : '📊 Generate Valuation Report'}
        </button>
        <p style={{ color: C.textMuted, fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center' }}>
          This will compute valuations using all methods and generate your report.
        </p>
      </div>
    </div>
  );
}
