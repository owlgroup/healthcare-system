import type { ReactNode } from "react";
import { X } from "lucide-react";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CccdBhytCompareResult } from "@/lib/cccd-bhyt-cross-validate";
import type { PatientProfileStatus } from "@/types/patient-portal";

/** Shared DialogContent classes: header / scroll body / footer column, custom close button. */
export const RECORD_DIALOG_CLASS =
  "flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl p-0 [&>button:last-child]:hidden";

const STATUS_META: Record<PatientProfileStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Đang hoạt động", className: "bg-[#E9F7EE] text-[#157F3D]" },
  UNVERIFIED: { label: "Đã nộp", className: "bg-[#EAF0FF] text-[#1D4FD8]" },
  INACTIVE: { label: "Ngừng hoạt động", className: "bg-[#F0EEEC] text-[#57524E]" },
  REJECTED: { label: "Đã từ chối", className: "bg-[#FCEBEF] text-primary" },
};

function initialOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length ? words[words.length - 1][0].toUpperCase() : "+";
}

export function RecordDialogHeader({ kicker, name, meta, status, onClose, closeDisabled }: {
  kicker: string;
  name: string;
  meta?: string;
  status?: PatientProfileStatus | null;
  onClose: () => void;
  closeDisabled?: boolean;
}) {
  const st = status ? STATUS_META[status] : null;
  return (
    <div className="flex flex-none items-center gap-3 border-b bg-card px-5 py-3.5">
      <div className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-primary text-base font-bold text-primary-foreground">
        {initialOf(name)}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <DialogTitle className="text-xs font-normal leading-tight tracking-normal text-muted-foreground">
          {kicker}
        </DialogTitle>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-[15px] font-bold text-foreground">{name}</p>
          {meta ? <span className="font-mono text-[11px] text-muted-foreground">{meta}</span> : null}
          {st ? (
            <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", st.className)}>{st.label}</span>
          ) : null}
        </div>
        <DialogDescription className="sr-only">
          Ảnh giấy tờ, thông tin cá nhân, căn cước công dân và bảo hiểm y tế của bệnh nhân.
        </DialogDescription>
      </div>
      <button
        type="button"
        onClick={onClose}
        disabled={closeDisabled}
        aria-label="Đóng"
        className="grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Scrollable body: sticky document column on the left, form sections on the right. */
export function RecordDialogBody({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 px-5 py-4">
      <div className="grid items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3 rounded-xl border bg-card p-3.5 lg:sticky lg:top-0">
          <div>
            <p className="text-sm font-semibold text-foreground">Ảnh giấy tờ</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Không bắt buộc. Tải ảnh lên để hệ thống tự điền thông tin.
            </p>
          </div>
          {aside}
        </aside>
        <div className="flex min-w-0 flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

/** Label + chip row above each document slot in the aside. */
export function DocSlotLabel({ label, done }: { label: string; done?: boolean }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-foreground/80">{label}</span>
      {done != null ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10.5px] font-semibold",
            done ? "bg-[#E9F7EE] text-[#157F3D]" : "bg-[#FFF4DD] text-[#A65F00]",
          )}
        >
          {done ? "Đã OCR" : "Chưa OCR"}
        </span>
      ) : null}
    </div>
  );
}

export function RecordSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card px-4 py-3.5">
      <h3 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-foreground">
        {title}
        {note ? <span className="text-xs font-normal text-muted-foreground">{note}</span> : null}
      </h3>
      <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-3">{children}</div>
    </section>
  );
}

const SPAN = { 1: "", 2: "sm:col-span-2", 3: "sm:col-span-3" } as const;

const labelBase = "mb-1 block text-xs font-medium";
const inputBase =
  "min-h-9 w-full rounded-lg border bg-muted/30 px-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";
const inputBad = "border-[#E36A86] bg-[#FFF8F9]";

