import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Beer,
  Cigarette,
  Dumbbell,
  Loader2,
  Lock,
  Pencil,
  Pill,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchSexualHealth,
  upsertSexualHealth,
} from '@/lib/patient-sexual-health-api';
import { fetchMyHealthHistory } from '@/lib/patient-health-history-api';
import { sanitizeSensitiveInput } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { HealthAllergy } from '@/types/patient-health-history';

type PrepStatusOption = {
  value: string;
  label: string;
  medication?: string;
};

const PREP_STATUS_OPTIONS: PrepStatusOption[] = [
  {
    value: 'daily_prep',
    label: 'Đang điều trị PrEP Hàng ngày (Daily PrEP)',
    medication: 'Descovy 200mg/25mg (Emtricitabine/Tenofovir AF)',
  },
  {
    value: 'on_demand_prep',
    label: 'PrEP theo sự kiện (On-demand PrEP)',
    medication: 'Truvada 200mg/300mg',
  },
  {
    value: 'pep',
    label: 'Đang sử dụng PEP (28 ngày)',
    medication: 'Tenofovir/Emtricitabine + Dolutegravir',
  },
  { value: 'none', label: 'Không sử dụng PrEP/PEP' },
  { value: 'considering', label: 'Đang cân nhắc sử dụng' },
];

const SMOKING_OPTIONS = [
  { value: 'none', label: 'Không hút' },
  { value: 'former', label: 'Đã bỏ' },
  { value: 'occasional', label: 'Thỉnh thoảng' },
  { value: 'regular', label: 'Hút thường xuyên' },
];

const ALCOHOL_OPTIONS = [
  { value: 'none', label: 'Không uống' },
  { value: 'rare', label: 'Ít (dưới 1 lần/tháng)' },
  { value: 'occasional', label: 'Thỉnh thoảng (1-2 lần/tuần)' },
  { value: 'regular', label: 'Thường xuyên (hàng ngày)' },
];

const EXERCISE_OPTIONS = [
  { value: 'none', label: 'Không tập' },
  { value: 'occasional', label: 'Thỉnh thoảng (1-2 lần/tuần)' },
  { value: 'regular', label: 'Đều đặn 3 buổi/tuần' },
  { value: 'active', label: 'Tích cực (5+ buổi/tuần)' },
];

function getPrepOptionByValue(value: string | null): PrepStatusOption | null {
  if (!value) return null;
  return PREP_STATUS_OPTIONS.find((opt) => opt.value === value) ?? null;
}

function getOptionLabel(
  options: { value: string; label: string }[],
  value: string | null
): string {
  if (!value) return '—';
  return options.find((opt) => opt.value === value)?.label ?? value;
}

function AllergyWarningCard({ allergies }: { allergies: HealthAllergy[] }) {
  const drugAllergies = allergies.filter((a) =>
    a.name.toLowerCase().includes('thuốc') ||
    ['penicillin', 'aspirin', 'ibuprofen', 'amoxicillin'].some((drug) =>
      a.name.toLowerCase().includes(drug)
    )
  );
  const foodAllergies = allergies.filter(
    (a) => !drugAllergies.includes(a) && a.name
  );

  if (allergies.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-700">
        <AlertTriangle className="h-4 w-4" />
        Cảnh báo tiền sử dị ứng đã ghi nhận
      </div>
      <ul className="space-y-1.5 text-sm text-amber-900">
        {drugAllergies.length > 0 && (
          <li>
            <span className="font-semibold text-rose-600">• Dị ứng thuốc:</span>{' '}
            {drugAllergies
              .map((a) => `${a.name}${a.reaction ? ` → ${a.reaction}` : ''}`)
              .join(', ')}
          </li>
        )}
        {foodAllergies.length > 0 && (
          <li>
            <span className="font-semibold">• Dị ứng thực phẩm:</span>{' '}
            {foodAllergies
              .map((a) => `${a.name}${a.reaction ? ` → ${a.reaction}` : ''}`)
              .join(', ')}
          </li>
        )}
      </ul>
    </div>
  );
}

