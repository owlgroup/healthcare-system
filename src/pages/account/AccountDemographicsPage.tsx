import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchDemographics,
  upsertDemographics,
  getOptionLabel,
  GENDER_OPTIONS,
  BIRTH_GENDER_OPTIONS,
  ETHNICITY_OPTIONS,
  NATIONALITY_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from '@/lib/patient-demographics-api';
import { useMyPatientProfile } from '@/hooks/useMyPatientProfile';
import { sanitizeSensitiveInput } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type FieldCardProps = {
  label: string;
  value: string;
};

function FieldCard({ label, value }: FieldCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function mapBhytGenderToValue(bhytGender: string | null): string | null {
  if (!bhytGender) return null;
  const trimmed = bhytGender.trim();
  const upper = trimmed.toUpperCase();

  if (upper === 'NAM' || upper === 'MALE' || upper === 'M') return 'male';
  if (upper === 'NỮ' || upper === 'NU' || upper === 'FEMALE' || upper === 'F') return 'female';

  const normalized = trimmed.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (normalized === 'nam' || normalized === 'male') return 'male';
  if (normalized === 'nu' || normalized === 'female') return 'female';

  return null;
}

const AccountDemographicsPage = () => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: demographics, isLoading: isLoadingDemographics } = useQuery({
    queryKey: ['patient', 'demographics'],
    queryFn: fetchDemographics,
  });

  const { data: profile, isLoading: isLoadingProfile } = useMyPatientProfile();

  const isLoading = isLoadingDemographics || isLoadingProfile;

  const rawGender = sanitizeSensitiveInput(demographics?.gender);
  const rawBirthGender = sanitizeSensitiveInput(demographics?.birth_gender);
  const rawEthnicity = sanitizeSensitiveInput(demographics?.ethnicity);
  const rawNationality = sanitizeSensitiveInput(demographics?.nationality);
  const rawMaritalStatus = sanitizeSensitiveInput(demographics?.marital_status);

  const profileGender = mapBhytGenderToValue(profile?.bhyt_gender ?? null);

  const currentGender = rawGender || profileGender || '';
  const currentBirthGender = rawBirthGender || profileGender || '';
  const currentEthnicity = rawEthnicity || '';
  const currentNationality = rawNationality || 'vietnam';
  const currentMaritalStatus = rawMaritalStatus || '';

  const [gender, setGender] = useState(currentGender);
  const [birthGender, setBirthGender] = useState(currentBirthGender);
  const [ethnicity, setEthnicity] = useState(currentEthnicity);
  const [nationality, setNationality] = useState(currentNationality);
  const [maritalStatus, setMaritalStatus] = useState(currentMaritalStatus);

  const handleStartEdit = () => {
    setGender(currentGender);
    setBirthGender(currentBirthGender);
    setEthnicity(currentEthnicity);
    setNationality(currentNationality);
    setMaritalStatus(currentMaritalStatus);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertDemographics({
        gender: gender || null,
        birth_gender: birthGender || null,
        ethnicity: ethnicity || null,
        nationality: nationality || null,
        marital_status: maritalStatus || null,
      }),
    onSuccess: () => {
      toast.success('Đã cập nhật thông tin');
      void queryClient.invalidateQueries({ queryKey: ['patient', 'demographics'] });
      setIsEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <section>
        <p className="mb-4 text-sm text-muted-foreground">Thông tin nhân khẩu học</p>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto" style={{ maxWidth: 1168 }}>
      <p className="mb-4 text-sm text-muted-foreground">Thông tin nhân khẩu học</p>

      <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
        {isEditing ? (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Chỉnh sửa thông tin nhân khẩu học (SRS Module 3)
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Cập nhật lại các trường dữ liệu hành chính theo quy định.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
                Hủy bỏ
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">
                    Giới tính (gender) <span className="text-rose-500">*</span>
                  </Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Chọn giới tính" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium">
                    Giới tính khi sinh (birth_gender) <span className="text-rose-500">*</span>
                  </Label>
                  <Select value={birthGender} onValueChange={setBirthGender}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Chọn" />
                    </SelectTrigger>
                    <SelectContent>
                      {BIRTH_GENDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">
                    Dân tộc (ethnicity) <span className="text-rose-500">*</span>
                  </Label>
                  <Select value={ethnicity} onValueChange={setEthnicity}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Chọn dân tộc" />
                    </SelectTrigger>
                    <SelectContent>
                      {ETHNICITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Tình trạng mối quan hệ</Label>
                  <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Chọn" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARITAL_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Quốc tịch (nationality)</Label>
                <Input
                  className="mt-2"
                  value={getOptionLabel(NATIONALITY_OPTIONS, nationality)}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().trim();
                    const match = NATIONALITY_OPTIONS.find(
                      (opt) => opt.label.toLowerCase() === val
                    );
                    setNationality(match?.value || nationality);
                  }}
                  placeholder="Việt Nam"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={handleCancel} disabled={saveMutation.isPending}>
                Hủy
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Đang lưu...' : 'Cập nhật thông tin'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Thông tin nhân khẩu học (SRS Module 3 — Patient Profiles)
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Các trường thông tin hành chính và định danh bắt buộc theo đặc tả kỹ
                  thuật SRS.
                </p>
              </div>
              <Button
                variant="default"
                className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
                onClick={handleStartEdit}
              >
                <Pencil className="h-4 w-4" />
                Chỉnh sửa thông tin
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldCard
                label="Giới tính (Gender)"
                value={getOptionLabel(GENDER_OPTIONS, currentGender || null)}
              />
              <FieldCard
                label="Giới tính khi sinh (Birth_Gender)"
                value={getOptionLabel(BIRTH_GENDER_OPTIONS, currentBirthGender || null)}
              />
              <FieldCard
                label="Dân tộc (Ethnicity)"
                value={getOptionLabel(ETHNICITY_OPTIONS, currentEthnicity || null)}
              />
              <FieldCard
                label="Tình trạng hôn nhân / Mối quan hệ"
                value={getOptionLabel(MARITAL_STATUS_OPTIONS, currentMaritalStatus || null)}
              />
              <FieldCard
                label="Quốc tịch (Nationality)"
                value={getOptionLabel(NATIONALITY_OPTIONS, currentNationality || null)}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default AccountDemographicsPage;
