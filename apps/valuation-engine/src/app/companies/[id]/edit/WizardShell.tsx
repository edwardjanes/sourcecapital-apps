'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, FONT_SANS, FONT_MONO } from '@/lib/theme';
import ProfileStep from './profile/ProfileStep';
import QuestionnaireStep from './questionnaire/QuestionnaireStep';
import FinancialsStep from './financials/FinancialsStep';
import CapTableStep from './captable/CapTableStep';
import ComparablesStep from './comparables/ComparablesStep';
import ParametersStep from './parameters/ParametersStep';
import {
  ValidationIssue,
  validateProfile,
  validateFinancials,
  validateBalanceSheet,
  validateQuestionnaire,
  hasBlockingIssues,
} from '@/lib/valuation/validation';

type WizardStep = 'profile' | 'questionnaire' | 'financials' | 'captable' | 'comparables' | 'parameters';

// Only these three steps carry data the compute engine assumes is well-formed (see validation.ts) --
// cap table / comparables / parameters have no hard requirements of their own (parameters gates itself
// on weights summing to 100%, cap table and comparables are optional enrichments).
const VALIDATED_STEPS: WizardStep[] = ['profile', 'questionnaire', 'financials'];

interface WizardShellProps {
  company: any;
}

interface WizardData {
  profile: any;
  questionnaire: any;
  financials: any[];
  balanceSheet: any;
  captable: any;
  comparables: any;
  parameters: any;
}

