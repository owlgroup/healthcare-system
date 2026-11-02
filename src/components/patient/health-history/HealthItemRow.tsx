import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type HealthItemRowProps = {
  title: string;
  subtitle?: string;
  onDelete?: () => void;
  deleting?: boolean;
  borderAccent?: boolean;
};

export default function HealthItemRow({
  title,
  subtitle,
  onDelete,
  deleting,
  borderAccent,
}: HealthItemRowProps) {
  return (
    <div
      className={`rounded-lg p-4 mb-3 flex items-start justify-between gap-2 ${
        borderAccent ? "border-l-4 border-primary bg-muted/50" : "bg-muted/50"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          disabled={deleting}
          onClick={onDelete}
          aria-label="Xóa"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
