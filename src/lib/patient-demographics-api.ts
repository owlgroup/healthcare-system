import { supabase } from '@/lib/supabase';
import { decryptRow, encryptRow } from '@/lib/crypto';

export type DemographicsRecord = {
  patient_user_id: string;
  gender: string | null;
  birth_gender: string | null;
  ethnicity: string | null;
  nationality: string | null;
  marital_status: string | null;
  updated_at: string;
};

export function mapDemographicsRecord(row: Record<string, unknown>): DemographicsRecord {
  return {
    patient_user_id: String(row.patient_user_id),
    gender: row.gender != null ? String(row.gender) : null,
    birth_gender: row.birth_gender != null ? String(row.birth_gender) : null,
    ethnicity: row.ethnicity != null ? String(row.ethnicity) : null,
    nationality: row.nationality != null ? String(row.nationality) : null,
    marital_status: row.marital_status != null ? String(row.marital_status) : null,
    updated_at: String(row.updated_at ?? ''),
  };
}

export async function fetchDemographics(): Promise<DemographicsRecord | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('patient_demographics')
    .select('*')
    .eq('patient_user_id', user.id)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
      return null;
    }
    throw new Error(error.message);
  }
  if (!data) return null;

  try {
    const decrypted = await decryptRow(data as Record<string, unknown>, 'patient_demographics');
    return mapDemographicsRecord(decrypted);
  } catch {
    return mapDemographicsRecord(data as Record<string, unknown>);
  }
}

export type DemographicsInput = {
  gender?: string | null;
  birth_gender?: string | null;
  ethnicity?: string | null;
  nationality?: string | null;
  marital_status?: string | null;
};

export async function upsertDemographics(input: DemographicsInput): Promise<DemographicsRecord> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const encrypted = await encryptRow(
    {
      gender: input.gender ?? null,
      birth_gender: input.birth_gender ?? null,
      ethnicity: input.ethnicity ?? null,
      nationality: input.nationality ?? null,
      marital_status: input.marital_status ?? null,
    },
    'patient_demographics'
  );

  const { data, error } = await supabase.rpc('upsert_my_demographics', {
    p_gender: encrypted.gender ?? null,
    p_birth_gender: encrypted.birth_gender ?? null,
    p_ethnicity: encrypted.ethnicity ?? null,
    p_nationality: encrypted.nationality ?? null,
    p_marital_status: encrypted.marital_status ?? null,
  });

  if (error) {
    if (error.code === 'PGRST202' || error.message.includes('does not exist')) {
      const { data: upsertData, error: upsertError } = await supabase
        .from('patient_demographics')
        .upsert(
          {
            patient_user_id: user.id,
            ...encrypted,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'patient_user_id' }
        )
        .select('*')
        .single();

      if (upsertError) throw new Error(upsertError.message);
      return mapDemographicsRecord(upsertData as Record<string, unknown>);
    }
    throw new Error(error.message);
  }

  try {
    const decrypted = await decryptRow(data as Record<string, unknown>, 'patient_demographics');
    return mapDemographicsRecord(decrypted);
  } catch {
    return mapDemographicsRecord(data as Record<string, unknown>);
  }
}

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'non_binary', label: 'Phi nhị nguyên' },
  { value: 'other', label: 'Khác' },
  { value: 'prefer_not_to_say', label: 'Không muốn trả lời' },
];

export const BIRTH_GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'intersex', label: 'Liên giới tính' },
];

export const ETHNICITY_OPTIONS = [
  { value: 'kinh', label: 'Kinh' },
  { value: 'tay', label: 'Tày' },
  { value: 'thai', label: 'Thái' },
  { value: 'muong', label: 'Mường' },
  { value: 'khmer', label: 'Khmer' },
  { value: 'hoa', label: 'Hoa' },
  { value: 'nung', label: 'Nùng' },
  { value: 'hmong', label: 'Hmông' },
  { value: 'dao', label: 'Dao' },
  { value: 'other', label: 'Khác' },
];

export const NATIONALITY_OPTIONS = [
  { value: 'vietnam', label: 'Việt Nam' },
  { value: 'usa', label: 'Hoa Kỳ' },
  { value: 'uk', label: 'Vương quốc Anh' },
  { value: 'france', label: 'Pháp' },
  { value: 'germany', label: 'Đức' },
  { value: 'japan', label: 'Nhật Bản' },
  { value: 'korea', label: 'Hàn Quốc' },
  { value: 'china', label: 'Trung Quốc' },
  { value: 'australia', label: 'Úc' },
  { value: 'other', label: 'Khác' },
];

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Độc thân' },
  { value: 'married', label: 'Đã kết hôn' },
  { value: 'divorced', label: 'Đã ly hôn' },
  { value: 'widowed', label: 'Góa' },
  { value: 'domestic_partner', label: 'Sống chung' },
  { value: 'prefer_not_to_say', label: 'Không muốn trả lời' },
];

export function getOptionLabel(
  options: { value: string; label: string }[],
  value: string | null
): string {
  if (!value) return '—';
  return options.find((opt) => opt.value === value)?.label ?? value;
}
