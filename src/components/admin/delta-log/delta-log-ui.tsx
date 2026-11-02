import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const deltaLogSearchInputClass =
  'w-full bg-background border border-border/50 rounded-xl py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary';

type DeltaLogCsvExportButtonProps = {
  exporting: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
};

export function DeltaLogCsvExportButton({
  exporting,
  disabled,
  onClick,
  className,
}: DeltaLogCsvExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || exporting}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 shrink-0',
        className,
      )}
    >
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
      Xuất CSV
    </button>
  );
}

type DeltaLogPaginationProps = {
  from: number;
  to: number;
  total: number;
  safePage: number;
  totalPages: number;
  visiblePages: (number | 'ellipsis')[];
  onPageChange: (page: number) => void;
};

export function DeltaLogPagination({
  from,
  to,
  total,
  safePage,
  totalPages,
  visiblePages,
  onPageChange,
}: DeltaLogPaginationProps) {
  if (total <= 0) return null;

  return (
    <div className="px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/30">
      <p className="text-xs text-muted-foreground">
        Hiển thị {from}–{to} của {total} bản ghi
      </p>
      {totalPages > 1 && (
        <div className="flex gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
            aria-label="Trang trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {visiblePages.map((n, idx) =>
            n === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground"
              >
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onPageChange(n)}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                  n === safePage
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
            aria-label="Trang sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function DeltaLogDetailLink({
  onClick,
  label = 'Xem chi tiết',
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary text-primary text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors',
        className,
      )}
    >
      {label}
      <span aria-hidden="true">›</span>
    </button>
  );
}
