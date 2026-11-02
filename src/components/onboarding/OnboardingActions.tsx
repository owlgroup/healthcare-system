import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type OnboardingActionsProps = {
  previousPath?: string;
  nextLabel: string;
  isSubmitting?: boolean;
  disabled?: boolean;
  onNext?: () => void;
};

const OnboardingActions = ({
  previousPath,
  nextLabel,
  isSubmitting = false,
  disabled = false,
  onNext,
}: OnboardingActionsProps) => {
  return (
    <div className="mt-8 flex flex-col-reverse items-start justify-between gap-4 border-t pt-6 sm:flex-row sm:items-center">
      {previousPath ? (
        <Button asChild variant="ghost" className="min-h-11 px-1 text-muted-foreground hover:text-foreground">
          <Link to={previousPath}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Quay lại
          </Link>
        </Button>
      ) : (
        <span />
      )}

      <Button
        type="button"
        onClick={onNext}
        disabled={isSubmitting || disabled}
        size="lg"
        className="min-h-11 min-w-56 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-6 shadow-lg shadow-primary/20"
      >
        {isSubmitting ? "Vui lòng chờ..." : nextLabel}
        {!isSubmitting ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
      </Button>
    </div>
  );
};

export default OnboardingActions;
