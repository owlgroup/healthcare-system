import type { LucideIcon } from "lucide-react";
import { sanitizeSensitiveDisplay } from "@/lib/crypto";

function formatDob(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("vi-VN");
}

function profileInitials(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return "BN";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

type ProfileDetailFieldProps = {
  label: string;
  value: string;
  className?: string;
  icon?: LucideIcon;
};

export function ProfileDetailField({ label, value, className, icon: Icon }: ProfileDetailFieldProps) {
  const displayValue = sanitizeSensitiveDisplay(value);
  const hasValue = Boolean(displayValue && displayValue !== "—");
  return (
    <div
      className={`group flex items-start gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03] ${className ?? ""}`}
    >
      {Icon ? (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={`mt-1 truncate text-sm font-semibold ${hasValue ? "text-foreground" : "text-muted-foreground/60"}`}
          title={hasValue ? displayValue : undefined}
        >
          {displayValue}
        </p>
      </div>
    </div>
  );
}

export { formatDob, profileInitials };
