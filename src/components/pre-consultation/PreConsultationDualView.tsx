/**
 * Dual-view: patient (left) + doctor exam declaration (right)
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getPreConsultationBundle } from '@/lib/pre-consultation-api';
import { hasClinicalContent } from '@/lib/pre-consultation-form-utils';
import type { PreConsultationBundle } from '@/types/pre-consultation';
import PreConsultationEmptyState from './PreConsultationEmptyState';
import PatientPreConsultationPanel from './PatientPreConsultationPanel';
import DoctorExamPreConsultationForm from './DoctorExamPreConsultationForm';
import { useAuth } from '@/hooks/use-auth';

type Props = {
  appointmentId: string;
  appointmentStatus?: string;
  editable?: boolean;
  onSaved?: () => void;
  /** Stacked intake cards used by the admin appointment dialog. */
  layout?: "columns" | "intake";
  onRemind?: () => void;
  reminding?: boolean;
};

const CLOSED_STATUSES = new Set(['CANCELLED', 'COMPLETED', 'NO_SHOW']);

export default function PreConsultationDualView({
  appointmentId,
  appointmentStatus,
  editable = true,
  onSaved,
  layout = "columns",
  onRemind,
  reminding = false,
}: Props) {
  const { role } = useAuth();
  const [bundle, setBundle] = useState<PreConsultationBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const canEditDoctorForm = role === 'doctor' || role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPreConsultationBundle(appointmentId);
      setBundle(data);
      const hasDoctor = hasClinicalContent(data.doctor);
      const patientSubmitted = data.patient?.status === 'SUBMITTED';
      if (hasDoctor || patientSubmitted) {
        setShowEditor(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isClosed = appointmentStatus ? CLOSED_STATUSES.has(appointmentStatus) : false;
  const canEdit = editable && !isClosed;

  const patientSubmitted = bundle?.patient?.status === 'SUBMITTED';
  const patientDraft = bundle?.patient?.status === 'DRAFT';
  const hasDoctorContent = hasClinicalContent(bundle?.doctor ?? null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Lỗi</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const showForm = layout === "intake" || showEditor || hasDoctorContent || patientSubmitted;

  if (!showForm) {
    return (
      <div className="space-y-4">
        <PreConsultationEmptyState
          onCreate={() => setShowEditor(true)}
          canCreate={canEdit}
        />
        {patientDraft && (
          <p className="text-center text-sm text-amber-700 px-4">
            Bệnh nhân đang khai báo (chưa gửi). Bác sĩ có thể tạo khai báo riêng bằng nút trên.
          </p>
        )}
      </div>
    );
  }

  const patientPanel = (
    <PatientPreConsultationPanel
      record={patientSubmitted ? bundle?.patient ?? null : null}
      creatorName={bundle?.patientCreatorName}
      submittedAt={bundle?.patient?.submitted_at}
      isDraft={patientDraft && !patientSubmitted}
      variant={layout === "intake" ? "intake" : "default"}
      onRemind={onRemind}
      reminding={reminding}
    />
  );

  const doctorForm = (
    <DoctorExamPreConsultationForm
      appointmentId={appointmentId}
      patientRecord={patientSubmitted ? bundle?.patient ?? null : null}
      canEdit={canEdit && canEditDoctorForm}
      updaterName={bundle?.doctorUpdaterName}
      updatedAt={bundle?.doctor?.updated_at}
      variant={layout === "intake" ? "intake" : "default"}
      onSaved={() => {
        void load();
        onSaved?.();
      }}
    />
  );

  if (layout === "intake") {
    return (
      <div className="space-y-3">
        {patientPanel}
        {doctorForm}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        {patientPanel}
      </div>
      {doctorForm}
    </div>
  );
}
