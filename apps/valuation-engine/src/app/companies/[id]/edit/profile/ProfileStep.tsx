'use client';

import { useState, useEffect } from 'react';
import { C, FONT_SANS } from '@/lib/theme';
import { ValidationIssue, fieldIssue } from '@/lib/valuation/validation';

interface ProfileStepProps {
  company: any;
  onUpdate?: (data: any) => void;
  issues?: ValidationIssue[];
  showErrors?: boolean;
}

const STAGES = ['idea', 'development', 'startup', 'expansion', 'growth', 'maturity'];
const INDUSTRIES = [
  'SaaS',
  'Fintech',
  'AI_ML',
  'Marketplace',
  'Ecommerce',
  'Healthtech',
  'Biotech',
  'Hardware',
  'Deeptech',
  'Cleantech',
  'MobileApp',
  'Gaming',
  'EdTech',
  'Logistics',
  'PropTech',
  'Media',
];
const COUNTRIES = [
  'Australia',
  'Brazil',
  'Canada',
  'China',
  'France',
  'Germany',
  'Hong Kong',
  'India',
  'Ireland',
  'Israel',
  'Italy',
  'Japan',
  'Mexico',
  'Netherlands',
  'Nigeria',
  'Poland',
  'Singapore',
  'South Africa',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
];

export default function ProfileStep({ company, onUpdate, issues, showErrors }: ProfileStepProps) {
  const [formData, setFormData] = useState({
    name: company.name || '',
    country: company.country || '',
    industry: company.industry || '',
    stage: company.stage || 'development',
    description: company.description || '',
    founders_count: company.founders_count || 1,
    employees_count: company.employees_count || 1,
    website: company.website || '',
    business_model: company.business_model || '',
    business_activity: company.business_activity || '',
    started_year: company.started_year || new Date().getFullYear(),
    incorporated_year: company.incorporated_year || new Date().getFullYear(),
    founders_committed_capital: company.founders_committed_capital || 0,
  });

  useEffect(() => {
    if (onUpdate) {
      onUpdate(formData);
    }
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    border: `1px solid ${C.border}`,
    backgroundColor: C.bg,
    color: C.text,
    fontSize: '0.9rem',
    fontFamily: FONT_SANS,
    marginBottom: '1rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: C.text,
  };

  const errorTextStyle: React.CSSProperties = {
    color: '#ef4444',
    fontSize: '0.8rem',
    marginTop: '-0.75rem',
    marginBottom: '1rem',
  };

  // Only shows an error once the caller (WizardShell) has marked this step "touched" -- avoids
  // greeting a blank form with a wall of "required" errors before the user has done anything.
  const errorFor = (field: string) => (showErrors ? fieldIssue(issues, field) : undefined);
  const inputStyleFor = (field: string): React.CSSProperties => {
    const error = errorFor(field);
    return error ? { ...inputStyle, border: '1px solid #ef4444' } : inputStyle;
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
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

  return (
    <div>
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Basic Information</h3>
        <label style={labelStyle}>Company Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter company name"
          style={inputStyleFor('name')}
        />
        {errorFor('name') && <div style={errorTextStyle}>{errorFor('name')!.message}</div>}

        <label style={labelStyle}>Website</label>
        <input
          type="url"
          name="website"
          value={formData.website}
          onChange={handleChange}
          placeholder="https://example.com"
          style={inputStyle}
        />

        <label style={labelStyle}>Description</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Brief overview of what your company does"
          rows={4}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Company Profile</h3>
        <div style={gridStyle}>
          <div>
            <label style={labelStyle}>Country *</label>
            <select name="country" value={formData.country} onChange={handleChange} style={inputStyleFor('country')}>
              <option value="">Select a country</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            {errorFor('country') && <div style={errorTextStyle}>{errorFor('country')!.message}</div>}
          </div>

          <div>
            <label style={labelStyle}>Industry *</label>
            <select name="industry" value={formData.industry} onChange={handleChange} style={inputStyleFor('industry')}>
              <option value="">Select an industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
            {errorFor('industry') && <div style={errorTextStyle}>{errorFor('industry')!.message}</div>}
          </div>

          <div>
            <label style={labelStyle}>Stage *</label>
            <select name="stage" value={formData.stage} onChange={handleChange} style={inputStyleFor('stage')}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            {errorFor('stage') && <div style={errorTextStyle}>{errorFor('stage')!.message}</div>}
          </div>

          <div>
            <label style={labelStyle}>Founders</label>
            <input
              type="number"
              name="founders_count"
              value={formData.founders_count}
              onChange={handleChange}
              min="1"
              style={inputStyleFor('founders_count')}
            />
            {errorFor('founders_count') && <div style={errorTextStyle}>{errorFor('founders_count')!.message}</div>}
          </div>

          <div>
            <label style={labelStyle}>Employees</label>
            <input
              type="number"
              name="employees_count"
              value={formData.employees_count}
              onChange={handleChange}
              min="1"
              style={inputStyleFor('employees_count')}
            />
            {errorFor('employees_count') && <div style={errorTextStyle}>{errorFor('employees_count')!.message}</div>}
          </div>

          <div>
            <label style={labelStyle}>Business Model</label>
            <input
              type="text"
              name="business_model"
              value={formData.business_model}
              onChange={handleChange}
              placeholder="e.g. SaaS subscription"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Business Activity</label>
            <input
              type="text"
              name="business_activity"
              value={formData.business_activity}
              onChange={handleChange}
              placeholder="e.g. Cloud computing services"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Founded Year</label>
            <input
              type="number"
              name="started_year"
              value={formData.started_year}
              onChange={handleChange}
              min="1900"
              max={new Date().getFullYear()}
              style={inputStyleFor('started_year')}
            />
            {errorFor('started_year') && <div style={errorTextStyle}>{errorFor('started_year')!.message}</div>}
          </div>

          <div>
            <label style={labelStyle}>Incorporated Year</label>
            <input
              type="number"
              name="incorporated_year"
              value={formData.incorporated_year}
              onChange={handleChange}
              min="1900"
              max={new Date().getFullYear()}
              style={inputStyleFor('incorporated_year')}
            />
            {errorFor('incorporated_year') && <div style={errorTextStyle}>{errorFor('incorporated_year')!.message}</div>}
          </div>

          <div>
            <label style={labelStyle}>Founders' Committed Capital</label>
            <input
              type="number"
              name="founders_committed_capital"
              value={formData.founders_committed_capital}
              onChange={handleChange}
              min="0"
              placeholder="0"
              style={inputStyleFor('founders_committed_capital')}
            />
            {errorFor('founders_committed_capital') && (
              <div style={errorTextStyle}>{errorFor('founders_committed_capital')!.message}</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ color: C.textMuted, fontSize: '0.85rem' }}>* Required fields</div>
    </div>
  );
}