function EditModal({
  open,
  onClose,
  initialData,
  onSave,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  initialData: {
    prepStatus: string;
    smoking: string;
    alcohol: string;
    exercise: string;
    notes: string;
  };
  onSave: (data: {
    prepStatus: string;
    smoking: string;
    alcohol: string;
    exercise: string;
    notes: string;
  }) => void;
  isPending: boolean;
}) {
  const [prepStatus, setPrepStatus] = useState(initialData.prepStatus);
  const [smoking, setSmoking] = useState(initialData.smoking);
  const [alcohol, setAlcohol] = useState(initialData.alcohol);
  const [exercise, setExercise] = useState(initialData.exercise);
  const [notes, setNotes] = useState(initialData.notes);

  useEffect(() => {
    if (open) {
      setPrepStatus(initialData.prepStatus);
      setSmoking(initialData.smoking);
      setAlcohol(initialData.alcohol);
      setExercise(initialData.exercise);
      setNotes(initialData.notes);
    }
  }, [open, initialData]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="mb-6 text-xl font-bold">Chỉnh sửa thông tin</h3>

        <div className="space-y-5">
          <div>
            <Label>Phác đồ PrEP / PEP đang sử dụng</Label>
            <Select value={prepStatus} onValueChange={setPrepStatus}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Chọn phác đồ" />
              </SelectTrigger>
              <SelectContent>
                {PREP_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Thuốc lá</Label>
              <Select value={smoking} onValueChange={setSmoking}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Chọn" />
                </SelectTrigger>
                <SelectContent>
                  {SMOKING_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Rượu bia</Label>
              <Select value={alcohol} onValueChange={setAlcohol}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Chọn" />
                </SelectTrigger>
                <SelectContent>
                  {ALCOHOL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Thể thao</Label>
              <Select value={exercise} onValueChange={setExercise}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Chọn" />
                </SelectTrigger>
                <SelectContent>
                  {EXERCISE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Ghi chú cho bác sĩ</Label>
            <Input
              id="notes"
              className="mt-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thông tin bổ sung cho bác sĩ..."
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Hủy
          </Button>
          <Button
            onClick={() =>
              onSave({ prepStatus, smoking, alcohol, exercise, notes })
            }
            disabled={isPending}
          >
            {isPending ? 'Đang lưu...' : 'Lưu thông tin'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const AccountSexualHealthPage = () => {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: sexualHealth, isLoading: isLoadingSexual } = useQuery({
    queryKey: ['patient', 'sexual-health'],
    queryFn: fetchSexualHealth,
  });

  const { data: healthHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['patient', 'health-history'],
    queryFn: fetchMyHealthHistory,
  });

  const saveMutation = useMutation({
    mutationFn: (data: {
      prepStatus: string;
      smoking: string;
      alcohol: string;
      exercise: string;
      notes: string;
    }) =>
      upsertSexualHealth({
        prep_pep_status: data.prepStatus || null,
        notes_for_doctor: [
          data.notes,
          `lifestyle:${JSON.stringify({
            smoking: data.smoking,
            alcohol: data.alcohol,
            exercise: data.exercise,
          })}`,
        ]
          .filter(Boolean)
          .join('||'),
      }),
    onSuccess: () => {
      toast.success('Đã lưu thông tin');
      void queryClient.invalidateQueries({ queryKey: ['patient', 'sexual-health'] });
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isLoading = isLoadingSexual || isLoadingHistory;

  const prepStatus = sanitizeSensitiveInput(sexualHealth?.prep_pep_status);
  const prepOption = getPrepOptionByValue(prepStatus);

  const notesRaw = sanitizeSensitiveInput(sexualHealth?.notes_for_doctor);
  let lifestyle = { smoking: 'none', alcohol: 'none', exercise: 'none' };
  let notes = notesRaw;

  if (notesRaw.includes('lifestyle:')) {
    const parts = notesRaw.split('||');
    const lifestylePart = parts.find((p) => p.startsWith('lifestyle:'));
    if (lifestylePart) {
      try {
        lifestyle = JSON.parse(lifestylePart.replace('lifestyle:', ''));
        notes = parts.filter((p) => !p.startsWith('lifestyle:')).join('||');
      } catch {
        // ignore parse error
      }
    }
  }

  const allergies = healthHistory?.allergies ?? [];

  const hasData = Boolean(prepStatus && prepStatus !== '—');

  return (
    <section className="mx-auto" style={{ maxWidth: 1168 }}>
      <p className="mb-4 text-sm text-muted-foreground">
        Sức khỏe sinh sản & Lối sống
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Sức khỏe sinh sản & Lối sống
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Dữ liệu theo dõi sức khỏe và thói quen sinh hoạt định kỳ giúp
                Bác sĩ đánh giá phác đồ điều trị an toàn.
              </p>
            </div>
            <Button
              variant="default"
              className="gap-2"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              Chỉnh sửa thông tin
            </Button>
          </div>

          {!hasData ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Chưa có dữ liệu. Bấm &quot;Chỉnh sửa thông tin&quot; để cập nhật.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* PrEP / PEP Section */}
              <div className="rounded-xl border bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <Pill className="h-4 w-4 text-teal-600" />
                  Phác đồ PrEP / PEP đang sử dụng
                </div>
                <div className="text-base font-semibold text-foreground">
                  {prepOption?.label ?? prepStatus ?? '—'}
                </div>
                {prepOption?.medication && (
                  <div className="mt-1 text-sm text-teal-600">
                    Thuốc: {prepOption.medication}
                  </div>
                )}
              </div>

              {/* Lifestyle Section */}
              <div className="rounded-xl border bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Thói quen sinh hoạt & Vận động
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Cigarette
                      className={cn(
                        'h-4 w-4',
                        lifestyle.smoking === 'none'
                          ? 'text-muted-foreground'
                          : 'text-amber-600'
                      )}
                    />
                    <span className="text-muted-foreground">Thuốc lá:</span>
                    <span className="font-semibold">
                      {getOptionLabel(SMOKING_OPTIONS, lifestyle.smoking)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Beer
                      className={cn(
                        'h-4 w-4',
                        lifestyle.alcohol === 'none'
                          ? 'text-muted-foreground'
                          : 'text-amber-600'
                      )}
                    />
                    <span className="text-muted-foreground">Rượu bia:</span>
                    <span className="font-semibold">
                      {getOptionLabel(ALCOHOL_OPTIONS, lifestyle.alcohol)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Dumbbell
                      className={cn(
                        'h-4 w-4',
                        lifestyle.exercise === 'none'
                          ? 'text-muted-foreground'
                          : 'text-emerald-600'
                      )}
                    />
                    <span className="text-muted-foreground">Thể thao:</span>
                    <span className="font-semibold">
                      {getOptionLabel(EXERCISE_OPTIONS, lifestyle.exercise)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Allergy Warning */}
          <AllergyWarningCard allergies={allergies} />

          {/* Privacy note */}
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-primary" />
            Thông tin được bảo mật và chỉ hiển thị cho Bác sĩ điều trị
          </div>
        </div>
      )}

      <EditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialData={{
          prepStatus: prepStatus === '—' ? '' : prepStatus,
          smoking: lifestyle.smoking,
          alcohol: lifestyle.alcohol,
          exercise: lifestyle.exercise,
          notes: notes === '—' ? '' : notes,
        }}
        onSave={(data) => saveMutation.mutate(data)}
        isPending={saveMutation.isPending}
      />
    </section>
  );
};

export default AccountSexualHealthPage;
