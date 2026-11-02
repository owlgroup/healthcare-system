import { Check, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type OnboardingStep = {
  key: "personal" | "insurance" | "review";
  label: string;
  path: string;
};

type OnboardingStepperProps = {
  currentStep: OnboardingStep["key"];
};

const steps: OnboardingStep[] = [
  { key: "personal", label: "Thông tin cá nhân & định danh", path: "/onboarding/personal" },
  { key: "insurance", label: "Bảo hiểm", path: "/onboarding/insurance" },
  { key: "review", label: "Xác nhận", path: "/onboarding/review" },
];

const getCurrentStepIndex = (currentStep: OnboardingStep["key"]) =>
  steps.findIndex((step) => step.key === currentStep);

const OnboardingStepper = ({ currentStep }: OnboardingStepperProps) => {
  const currentStepIndex = getCurrentStepIndex(currentStep);

  return (
    <div className="w-full">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 overflow-x-auto py-2 md:justify-center">
        {steps.map((step, index) => {
          const completed = index < currentStepIndex;
          const active = index === currentStepIndex;
          const disabled = index > currentStepIndex + 1;

          return (
            <div key={step.key} className="flex min-w-max items-center gap-3">
              <Link
                to={disabled ? "#" : step.path}
                aria-disabled={disabled}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                  completed && "border-primary/30 bg-primary/10 text-primary",
                  active && "border-primary bg-primary text-primary-foreground shadow-sm",
                  !completed && !active && "border-border bg-background text-muted-foreground",
                  disabled && "pointer-events-none opacity-70",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                    completed && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary-foreground/50",
                    !completed && !active && "border-muted-foreground/40",
                  )}
                >
                  {completed ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : step.key === "insurance" ? (
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span>{step.label}</span>
              </Link>
              {index < steps.length - 1 ? (
                <div className={cn("h-px w-7 bg-border md:w-10", completed && "bg-primary/40")} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingStepper;
