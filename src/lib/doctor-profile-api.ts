import { supabase } from '@/lib/supabase';
import { setDoctorPin } from '@/lib/emr-api';
import { decrypt } from '@/lib/crypto';

export type DoctorProfile = {
  user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  specialty: string | null;
  facility_id: string | null;
  status: string;
  avatar_storage_path: string | null;
  sign_pin_plain: string | null;
  pin_set_at: string | null;
  pin_locked_until: string | null;
  pin_failed_count: number;
  has_pin: boolean;
};

export async function getMyDoctorProfile(): Promise<DoctorProfile> {
  const { data, error } = await supabase.rpc('get_my_doctor_profile');
  if (error) throw new Error(error.message);
  const profile = data as DoctorProfile;
  if (profile.phone) {
    profile.phone = await decrypt(profile.phone);
  }
  return profile;
}

export async function updateMyDoctorPin(newPin: string): Promise<void> {
  await setDoctorPin(newPin);
}
