import type { ReactElement } from "react";
import type { AppView } from "../types/app";

interface StepNavigationProps {
  appView: AppView;
  canGoEditor: boolean;
  canGoSimulation: boolean;
  onGoConfig: () => void;
  onGoEditor: () => void;
  onGoSimulation: () => void;
  onOpenSubmission: () => void;
}

interface StepButtonConfig {
  key: AppView | "submission";
  label: string;
  disabled: boolean;
  isBackNavigation: boolean;
  onClick: () => void;
}

export const StepNavigation = ({
  appView,
  canGoEditor,
  canGoSimulation,
  onGoConfig,
  onGoEditor,
  onGoSimulation,
  onOpenSubmission,
}: StepNavigationProps): ReactElement => {
  const steps: StepButtonConfig[] = [
    {
      key: "setup",
      label: "1. Select Task",
      disabled: appView === "setup",
      isBackNavigation: appView === "editor" || appView === "simulator",
      onClick: onGoConfig,
    },
    {
      key: "editor",
      label: "2. Editor",
      disabled: appView === "editor" || !canGoEditor,
      isBackNavigation: appView === "simulator",
      onClick: onGoEditor,
    },
    {
      key: "simulator",
      label: "3. Simulation",
      disabled: appView === "simulator" || !canGoSimulation,
      isBackNavigation: false,
      onClick: onGoSimulation,
    },
    {
      key: "submission",
      label: "4. Download Submission",
      disabled: false,
      isBackNavigation: false,
      onClick: onOpenSubmission,
    },
  ];

  return (
    <nav className="step-navigation" aria-label="Application steps">
      {steps.map((step) => (
        <button
          key={step.key}
          type="button"
          className={`step-button ${appView === step.key ? "active" : ""} ${step.isBackNavigation ? "is-back" : ""}`}
          disabled={step.disabled}
          onClick={step.onClick}
          aria-current={appView === step.key ? "step" : undefined}
        >
          {step.label}
        </button>
      ))}
    </nav>
  );
};
