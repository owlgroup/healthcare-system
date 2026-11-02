/**
 * Pre-consultation data read-only view in EMR context
 * Prefers doctor version, falls back to patient submitted
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Activity, Loader2 } from 'lucide-react';
import { getPreConsultationBundle } from '@/lib/pre-consultation-api';
import { hasClinicalContent } from '@/lib/pre-consultation-form-utils';
import type { PreConsultation, DoctorPreConsultation } from '@/types/pre-consultation';
import {
  SMOKING_LABELS, ALCOHOL_LABELS, EXERCISE_LABELS,
  DURATION_UNIT_LABELS, SYMPTOM_TAG_OPTIONS,
} from '@/types/pre-consultation';

type PreConsultationReadOnlyProps = {
  appointmentId: string;
};

type DisplayRecord = PreConsultation | DoctorPreConsultation;

function pickClinicalRecord(
  doctor: DoctorPreConsultation | null,
  patient: PreConsultation | null,
): DisplayRecord | null {
  if (doctor && hasClinicalContent(doctor)) return doctor;
  if (patient?.status === 'SUBMITTED') return patient;
  return null;
}

export default function PreConsultationReadOnly({ appointmentId }: PreConsultationReadOnlyProps) {
  const [data, setData] = useState<DisplayRecord | null>(null);
  const [source, setSource] = useState<'doctor' | 'patient' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const bundle = await getPreConsultationBundle(appointmentId);
        const picked = pickClinicalRecord(bundle.doctor, bundle.patient);
        setData(picked);
        if (bundle.doctor && hasClinicalContent(bundle.doctor)) {
          setSource('doctor');
        } else if (picked) {
          setSource('patient');
        } else {
          setSource(null);
        }
      } catch {
        setData(null);
        setSource(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [appointmentId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Đang tải khai báo...
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-xs text-muted-foreground py-1">
        Chưa có khai báo y tế trước khám.
      </p>
    );
  }

  const symptomLabel = data.symptom_tags
    .map((t) => SYMPTOM_TAG_OPTIONS.find((o) => o.value === t)?.label ?? t)
    .join(', ');

  return (
    <div className="space-y-3 text-xs">
      {source === 'doctor' && (
        <p className="text-[10px] uppercase tracking-wide text-blue-600 font-medium">
          Nguồn: Bác sĩ cập nhật
        </p>
      )}

      {(data.flags.drug_allergy || data.flags.severe_pain) && (
        <div className="flex flex-wrap gap-1.5">
          {data.flags.drug_allergy && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-700">
              <AlertTriangle className="h-3 w-3" /> Dị ứng thuốc
            </span>
          )}
          {data.flags.severe_pain && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-semibold text-orange-700">
              <Activity className="h-3 w-3" /> Đau dữ dội (≥7/10)
            </span>
          )}
        </div>
      )}

      {data.chief_complaint && (
        <Row label="Lý do khám" value={data.chief_complaint} />
      )}

      {data.symptom_duration != null && (
        <Row
          label="Thời gian"
          value={`${data.symptom_duration} ${data.symptom_duration_unit ? DURATION_UNIT_LABELS[data.symptom_duration_unit] : ''}`}
        />
      )}

      {data.pain_scale != null && (
        <Row
          label="Đau"
          value={
            <span className={data.pain_scale >= 7 ? 'text-orange-600 font-bold' : ''}>
              {data.pain_scale}/10
            </span>
          }
        />
      )}

      {symptomLabel && <Row label="Triệu chứng" value={symptomLabel} />}

      {data.medical_history.length > 0 && (
        <Row
          label="Bệnh nền"
          value={data.medical_history.map((m) => `${m.condition}${m.details ? ` (${m.details})` : ''}`).join(', ')}
        />
      )}

      {data.surgical_history && <Row label="Phẫu thuật" value={data.surgical_history} />}

      {data.drug_allergies.length > 0 && (
        <Row
          label="Dị ứng thuốc"
          value={
            <span className="text-red-600">
              {data.drug_allergies.map((a) => `${a.drug} → ${a.reaction}`).join('; ')}
            </span>
          }
        />
      )}

      {data.current_medications.length > 0 && (
        <Row
          label="Thuốc đang dùng"
          value={data.current_medications.map((m) => `${m.name} ${m.dose} ${m.frequency}`).join(', ')}
        />
      )}

      <div className="flex flex-wrap gap-3">
        {data.smoking && <Row label="Hút thuốc" value={SMOKING_LABELS[data.smoking]} inline />}
        {data.alcohol && <Row label="Rượu bia" value={ALCOHOL_LABELS[data.alcohol]} inline />}
        {data.exercise && <Row label="Tập thể dục" value={EXERCISE_LABELS[data.exercise]} inline />}
      </div>
    </div>
  );
}

function Row({
  label, value, inline,
}: {
  label: string;
  value: React.ReactNode;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <span>
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-medium">{value}</span>
      </span>
    );
  }
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
