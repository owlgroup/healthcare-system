import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface HealthSectionProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  action?: string;
  onActionClick?: () => void;
  children: ReactNode;
}

const HealthSection = ({ icon: Icon, iconColor = "text-primary", title, action, onActionClick, children }: HealthSectionProps) => {
  return (
    <div className="rounded-xl bg-card p-5 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${iconColor === "text-warning" ? "bg-warning/10" : iconColor === "text-primary" ? "bg-primary/10" : iconColor === "text-success" ? "bg-success/10" : "bg-muted"}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        </div>
        {action && (
          <button
            type="button"
            onClick={onActionClick}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            + {action}
          </button>
        )}
      </div>
      {children}
    </div>
  );
};

export default HealthSection;
