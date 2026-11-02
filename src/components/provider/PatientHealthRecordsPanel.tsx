import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import SoapNoteReadOnly from '@/components/emr/SoapNoteReadOnly';
import { listLockedExaminationsForPatient } from '@/lib/emr-api';
import {
  examsToHealthRecordVersions,
  listHealthRecordVersions,
  versionToExam,
  type HealthRecordVersion,
} from '@/lib/patient-health-records-storage';

type PatientHealthRecordsPanelProps = {
  patientUserId: string | null;
  profileId: string | null;
  /** Extra localStorage keys (demo / legacy). */
  fallbackLookupIds?: string[];
};

export default function PatientHealthRecordsPanel({
  patientUserId,
  profileId,
  fallbackLookupIds = [],
}: PatientHealthRecordsPanelProps) {
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['patient', 'locked-exams', patientUserId, profileId],
    queryFn: () => listLockedExaminationsForPatient({ patientUserId, profileId }),
    enabled: Boolean(patientUserId || profileId),
  });

  const versions = useMemo(() => {
    const fromDb = examsToHealthRecordVersions(exams);
    if (fromDb.length > 0) return fromDb;

    const seen = new Set<string>();
    const merged: HealthRecordVersion[] = [];
    for (const id of fallbackLookupIds) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      for (const v of listHealthRecordVersions(id)) {
        if (!merged.some((m) => m.exam_id === v.exam_id)) merged.push(v);
      }
    }
    return merged.sort(
      (a, b) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime(),
    );
  }, [exams, fallbackLookupIds]);

  const expanded = expandedVersion ?? versions[0]?.version ?? null;

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải hồ sơ đã ký…
      </p>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="py-10 text-center">
        <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">Chưa có hồ sơ khám đã ký</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Hoàn tất &amp; ký duyệt tại phiên khám để lưu vào đây.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {versions.length} phiên bản hồ sơ — mới nhất ở trên
      </p>
      {versions.map((record) => {
        const isOpen = expanded === record.version;
        const icdCount = record.icd_codes.filter((c) => c.confirm_status === 'CONFIRMED').length;
        return (
          <article
            key={record.exam_id}
            className="rounded-xl border bg-background overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedVersion(isOpen ? null : record.version)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Phiên bản {record.version}
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Đã ký
                  </span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {format(parseISO(record.signed_at), "dd/MM/yyyy 'lúc' HH:mm", { locale: vi })}
                  {icdCount > 0 && ` · ${icdCount} chẩn đoán ICD`}
                </p>
              </div>
              {isOpen ? (
                <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
            {isOpen && (
              <div className="border-t px-4 py-4">
                <SoapNoteReadOnly exam={versionToExam(record)} showTimestamp={false} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
