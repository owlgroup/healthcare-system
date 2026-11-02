-- Doctor avatar: add avatar_storage_path column to user_profiles
-- Reuses the existing 'avatars' storage bucket with owner-based RLS

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_storage_path text;

COMMENT ON COLUMN public.user_profiles.avatar_storage_path IS
  'Supabase Storage path in bucket avatars, e.g. {user_id}/avatar_<timestamp>.jpg';

-- Update get_my_doctor_profile to include avatar_storage_path
CREATE OR REPLACE FUNCTION public.get_my_doctor_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'user_id', up.user_id,
    'full_name', up.full_name,
    'email', up.email,
    'phone', up.phone,
    'specialty', up.specialty,
    'facility_id', up.facility_id,
    'status', up.status,
    'avatar_storage_path', up.avatar_storage_path,
    'sign_pin_plain', up.sign_pin_plain,
    'pin_set_at', dp.pin_set_at,
    'pin_locked_until', dp.pin_locked_until,
    'pin_failed_count', COALESCE(dp.pin_failed_count, 0),
    'has_pin', (dp.doctor_id IS NOT NULL)
  ) INTO v_result
  FROM public.user_profiles up
  LEFT JOIN public.doctor_pins dp ON dp.doctor_id = up.user_id
  WHERE up.user_id = v_uid AND up.role = 'doctor';

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'NOT_DOCTOR' USING errcode = 'P0002';
  END IF;

  RETURN v_result;
END;
$$;

-- Function for doctor to update their own avatar path
CREATE OR REPLACE FUNCTION public.update_doctor_avatar(
  p_avatar_path text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  UPDATE public.user_profiles
  SET avatar_storage_path = p_avatar_path, updated_at = now()
  WHERE user_id = v_uid AND role = 'doctor';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_DOCTOR' USING errcode = 'P0002';
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_doctor_avatar(text) TO authenticated;
