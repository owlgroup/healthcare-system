/**
 * Editable compact form — Khai báo sử dụng khi khám
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SymptomOnsetPicker from './SymptomOnsetPicker';
import {
  createOrGetDoctorPreConsultation,
  getPreConsultationBundle,
  updateDoctorPreConsultation,
} from '@/lib/pre-consultation-api';
import {
  clinicalRecordToFormData,
  compactFormToFullData,
  formDataToUpdateInput,
  fullDataToCompactForm,
} from '@/lib/pre-consultation-form-utils';
import { formatDoctorDisplayName } from '@/lib/provider-dashboard-utils';
import type { PreConsultation, PreConsultationFormData } from '@/types/pre-consultation';
import { DEFAULT_FORM_DATA } from '@/types/pre-consultation';

type CompactFields = {
  chief_complaint: string;
  durationText: string;
  medicalHistoryText: string;
  allergiesText: string;
  lifestyleText: string;
};

type Props = {
  appointmentId: string;
  patientRecord: PreConsultation | null;
  canEdit: boolean;
  updaterName?: string | null;
  updatedAt?: string | null;
  onSaved: () => void;
};

const EMPTY_COMPACT: CompactFields = {
  chief_complaint: '',
  durationText: '',
  medicalHistoryText: '',
  allergiesText: '',
  lifestyleText: '',
};

export default function DoctorExamPreConsultationForm({
  appointmentId,
  patientRecord,
  canEdit,
  updaterName,
  updatedAt,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [fields, setFields] = useState<CompactFields>(EMPTY_COMPACT);
  const savedSnapshot = useRef<CompactFields>(EMPTY_COMPACT);
  const baseFormRef = useRef<PreConsultationFormData>(DEFAULT_FORM_DATA);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const id = await createOrGetDoctorPreConsultation(appointmentId);
      setRecordId(id);
      const bundle = await getPreConsultationBundle(appointmentId);
      const base = bundle.doctor
        ? clinicalRecordToFormData(bundle.doctor)
        : DEFAULT_FORM_DATA;
      baseFormRef.current = base;
      const compact = fullDataToCompactForm(base);
      setFields(compact);
      savedSnapshot.current = compact;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCopyFromPatient = () => {
    if (!patientRecord) {
      toast.info('Chưa có khai báo từ bệnh nhân để sao chép.');
      return;
    }
    const copied = fullDataToCompactForm(clinicalRecordToFormData(patientRecord));
    setFields(copied);
    toast.success('Đã sao chép từ khai báo bệnh nhân.');
  };

  const handleCancel = () => {
    setFields(savedSnapshot.current);
  };

  const handleSave = async () => {
    if (!recordId) return;
    if (!fields.chief_complaint.trim()) {
      toast.error('Vui lòng nhập triệu chứng chính.');
      return;
    }
    setSaving(true);
    try {
      const fullData = compactFormToFullData(fields, baseFormRef.current);
      await updateDoctorPreConsultation(recordId, formDataToUpdateInput(fullData));
      baseFormRef.current = fullData;
      savedSnapshot.current = fields;
      toast.success('Đã lưu bản khai khám.');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof CompactFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const hasAllergy = Boolean(fields.allergiesText.trim());
  const footerTime = updatedAt
    ? format(parseISO(updatedAt), 'dd/MM/yyyy HH:mm', { locale: vi })
    : null;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-4 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <Badge className="bg-blue-600 hover:bg-blue-600 shrink-0">
          Khai báo sử dụng khi khám
        </Badge>
        {canEdit && patientRecord?.status === 'SUBMITTED' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs shrink-0"
            onClick={handleCopyFromPatient}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Sao chép từ bệnh nhân
          </Button>
        )}
      </div>

      <div className="space-y-3 flex-1">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground font-normal">Triệu chứng chính</Label>
          <Input
            value={fields.chief_complaint}
            onChange={(e) => updateField('chief_complaint', e.target.value)}
            disabled={!canEdit}
            placeholder="VD: Đau dạ dày cấp, chướng bụng"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground font-normal">Thời gian</Label>
          <SymptomOnsetPicker
            value={fields.durationText}
            onChange={(val) => updateField('durationText', val)}
            disabled={!canEdit}
            placeholder="Chọn ngày giờ"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground font-normal">Bệnh sử</Label>
          <Textarea
            value={fields.medicalHistoryText}
            onChange={(e) => updateField('medicalHistoryText', e.target.value)}
            disabled={!canEdit}
            rows={2}
            placeholder="VD: Viêm loét dạ dày mãn tính (2023)"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground font-normal">Dị ứng</Label>
          <Input
            value={fields.allergiesText}
            onChange={(e) => updateField('allergiesText', e.target.value)}
            disabled={!canEdit}
            placeholder="VD: Dị ứng Penicillin"
            className={hasAllergy ? 'border-red-400 bg-red-50/40 focus-visible:ring-red-400' : ''}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground font-normal">Lối sống</Label>
          <Input
            value={fields.lifestyleText}
            onChange={(e) => updateField('lifestyleText', e.target.value)}
            disabled={!canEdit}
            placeholder="VD: Hút thuốc (1 bao/ngày)"
          />
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={handleCancel}>
            Hủy thay đổi
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu bản khai khám'}
          </Button>
        </div>
      )}

      {(updaterName || footerTime) && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-[11px] text-blue-900">
          Người cập nhật cuối (Bác sĩ):{' '}
          {formatDoctorDisplayName(updaterName)}
          {footerTime ? ` — ${footerTime}` : ''}
        </div>
      )}
    </div>
  );
}
