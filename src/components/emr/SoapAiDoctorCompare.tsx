import { format, isValid, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Sparkles, Stethoscope } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { SoapChangedField, SoapNoteSnapshot } from '@/lib/exam-activity-log';

const SECTIONS: { field: SoapChangedField; label: string; description: string }[] = [
  { field: 's_text', label: 'S — Subjective', description: 'Lời khai bệnh nhân' },
  { field: 'o_text', label: 'O — Objective', description: 'Kết quả khám thực thể' },
  { field: 'a_text', label: 'A — Assessment', description: 'Chẩn đoán lâm sàng' },
  { field: 'p_text', label: 'P — Plan', description: 'Kế hoạch điều trị' },
];

export function soapTextsDiffer(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? '').trim() !== (right ?? '').trim();
}

function displayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

export function doctorColumnLabel(doctorName?: string | null): string {
  const name = doctorName?.trim();
  if (!name) return 'Bác sĩ sửa';
  if (/^bác sĩ|^bs\.?/i.test(name)) return name;
  return `Bác sĩ ${name}`;
}

export function formatSoapUpdatedAt(iso?: string | null): string | null {
  if (!iso?.trim()) return null;
  const parsed = parseISO(iso);
  if (!isValid(parsed)) return null;
  return format(parsed, 'dd/MM/yyyy HH:mm', { locale: vi });
}

type Props = {
  doctorSoap: SoapNoteSnapshot;
  aiSoap?: SoapNoteSnapshot | null;
  changedFields?: SoapChangedField[];
  doctorName?: string | null;
  updatedAt?: string | null;
  aiGeneratedAt?: string | null;
};

export default function SoapAiDoctorCompare({
  doctorSoap,
  aiSoap,
  changedFields,
  doctorName,
  updatedAt,
  aiGeneratedAt,
}: Props) {
  const doctorLabel = doctorColumnLabel(doctorName);
  const updatedAtLabel = formatSoapUpdatedAt(updatedAt);
  const aiGeneratedAtLabel = formatSoapUpdatedAt(aiGeneratedAt);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
        <div data-testid="soap-ai-column-header" className="flex flex-col gap-0.5 text-amber-800">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Nháp AI
          </div>
          {aiGeneratedAtLabel && (
            <span className="text-[11px] font-medium text-muted-foreground pl-5">
              {aiGeneratedAtLabel}
            </span>
          )}
        </div>
        <div data-testid="soap-doctor-column-header" className="flex flex-col gap-0.5 text-emerald-800">
          <div className="flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" />
            {doctorLabel}
          </div>
          {updatedAtLabel && (
            <span className="text-[11px] font-medium text-muted-foreground pl-5">
              {updatedAtLabel}
            </span>
          )}
        </div>
      </div>

      {SECTIONS.map((section) => {
        const aiText = aiSoap?.[section.field] ?? null;
        const doctorText = doctorSoap[section.field] ?? null;
        const changed = changedFields
          ? changedFields.includes(section.field)
          : soapTextsDiffer(aiText, doctorText);

        return (
          <div
            key={section.field}
            data-testid={`soap-block-${section.field}`}
            data-changed={changed ? 'true' : 'false'}
            className="space-y-1.5"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-primary">{section.label}</span>
              <span className="text-xs text-muted-foreground">{section.description}</span>
              {changed && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                  Đã sửa
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <CompareCard
                side="ai"
                text={aiText}
                changed={changed}
                doctorLabel={doctorLabel}
                updatedAtLabel={updatedAtLabel}
                aiGeneratedAtLabel={aiGeneratedAtLabel}
              />
              <CompareCard
                side="doctor"
                text={doctorText}
                changed={changed}
                doctorLabel={doctorLabel}
                updatedAtLabel={updatedAtLabel}
                aiGeneratedAtLabel={aiGeneratedAtLabel}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompareCard({
  side,
  text,
  changed,
  doctorLabel,
  updatedAtLabel,
  aiGeneratedAtLabel,
}: {
  side: 'ai' | 'doctor';
  text: string | null;
  changed: boolean;
  doctorLabel: string;
  updatedAtLabel: string | null;
  aiGeneratedAtLabel: string | null;
}) {
  const isAi = side === 'ai';
  return (
    <Card
      data-testid={`soap-${side}-card`}
      className={
        isAi
          ? 'border-amber-200 bg-amber-50/60'
          : changed
            ? 'border-emerald-400 bg-emerald-50/80 shadow-sm'
            : 'border-border/50'
      }
    >
      <CardContent className="py-2.5 px-3">
        <p className="sm:hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          {isAi
            ? ['Nháp AI', aiGeneratedAtLabel].filter(Boolean).join(' · ')
            : [doctorLabel, updatedAtLabel].filter(Boolean).join(' · ')}
        </p>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {displayText(text)}
        </p>
      </CardContent>
    </Card>
  );
}