export default function WizardShell({ company }: WizardShellProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('profile');
  const [isLoading, setIsLoading] = useState(false);
  // Which steps' errors should actually be shown -- we don't want to greet a user with a wall of
  // "required" errors on a blank form; a step's errors only surface once they've tried to leave it
  // (via Next / Generate Report) or the step is revisited after that.
  const [touchedSteps, setTouchedSteps] = useState<Set<WizardStep>>(new Set());

  const [wizardData, setWizardData] = useState<WizardData>({
    profile: company || {},
    questionnaire: { answers: {} },
    financials: Array.from({ length: 7 }, (_, i) => ({ yearOffset: i - 1, revenue: 0 })),
    balanceSheet: { non_operating_cash: 0, cash_and_equivalents: 0 },
    captable: { shareholders: [] },
    comparables: { companies: [] },
    parameters: { method_weights: {} },
  });

  const steps: { key: WizardStep; label: string; index: number }[] = [
    { key: 'profile', label: 'Company Profile', index: 0 },
    { key: 'questionnaire', label: 'Questionnaire', index: 1 },
    { key: 'financials', label: 'Financials', index: 2 },
    { key: 'captable', label: 'Cap Table', index: 3 },
    { key: 'comparables', label: 'Comparables', index: 4 },
    { key: 'parameters', label: 'Valuation Parameters', index: 5 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  const stepIssues: Partial<Record<WizardStep, ValidationIssue[]>> = useMemo(
    () => ({
      profile: validateProfile(wizardData.profile || {}),
      questionnaire: validateQuestionnaire(wizardData.questionnaire?.answers || {}),
      financials: [
        ...validateFinancials(wizardData.financials || []),
        ...validateBalanceSheet(wizardData.balanceSheet || {}),
      ],
    }),
    [wizardData.profile, wizardData.questionnaire, wizardData.financials, wizardData.balanceSheet]
  );

  // First validated step (in wizard order) that still has a blocking error, if any -- used to gate
  // "Generate Report" regardless of which step the user is currently looking at, since step tabs let
  // them jump around freely.
  const firstInvalidStep = VALIDATED_STEPS.find((step) => hasBlockingIssues(stepIssues[step] || []));

  const updateWizardData = (step: keyof WizardData, data: any) => {
    setWizardData((prev) => ({ ...prev, [step]: data }));
  };

  const handleNext = () => {
    const issues = stepIssues[currentStep];
    if (issues && hasBlockingIssues(issues)) {
      setTouchedSteps((prev) => new Set(prev).add(currentStep));
      window.scrollTo(0, 0);
      return;
    }
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].key);
      window.scrollTo(0, 0);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].key);
      window.scrollTo(0, 0);
    }
  };

  const handleGenerateReport = async () => {
    if (firstInvalidStep) {
      setTouchedSteps((prev) => new Set(prev).add(firstInvalidStep));
      setCurrentStep(firstInvalidStep);
      window.scrollTo(0, 0);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`/companies/${company.id}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: wizardData.profile,
          financials: wizardData.financials,
          questionnaire: wizardData.questionnaire,
          weights: wizardData.parameters.method_weights,
          balanceSheet: wizardData.balanceSheet,
          captable: wizardData.captable,
          comparables: wizardData.comparables,
        }),
      });

      const data = await response.json();
      if (data.redirect) {
        router.push(data.redirect);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Generate report error:', err);
      alert('Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: FONT_SANS,
    minHeight: '100vh',
    padding: '2rem',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '2rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '2rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  };

  const subtitleStyle: React.CSSProperties = {
    color: C.textMuted,
    fontSize: '0.95rem',
  };

  const stepsContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
    overflowX: 'auto',
    paddingBottom: '0.5rem',
  };

  const stepButtonStyle = (isActive: boolean, isCompleted: boolean): React.CSSProperties => ({
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: isActive ? 600 : 500,
    transition: 'all 0.2s',
    backgroundColor: isActive ? C.accent : isCompleted ? C.border : C.panel,
    color: isActive ? C.bg : C.text,
    whiteSpace: 'nowrap',
  });

  const contentStyle: React.CSSProperties = {
    backgroundColor: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: '0.75rem',
    padding: '2rem',
    marginBottom: '2rem',
  };

  const navStyle: React.CSSProperties = {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: C.accent,
    color: C.bg,
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: C.border,
    color: C.text,
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'profile':
        return (
          <ProfileStep
            company={wizardData.profile}
            onUpdate={(data) => updateWizardData('profile', data)}
            issues={stepIssues.profile}
            showErrors={touchedSteps.has('profile')}
          />
        );
      case 'questionnaire':
        return (
          <QuestionnaireStep
            company={wizardData.questionnaire}
            onUpdate={(data) => updateWizardData('questionnaire', data)}
            issues={stepIssues.questionnaire}
            showErrors={touchedSteps.has('questionnaire')}
          />
        );
      case 'financials':
        return (
          <FinancialsStep
            company={wizardData.financials}
            onUpdate={(data) => {
              updateWizardData('financials', data.financials);
              if (data.balanceSheet) {
                setWizardData((prev) => ({ ...prev, balanceSheet: data.balanceSheet }));
              }
            }}
            issues={stepIssues.financials}
            showErrors={touchedSteps.has('financials')}
          />
        );
      case 'captable':
        return <CapTableStep company={wizardData.captable} onUpdate={(data) => updateWizardData('captable', data)} />;
      case 'comparables':
        return <ComparablesStep company={wizardData.comparables} onUpdate={(data) => updateWizardData('comparables', data)} />;
      case 'parameters':
        return (
          <ParametersStep
            company={wizardData.parameters}
            stage={wizardData.profile.stage}
            onUpdate={(data) => updateWizardData('parameters', data)}
            onGenerateReport={handleGenerateReport}
            isLoading={isLoading}
            blockedByOtherSteps={!!firstInvalidStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>{wizardData.profile.name || 'New Company'}</h1>
        <p style={subtitleStyle}>
          Step {currentStepIndex + 1} of {steps.length}
        </p>
      </div>

      <div style={stepsContainerStyle}>
        {steps.map((step) => {
          const stepHasBlockingIssues = hasBlockingIssues(stepIssues[step.key] || []);
          return (
            <button
              key={step.key}
              onClick={() => {
                // Leaving a validated step marks it touched, so its errors (if any) are visible
                // whenever it's revisited, not just the first time Next/Generate was blocked on it.
                if (VALIDATED_STEPS.includes(currentStep)) {
                  setTouchedSteps((prev) => new Set(prev).add(currentStep));
                }
                setCurrentStep(step.key);
              }}
              style={stepButtonStyle(currentStep === step.key, step.index < currentStepIndex)}
            >
              {step.index + 1}. {step.label}
              {stepHasBlockingIssues && touchedSteps.has(step.key) ? ' ⚠' : ''}
            </button>
          );
        })}
      </div>

      {touchedSteps.has(currentStep) && hasBlockingIssues(stepIssues[currentStep] || []) && (
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
          <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>
            Fix {stepIssues[currentStep]!.filter((i) => i.severity === 'error').length} field
            {stepIssues[currentStep]!.filter((i) => i.severity === 'error').length === 1 ? '' : 's'} before continuing:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {stepIssues[currentStep]!
              .filter((i) => i.severity === 'error')
              .map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
          </ul>
        </div>
      )}

      <div style={contentStyle}>
        {renderStep()}
      </div>

      <div style={navStyle}>
        <button
          onClick={handlePrev}
          disabled={currentStepIndex === 0}
          style={{ ...secondaryButtonStyle, opacity: currentStepIndex === 0 ? 0.5 : 1 }}
        >
          ← Back
        </button>
        {currentStep !== 'parameters' ? (
          <button onClick={handleNext} style={primaryButtonStyle}>
            Next →
          </button>
        ) : (
          <button
            onClick={handleGenerateReport}
            disabled={isLoading}
            style={{ ...primaryButtonStyle, opacity: isLoading ? 0.6 : 1 }}
          >
            {isLoading ? '⏳ Generating...' : '📊 Generate Report'}
          </button>
        )}
      </div>
    </div>
  );
}
