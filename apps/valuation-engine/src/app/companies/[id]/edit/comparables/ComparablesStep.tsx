'use client';

import { useState, useEffect } from 'react';
import { C, FONT_SANS } from '@/lib/theme';

interface ComparablesStepProps {
  company: any;
  onUpdate?: (data: any) => void;
}

interface Comparable {
  id: string;
  companyName: string;
  metric: number;
  multiple: number;
  metricType: 'revenue' | 'ebitda';
  source: string;
}

export default function ComparablesStep({ company, onUpdate }: ComparablesStepProps) {
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [newComparable, setNewComparable] = useState({
    companyName: '',
    metric: 0,
    multiple: 0,
    metricType: 'revenue' as 'revenue' | 'ebitda',
    source: '',
  });

  useEffect(() => {
    if (onUpdate) {
      onUpdate({ companies: comparables });
    }
  }, [comparables]);

  const handleAddComparable = () => {
    if (newComparable.companyName && newComparable.multiple > 0) {
      setComparables((prev) => [
        ...prev,
        { id: Date.now().toString(), ...newComparable },
      ]);
      setNewComparable({
        companyName: '',
        metric: 0,
        multiple: 0,
        metricType: 'revenue',
        source: '',
      });
    }
  };

  const handleRemoveComparable = (id: string) => {
    setComparables((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateComparable = (id: string, field: string, value: any) => {
    setComparables((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  const containerStyle: React.CSSProperties = {
    fontFamily: FONT_SANS,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '1.5rem',
    color: C.accent,
  };

  const formStyle: React.CSSProperties = {
    backgroundColor: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: '0.5rem',
    padding: '1.5rem',
    marginBottom: '2rem',
  };

  const formGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    marginBottom: '1rem',
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '1rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: C.text,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    border: `1px solid ${C.border}`,
    backgroundColor: C.bg,
    color: C.text,
    fontSize: '0.9rem',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  };

  const thStyle: React.CSSProperties = {
    backgroundColor: C.border,
    color: C.text,
    padding: '0.75rem',
    textAlign: 'left',
    fontWeight: 600,
    borderBottom: `1px solid ${C.border}`,
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem',
    borderBottom: `1px solid ${C.border}`,
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    borderRadius: '0.375rem',
    border: 'none',
    backgroundColor: C.accent,
    color: C.bg,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const deleteButtonStyle: React.CSSProperties = {
    padding: '0.4rem 0.8rem',
    borderRadius: '0.25rem',
    border: 'none',
    backgroundColor: '#dc2626',
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const medianMultiple = comparables.length > 0
    ? (() => {
        const multiples = comparables.map((c) => c.multiple).sort((a, b) => a - b);
        const mid = Math.floor(multiples.length / 2);
        return multiples.length % 2 === 0
          ? (multiples[mid - 1] + multiples[mid]) / 2
          : multiples[mid];
      })()
    : 0;

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>Comparable Companies</h3>

      <div style={formStyle}>
        <p style={{ color: C.textMuted, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Add comparable public companies or recent M&A transactions to calculate valuation via multiples method
        </p>

        <div style={formGridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Company Name</label>
            <input
              type="text"
              value={newComparable.companyName}
              onChange={(e) => setNewComparable({ ...newComparable, companyName: e.target.value })}
              placeholder="e.g., Slack, Dropbox"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Metric Type</label>
            <select
              value={newComparable.metricType}
              onChange={(e) =>
                setNewComparable({ ...newComparable, metricType: e.target.value as 'revenue' | 'ebitda' })
              }
              style={inputStyle}
            >
              <option value="revenue">Revenue</option>
              <option value="ebitda">EBITDA</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Last Year {newComparable.metricType === 'revenue' ? 'Revenue' : 'EBITDA'}</label>
            <input
              type="number"
              min="0"
              value={newComparable.metric}
              onChange={(e) => setNewComparable({ ...newComparable, metric: parseInt(e.target.value) || 0 })}
              placeholder="USD"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Multiple (Valuation / Metric)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={newComparable.multiple}
              onChange={(e) => setNewComparable({ ...newComparable, multiple: parseFloat(e.target.value) || 0 })}
              placeholder="e.g., 5.5"
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: '1 / -1', ...fieldStyle }}>
            <label style={labelStyle}>Source (optional)</label>
            <input
              type="text"
              value={newComparable.source}
              onChange={(e) => setNewComparable({ ...newComparable, source: e.target.value })}
              placeholder="e.g., S-1 Filing, Crunchbase"
              style={inputStyle}
            />
          </div>
        </div>

        <button onClick={handleAddComparable} style={buttonStyle}>
          + Add Comparable
        </button>
      </div>

      {comparables.length > 0 && (
        <div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Metric</th>
                <th style={thStyle}>Multiple</th>
                <th style={thStyle}>Metric Type</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {comparables.map((comp) => (
                <tr key={comp.id}>
                  <td style={tdStyle}>
                    <input
                      type="text"
                      value={comp.companyName}
                      onChange={(e) => handleUpdateComparable(comp.id, 'companyName', e.target.value)}
                      style={{
                        ...inputStyle,
                        padding: '0.4rem',
                      }}
                    />
                  </td>
                  <td style={tdStyle}>${comp.metric.toLocaleString()}</td>
                  <td style={tdStyle}>{comp.multiple.toFixed(2)}x</td>
                  <td style={tdStyle}>{comp.metricType}</td>
                  <td style={tdStyle}>{comp.source}</td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => handleRemoveComparable(comp.id)}
                      style={deleteButtonStyle}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              backgroundColor: C.border,
              borderRadius: '0.5rem',
              padding: '1rem',
              marginTop: '1rem',
            }}
          >
            <p style={{ color: C.text, fontSize: '0.95rem', fontWeight: 600 }}>
              Median Multiple: {medianMultiple.toFixed(2)}x
            </p>
            <p style={{ color: C.textMuted, fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Used for Simple Multiples valuation method
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
