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
  variant?: "default" | "intake";
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
  variant = "default",
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
      const bundle = await getPreConsultationBundle(appointmentId);
      const base = bundle.doctor
        ? clinicalRecordToFormData(bundle.doctor)
        : DEFAULT_FORM_DATA;
      baseFormRef.current = base;
      const compact = fullDataToCompactForm(base);
      setFields(compact);
      savedSnapshot.current = compact;

      if (bundle.doctor?.id) {
        setRecordId(bundle.doctor.id);
      } else if (canEdit) {
        const id = await createOrGetDoctorPreConsultation(appointmentId);
        setRecordId(id);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, canEdit]);

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
    ? format(parseISO(updatedAt), variant === "intake" ? "HH:mm dd/MM/yyyy" : "dd/MM/yyyy HH:mm", { locale: vi })
    : null;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (variant === "intake") {
    const fieldLabel = "flex flex-col gap-1 text-xs font-medium text-[#4A4440]";
    const fieldInput =
      "h-[34px] rounded-[7px] border border-[#E1DDDA] bg-[#FAF9F8] px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60";
    return (
      <div className="flex flex-col gap-3 rounded-[10px] border border-[#E8E5E2] bg-white p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-[#1A1614]">Khai báo sử dụng khi khám</span>
          <span className="rounded-full bg-[#EAF0FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4FD8]">
            Bác sĩ nhập
          </span>
        </div>

        <label className={fieldLabel}>
          Triệu chứng chính
          <Input
            value={fields.chief_complaint}
            onChange={(e) => updateField("chief_complaint", e.target.value)}
            disabled={!canEdit}
            placeholder="VD: Đau dạ dày cấp, chướng bụng"
            className={fieldInput}
          />
        </label>

        <SymptomOnsetPicker
          layout="inline"
          value={fields.durationText}
          onChange={(val) => updateField("durationText", val)}
          disabled={!canEdit}
        />

        <label className={fieldLabel}>
          Bệnh sử
          <Textarea
            value={fields.medicalHistoryText}
            onChange={(e) => updateField("medicalHistoryText", e.target.value)}
            disabled={!canEdit}
            rows={2}
            placeholder="VD: Viêm loét dạ dày mãn tính (2023)"
            className="resize-y rounded-[7px] border border-[#E1DDDA] bg-[#FAF9F8] px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60"
          />
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className={fieldLabel}>
            Dị ứng
            <Input
              value={fields.allergiesText}
              onChange={(e) => updateField("allergiesText", e.target.value)}
              disabled={!canEdit}
              placeholder="VD: Dị ứng Penicillin"
              className={fieldInput}
            />
          </label>
          <label className={fieldLabel}>
            Lối sống
            <Input
              value={fields.lifestyleText}
              onChange={(e) => updateField("lifestyleText", e.target.value)}
              disabled={!canEdit}
              placeholder="VD: Hút thuốc (1 bao/ngày)"
              className={fieldInput}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[#F0EDEB] pt-2.5">
          <span className="min-w-0 flex-1 text-[11.5px] text-[#7A726D]">
            Cập nhật cuối: {formatDoctorDisplayName(updaterName)}
            {footerTime ? ` · ${footerTime}` : ""}
          </span>
          {canEdit && patientRecord?.status === "SUBMITTED" && (
            <button
              type="button"
              onClick={handleCopyFromPatient}
              className="h-[30px] cursor-pointer rounded-[7px] border border-[#D9D5D1] bg-white px-2.5 text-xs font-medium text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]"
            >
              Sao chép
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="h-[30px] cursor-pointer rounded-[7px] border border-[#D9D5D1] bg-white px-3 text-xs font-semibold text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Đang lưu…" : "Lưu bản khai khám"}
            </button>
          )}
        </div>
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
