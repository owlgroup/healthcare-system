-- RPC to fetch doctors available for a given specialty
-- Used by patient booking wizard to select preferred doctor

CREATE OR REPLACE FUNCTION public.get_doctors_by_specialty(p_specialty_id UUID)
RETURNS TABLE (
  doctor_id UUID,
  full_name TEXT,
  specialty TEXT,
  facility_name TEXT,
  next_available DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    up.user_id AS doctor_id,
    up.full_name,
    up.specialty,
    f.name AS facility_name,
    (
      SELECT MIN(slots.slot_date)
      FROM public.appointment_slots slots
      WHERE slots.doctor_id = up.user_id
        AND slots.specialty_id = p_specialty_id
        AND slots.is_available = TRUE
        AND slots.slot_date >= CURRENT_DATE
    ) AS next_available
  FROM public.doctor_schedules ds
  JOIN public.user_profiles up ON up.user_id = ds.doctor_id
  LEFT JOIN public.facilities f ON f.id = ds.facility_id
  WHERE ds.specialty_id = p_specialty_id
    AND ds.is_active = TRUE
    AND up.role = 'doctor'
    AND LOWER(up.status) = 'active'
    AND (ds.valid_until IS NULL OR ds.valid_until >= CURRENT_DATE)
  ORDER BY up.full_name;
END;
$$;

COMMENT ON FUNCTION public.get_doctors_by_specialty(UUID) IS
  'Returns doctors who have an active schedule for the given specialty. Used by patient booking wizard.';

GRANT EXECUTE ON FUNCTION public.get_doctors_by_specialty(UUID) TO authenticated;
