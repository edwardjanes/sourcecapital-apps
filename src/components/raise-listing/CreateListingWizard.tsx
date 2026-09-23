'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RaiseListing, RaiseListingDraft, RAISE_LISTING_STAGE_LABELS } from '@/lib/raiseListing/types';
import {
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateStep5,
  ValidationError,
} from '@/lib/raiseListing/validation';
import WizardStepper from './WizardStepper';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { checkListingFile, LISTING_UPLOADS, ListingFileField } from '@/lib/raiseListing/uploads';

interface CreateListingWizardProps {
  initialListing: RaiseListing;
}

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { num: Step; title: string }[] = [
  { num: 1, title: 'Company Basics' },
  { num: 2, title: 'Raise Details' },
  { num: 3, title: 'Traction' },
  { num: 4, title: 'Media' },
  { num: 5, title: 'Pitch & Team' },
];

export default function CreateListingWizard({ initialListing }: CreateListingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState<RaiseListingDraft>({
    company_name: initialListing.company_name || '',
    company_website: initialListing.company_website || undefined,
    one_liner: initialListing.one_liner || undefined,
    stage: initialListing.stage || undefined,
    target_raise_amount: initialListing.target_raise_amount || undefined,
    currency: initialListing.currency || 'GBP',
    raise_type: initialListing.raise_type || undefined,
    minimum_check_size: initialListing.minimum_check_size || undefined,
    use_of_funds: initialListing.use_of_funds || undefined,
    traction_summary: initialListing.traction_summary || undefined,
    company_logo_path: initialListing.company_logo_path || undefined,
    pitch_deck_file_path: initialListing.pitch_deck_file_path || undefined,
    description: initialListing.description || undefined,
    sector: initialListing.sector || [],
  });

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout>();

  const getErrorsForStep = (step: Step): ValidationError[] => {
    return errors.filter(e => {
      const stepFields: Record<Step, string[]> = {
        1: ['company_name', 'company_website', 'one_liner'],
        2: ['stage', 'target_raise_amount', 'currency', 'raise_type', 'minimum_check_size', 'use_of_funds'],
        3: ['traction_summary'],
        4: ['company_logo_path', 'pitch_deck_file_path'],
        5: ['description', 'sector'],
      };
      return stepFields[step].includes(e.field);
    });
  };

  const getErrorMessage = (field: string): string | null => {
    const error = errors.find(e => e.field === field);
    return error?.message || null;
  };

  const autosave = useCallback(
    async (data: RaiseListingDraft) => {
      setSaving(true);
      try {
        const response = await fetch(`/api/raise-listing/listings/${initialListing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const err = await response.json();
          console.error('[autosave] Error:', err);
        }
      } catch (error) {
        console.error('[autosave] Network error:', error);
      } finally {
        setSaving(false);
      }
    },
    [initialListing.id]
  );

  const handleFieldChange = (field: keyof RaiseListingDraft, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    // Debounced autosave
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = setTimeout(() => {
      autosave(newData);
    }, 500);
  };

  const validateCurrentStep = (): boolean => {
    let stepErrors: ValidationError[] = [];

    switch (currentStep) {
      case 1:
        stepErrors = validateStep1(formData).errors;
        break;
      case 2:
        stepErrors = validateStep2(formData).errors;
        break;
      case 3:
        stepErrors = validateStep3(formData).errors;
        break;
      case 4:
        stepErrors = validateStep4({
          company_logo_path: formData.company_logo_path,
          pitch_deck_file_path: formData.pitch_deck_file_path,
        }).errors;
        break;
      case 5:
        stepErrors = validateStep5(formData).errors;
        break;
    }

    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      return false;
    }

    // Clear errors for this step if valid
    setErrors(errors.filter(e => !getErrorsForStep(currentStep).some(se => se.field === e.field)));
    return true;
  };

  const handleNextStep = async () => {
    if (!validateCurrentStep()) return;
    await autosave(formData);
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as Step);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    // Validate all steps
    const allErrors: ValidationError[] = [];
    for (let i = 1; i <= 5; i++) {
      let stepErrors: ValidationError[] = [];
      const step = i as Step;
      switch (step) {
        case 1:
          stepErrors = validateStep1(formData).errors;
          break;
        case 2:
          stepErrors = validateStep2(formData).errors;
          break;
        case 3:
          stepErrors = validateStep3(formData).errors;
          break;
        case 4:
          stepErrors = validateStep4({
            company_logo_path: formData.company_logo_path,
            pitch_deck_file_path: formData.pitch_deck_file_path,
          }).errors;
          break;
        case 5:
          stepErrors = validateStep5(formData).errors;
          break;
      }
      allErrors.push(...stepErrors);
    }

    if (allErrors.length > 0) {
      setErrors(allErrors);
      // Jump to first step with errors
      const firstErrorStep = Math.min(
        ...allErrors.map(e => {
          if (['company_name', 'company_website', 'one_liner'].includes(e.field)) return 1;
          if (['stage', 'target_raise_amount', 'currency', 'raise_type', 'minimum_check_size', 'use_of_funds'].includes(e.field)) return 2;
          if (['traction_summary'].includes(e.field)) return 3;
          if (['company_logo_path', 'pitch_deck_file_path'].includes(e.field)) return 4;
          return 5;
        })
      ) as Step;
      setCurrentStep(firstErrorStep);
      window.scrollTo(0, 0);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/raise-listing/listings/${initialListing.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/raise-listing/dashboard');
      } else {
        const err = await response.json();
        console.error('[submit] Error:', err);
        setErrors([{ field: 'submit', message: err.error || 'Failed to submit listing' }]);
      }
    } catch (error) {
      console.error('[submit] Network error:', error);
      setErrors([{ field: 'submit', message: 'Network error' }]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndExit = async () => {
    setSaving(true);
    try {
      await autosave(formData);
      router.push('/raise-listing/dashboard');
    } catch (error) {
      console.error('[save and exit] Error:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>
          Create Your Raise Listing
        </h1>
        <p style={{ fontSize: '16px', color: '#9CA3AF' }}>
          Fill out your fundraising details to get listed in our Opportunities directory
        </p>
      </div>

      {/* Stepper */}
      <WizardStepper steps={STEPS} currentStep={currentStep} />

      {/* Form */}
      <div style={{ background: '#111111', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '40px', marginTop: '40px', marginBottom: '40px' }}>
        {currentStep === 1 && <Step1 formData={formData} errors={errors} onChange={handleFieldChange} />}
        {currentStep === 2 && <Step2 formData={formData} errors={errors} onChange={handleFieldChange} />}
        {currentStep === 3 && <Step3 formData={formData} errors={errors} onChange={handleFieldChange} />}
        {currentStep === 4 && <Step4 formData={formData} errors={errors} onChange={handleFieldChange} listingId={initialListing.id} />}
        {currentStep === 5 && <Step5 formData={formData} errors={errors} onChange={handleFieldChange} />}
      </div>

      {/* Global errors */}
      {errors.find(e => e.field === 'submit') && (
        <div
          style={{
            background: '#7F1D1D',
            border: '1px solid #DC2626',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            color: '#FCA5A5',
            fontSize: '14px',
          }}
        >
          {errors.find(e => e.field === 'submit')?.message}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
        <button
          onClick={handleSaveAndExit}
          disabled={saving || submitting}
          style={{
            background: 'transparent',
            color: '#9CA3AF',
            border: '1px solid #2A2A2A',
            padding: '12px 20px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: saving || submitting ? 'not-allowed' : 'pointer',
            opacity: saving || submitting ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save & Exit'}
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 1 || submitting}
            style={{
              background: '#1F2937',
              color: '#fff',
              border: '1px solid #2A2A2A',
              padding: '12px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: currentStep === 1 || submitting ? 'not-allowed' : 'pointer',
              opacity: currentStep === 1 || submitting ? 0.5 : 1,
            }}
          >
            Back
          </button>

          {currentStep === 5 ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                background: '#03FB83',
                color: '#000',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Listing'}
            </button>
          ) : (
            <button
              onClick={handleNextStep}
              style={{
                background: '#03FB83',
                color: '#000',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STEP COMPONENTS
// ============================================================

interface StepProps {
  formData: RaiseListingDraft;
  errors: ValidationError[];
  onChange: (field: keyof RaiseListingDraft, value: any) => void;
}

function Step1({ formData, errors, onChange }: StepProps) {
  const errorMap = Object.fromEntries(errors.map(e => [e.field, e.message]));

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>Company & Raise Basics</h2>

      <FormField label="Company Name *" error={errorMap.company_name}>
        <input
          type="text"
          value={formData.company_name}
          onChange={e => onChange('company_name', e.target.value)}
          placeholder="Enter your company name"
          style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
        />
      </FormField>

      <FormField label="Website" error={errorMap.company_website}>
        <input
          type="url"
          value={formData.company_website || ''}
          onChange={e => onChange('company_website', e.target.value || undefined)}
          placeholder="https://example.com"
          style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
        />
      </FormField>

      <FormField label="One-Liner" error={errorMap.one_liner}>
        <input
          type="text"
          value={formData.one_liner || ''}
          onChange={e => onChange('one_liner', e.target.value || undefined)}
          placeholder="Brief description of your startup"
          style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
        />
      </FormField>
    </div>
  );
}

function Step2({ formData, errors, onChange }: StepProps) {
  const errorMap = Object.fromEntries(errors.map(e => [e.field, e.message]));

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>Raise Details</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <FormField label="Funding Stage" error={errorMap.stage}>
          <select
            value={formData.stage || ''}
            onChange={e => onChange('stage', e.target.value || undefined)}
            style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
          >
            <option value="">Select stage...</option>
            {Object.entries(RAISE_LISTING_STAGE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Currency" error={errorMap.currency}>
          <select
            value={formData.currency}
            onChange={e => onChange('currency', e.target.value)}
            style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
          >
            <option value="GBP">GBP (£)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </FormField>
      </div>

      <FormField label="Target Raise Amount" error={errorMap.target_raise_amount}>
        <input
          type="number"
          value={formData.target_raise_amount || ''}
          onChange={e => onChange('target_raise_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="1000000"
          style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
        />
      </FormField>

      <FormField label="Minimum Check Size" error={errorMap.minimum_check_size}>
        <input
          type="number"
          value={formData.minimum_check_size || ''}
          onChange={e => onChange('minimum_check_size', e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="50000"
          style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
        />
      </FormField>

      <FormField label="Raise Type" error={errorMap.raise_type}>
        <input
          type="text"
          value={formData.raise_type || ''}
          onChange={e => onChange('raise_type', e.target.value || undefined)}
          placeholder="e.g. Equity, SAFE, Convertible"
          style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
        />
      </FormField>

      <FormField label="Use of Funds" error={errorMap.use_of_funds}>
        <textarea
          value={formData.use_of_funds || ''}
          onChange={e => onChange('use_of_funds', e.target.value || undefined)}
          placeholder="How will you use the raised capital?"
          style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px', minHeight: '100px', fontFamily: 'inherit' }}
        />
      </FormField>
    </div>
  );
}

function Step3({ formData, errors, onChange }: StepProps) {
  const errorMap = Object.fromEntries(errors.map(e => [e.field, e.message]));

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>Traction & Milestones</h2>

      <FormField label="Traction Summary" error={errorMap.traction_summary}>
        <textarea
          value={formData.traction_summary || ''}
          onChange={e => onChange('traction_summary', e.target.value || undefined)}
          placeholder="Describe your traction, key metrics, and milestones achieved"
          style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px', minHeight: '150px', fontFamily: 'inherit' }}
        />
      </FormField>
    </div>
  );
}

function Step4({ formData, errors, onChange, listingId }: StepProps & { listingId: string }) {
  const errorMap = Object.fromEntries(errors.map(e => [e.field, e.message]));
  const [uploading, setUploading] = useState(false);

  // Three steps so the file never passes through a Vercel function (which
  // rejects bodies over ~4.5 MB): get a signed upload token, upload straight
  // to Storage, then confirm so the path is recorded on the listing.
  const handleFileUpload = async (field: ListingFileField, file: File) => {
    if (!file) return;

    const fileError = checkListingFile(field, file);
    if (fileError) {
      alert(fileError);
      return;
    }

    setUploading(true);
    try {
      const base = `/api/raise-listing/listings/${listingId}/upload`;
      const signed = await postJson(base, {
        field,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      const { error: uploadError } = await supabase.storage
        .from(LISTING_UPLOADS[field].bucket)
        .uploadToSignedUrl(signed.path as string, signed.token as string, file, { contentType: file.type });

      if (uploadError) {
        Sentry.captureException(uploadError, {
          tags: { context: 'listing_direct_upload' },
          extra: { listing_id: listingId, field, file_size: file.size },
        });
        throw new Error('Upload failed. Please try again.');
      }

      const confirmed = await postJson(`${base}/confirm`, { field, path: signed.path });
      onChange(field, confirmed.file_path as string);
    } catch (error) {
      console.error('[upload] Error:', error);
      alert(error instanceof Error ? error.message : 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>Media</h2>

      <FormField label="Company Logo" error={errorMap.company_logo_path}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={e => handleFileUpload('company_logo_path', e.target.files?.[0]!)}
            disabled={uploading}
            style={{ flex: 1 }}
          />
          {formData.company_logo_path && <span style={{ fontSize: '12px', color: '#03FB83' }}>✓ Uploaded</span>}
        </div>
      </FormField>

      <FormField label="Pitch Deck (PDF)" error={errorMap.pitch_deck_file_path}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="file"
            accept="application/pdf"
            onChange={e => handleFileUpload('pitch_deck_file_path', e.target.files?.[0]!)}
            disabled={uploading}
            style={{ flex: 1 }}
          />
          {formData.pitch_deck_file_path && <span style={{ fontSize: '12px', color: '#03FB83' }}>✓ Uploaded</span>}
        </div>
      </FormField>

      {uploading && <p style={{ color: '#9CA3AF', fontSize: '12px' }}>Uploading...</p>}
    </div>
  );
}

function Step5({ formData, errors, onChange }: StepProps) {
  const errorMap = Object.fromEntries(errors.map(e => [e.field, e.message]));

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>Pitch & Sectors</h2>

      <FormField label="Pitch Description *" error={errorMap.description}>
        <textarea
          value={formData.description || ''}
          onChange={e => onChange('description', e.target.value || undefined)}
          placeholder="Tell your story. What problem are you solving? Why now? Why your team?"
          style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px', minHeight: '200px', fontFamily: 'inherit' }}
        />
      </FormField>

      <FormField label="Sectors *" error={errorMap.sector}>
        <input
          type="text"
          value={formData.sector?.join(', ') || ''}
          onChange={e => onChange('sector', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
          placeholder="e.g. AI, FinTech, Climate"
          style={{ width: '100%', padding: '10px 12px', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
        />
        <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>Separate multiple sectors with commas</p>
      </FormField>
    </div>
  );
}

// ============================================================
// FORM FIELD COMPONENT
// ============================================================

interface FormFieldProps {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}

function FormField({ label, error, children }: FormFieldProps) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#E5E7EB', marginBottom: '8px' }}>
        {label}
      </label>
      {children}
      {error && <p style={{ fontSize: '12px', color: '#F87171', marginTop: '4px' }}>{error}</p>}
    </div>
  );
}

// POSTs JSON and returns the parsed body, throwing a readable error for non-2xx
// responses. Checks the content type first so a plain-text platform error
// (e.g. a 413 or 502 page) doesn't surface as a JSON SyntaxError.
async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: Record<string, unknown> = isJson ? await res.json().catch(() => ({})) : {};

  if (!isJson) {
    Sentry.captureMessage(`Non-JSON response from ${url}`, {
      level: 'error',
      tags: { context: 'listing_upload_non_json', status: String(res.status) },
    });
  }

  if (!res.ok || !isJson) {
    if (typeof data.error === 'string' && data.error) throw new Error(data.error);
    if (res.status === 413) throw new Error('File too large to upload. Please compress it and try again.');
    throw new Error(`Upload failed (error ${res.status}). Please try again.`);
  }
  return data;
}
