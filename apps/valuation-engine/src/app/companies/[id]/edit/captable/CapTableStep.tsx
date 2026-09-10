'use client';

import { useState, useEffect } from 'react';
import { C, FONT_SANS } from '@/lib/theme';

interface CapTableStepProps {
  company: any;
  onUpdate?: (data: any) => void;
}

interface Shareholder {
  id: string;
  name: string;
  sharePercent: number;
}

interface FundingRound {
  id: string;
  roundName: string;
  roundType: string;
  investmentAmount: number;
  equityPercent: number;
  closedDate: string;
}

export default function CapTableStep({ company, onUpdate }: CapTableStepProps) {
  const [shareholders, setShareholders] = useState<Shareholder[]>([
    { id: '1', name: 'Founder 1', sharePercent: 0 },
  ]);
  const [fundingRounds, setFundingRounds] = useState<FundingRound[]>([]);
  const [capitalNeeded, setCapitalNeeded] = useState(0);

  useEffect(() => {
    if (onUpdate) {
      onUpdate({ shareholders, fundingRounds, capitalNeeded });
    }
  }, [shareholders, fundingRounds, capitalNeeded]);
  const [showShareholderModal, setShowShareholderModal] = useState(false);
  const [newShareholder, setNewShareholder] = useState({ name: '', sharePercent: 0 });

  const handleAddShareholder = () => {
    if (newShareholder.name) {
      setShareholders((prev) => [
        ...prev,
        { id: Date.now().toString(), ...newShareholder },
      ]);
      setNewShareholder({ name: '', sharePercent: 0 });
      setShowShareholderModal(false);
    }
  };

  const handleRemoveShareholder = (id: string) => {
    setShareholders((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateShareholder = (id: string, field: string, value: any) => {
    setShareholders((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      )
    );
  };

  const containerStyle: React.CSSProperties = {
    fontFamily: FONT_SANS,
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '2rem',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '1rem',
    color: C.accent,
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '0.25rem',
    border: `1px solid ${C.border}`,
    backgroundColor: C.bg,
    color: C.text,
    fontSize: '0.9rem',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    border: 'none',
    backgroundColor: C.accent,
    color: C.bg,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const deleteButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#dc2626',
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
  };

  const modalOverlayStyle: React.CSSProperties = {
    display: showShareholderModal ? 'flex' : 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: C.panel,
    borderRadius: '0.5rem',
    padding: '2rem',
    maxWidth: '500px',
    width: '90%',
    border: `1px solid ${C.border}`,
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '1rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
    fontWeight: 500,
  };

  return (
    <div style={containerStyle}>
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Cap Table (Shareholders)</h3>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Shareholder Name</th>
              <th style={thStyle}>Ownership %</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {shareholders.map((shareholder) => (
              <tr key={shareholder.id}>
                <td style={tdStyle}>
                  <input
                    type="text"
                    value={shareholder.name}
                    onChange={(e) =>
                      handleUpdateShareholder(shareholder.id, 'name', e.target.value)
                    }
                    style={inputStyle}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={shareholder.sharePercent}
                    onChange={(e) =>
                      handleUpdateShareholder(shareholder.id, 'sharePercent', parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                </td>
                <td style={tdStyle}>
                  <button
                    onClick={() => handleRemoveShareholder(shareholder.id)}
                    style={deleteButtonStyle}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={() => setShowShareholderModal(true)}
          style={buttonStyle}
        >
          + Add Shareholder
        </button>

        <div style={{ color: C.textMuted, fontSize: '0.85rem', marginTop: '1rem' }}>
          Total ownership: {shareholders.reduce((sum, s) => sum + s.sharePercent, 0).toFixed(1)}%
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Capital Needs</h3>
        <div style={fieldStyle}>
          <label style={labelStyle}>Total Capital Needed</label>
          <input
            type="number"
            min="0"
            value={capitalNeeded}
            onChange={(e) => setCapitalNeeded(parseInt(e.target.value) || 0)}
            placeholder="Amount in USD"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Funding Rounds</h3>
        {fundingRounds.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: '0.9rem', padding: '1rem' }}>
            No funding rounds recorded yet.
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Round</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Equity %</th>
                <th style={thStyle}>Closed Date</th>
              </tr>
            </thead>
            <tbody>
              {fundingRounds.map((round) => (
                <tr key={round.id}>
                  <td style={tdStyle}>{round.roundName}</td>
                  <td style={tdStyle}>${round.investmentAmount.toLocaleString()}</td>
                  <td style={tdStyle}>{round.equityPercent}%</td>
                  <td style={tdStyle}>{round.closedDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <div style={modalOverlayStyle} onClick={() => setShowShareholderModal(false)}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 600 }}>
            Add Shareholder
          </h3>

          <div style={fieldStyle}>
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              value={newShareholder.name}
              onChange={(e) => setNewShareholder({ ...newShareholder, name: e.target.value })}
              placeholder="Shareholder name"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Ownership %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={newShareholder.sharePercent}
              onChange={(e) =>
                setNewShareholder({ ...newShareholder, sharePercent: parseFloat(e.target.value) || 0 })
              }
              placeholder="0-100"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowShareholderModal(false)}
              style={{
                ...buttonStyle,
                backgroundColor: C.border,
                color: C.text,
              }}
            >
              Cancel
            </button>
            <button onClick={handleAddShareholder} style={buttonStyle}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