export function RecordField({ id, label, value, onChange, type = "text", placeholder, span = 1, required, error, invalid, multiline }: {
  id?: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; span?: 1 | 2 | 3; required?: boolean; error?: string; invalid?: boolean;
  multiline?: boolean;
}) {
  const bad = Boolean(error || invalid);
  const fieldClass = cn(inputBase, bad && inputBad);
  return (
    <div className={cn("min-w-0", SPAN[span])}>
      <label htmlFor={id} className={cn(labelBase, bad ? "text-primary" : "text-foreground/80")}>
        {label}{required && <span className="ml-0.5 text-primary" aria-hidden="true">*</span>}
      </label>
      {multiline ? (
        <textarea id={id} rows={2} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={cn(fieldClass, "py-2 overflow-y-auto resize-none")} />
      ) : (
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={fieldClass} />
      )}
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-primary">{error}</p>
      ) : invalid ? (
        <p className="mt-1 text-[11px] font-medium text-primary">Không khớp</p>
      ) : null}
    </div>
  );
}

export function RecordGenderSelect({ label, value, onChange, invalid }: {
  label: string; value: string; onChange: (v: string) => void; invalid?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label className={cn(labelBase, invalid ? "text-primary" : "text-foreground/80")}>{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn("h-9 min-h-9 w-full rounded-lg bg-muted/30", invalid && inputBad)}>
          <SelectValue placeholder="Chọn giới tính" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Nam">Nam</SelectItem>
          <SelectItem value="Nữ">Nữ</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function displayDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return v.trim() || "—";
}

/** CCCD ↔ BHYT mismatch notice shown at the top of the form column. */
export function RecordMismatchNotice({ result, confirmed, onConfirm }: {
  result: CccdBhytCompareResult; confirmed: boolean; onConfirm: () => void;
}) {
  if (!result.hasMismatch) return null;
  if (confirmed) {
    return (
      <div className="rounded-xl border border-[#F0D9A8] bg-[#FFF4DD] px-3.5 py-2.5 text-xs text-[#7A4A00]" role="status">
        Đã xác nhận CCCD và thẻ BHYT thuộc hai người khác nhau.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-[#F3C9D3] bg-[#FCEBEF] px-3.5 py-3" role="alert">
      <div className="flex min-w-[240px] flex-1 flex-col gap-1">
        <p className="text-sm font-bold text-[#9E1033]">Thông tin CCCD và thẻ BHYT không khớp</p>
        {result.nameMismatch ? (
          <p className="text-xs text-foreground/80">
            <b className="font-semibold">Họ tên:</b> CCCD {result.cccdName.trim() || "—"} · BHYT {result.bhytName.trim() || "—"}
          </p>
        ) : null}
        {result.dobMismatch ? (
          <p className="text-xs text-foreground/80">
            <b className="font-semibold">Ngày sinh:</b> CCCD {displayDate(result.cccdDob)} · BHYT {displayDate(result.bhytDob)}
          </p>
        ) : null}
        <p className="text-[11.5px] text-muted-foreground">Kiểm tra lại giấy tờ, hoặc xác nhận đây là hai người khác nhau.</p>
      </div>
      <button
        type="button"
        onClick={onConfirm}
        className="h-8 cursor-pointer whitespace-nowrap rounded-lg border border-[#E89AAD] bg-card px-3 text-xs font-semibold text-primary transition-colors hover:bg-[#FFF5F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        Xác nhận thông tin khác nhau
      </button>
    </div>
  );
}

/** Footer hint: missing required fields first, then an unresolved CCCD↔BHYT mismatch. */
export function recordFooterHint(errors: Record<string, string | undefined>, mismatchBlocks: boolean): string | null {
  const missing = Object.values(errors).filter(Boolean).length;
  if (missing) return `${missing} trường bắt buộc chưa nhập`;
  if (mismatchBlocks) return "Cần xử lý thông tin không khớp";
  return null;
}

export function RecordDialogFooter({ left, hint, children }: { left: ReactNode; hint?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-2.5 border-t bg-card px-5 py-3">
      {left}
      <div className="flex-1" />
      {hint ? <span className="text-xs font-medium text-primary">{hint}</span> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}
