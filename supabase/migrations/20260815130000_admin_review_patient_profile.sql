-- Admin review of submitted patient profiles (FR-005 / RULE-005j / RULE-008f).
-- UNVERIFIED → ACTIVE (approve) or REJECTED (reject with reason).
-- Unverified profiles cannot book appointments.

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'patient'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
      AND pg_get_constraintdef(con.oid) ILIKE '%UNVERIFIED%'
  LOOP
    EXECUTE format('ALTER TABLE public.patient DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.patient
  ADD CONSTRAINT patient_status_check
  CHECK (status IN ('DRAFT', 'UNVERIFIED', 'ACTIVE', 'INACTIVE', 'REJECTED'));

ALTER TABLE public.patient
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN public.patient.reviewed_by IS 'Admin who approved or rejected this profile';
COMMENT ON COLUMN public.patient.reviewed_at IS 'When the profile was approved or rejected';
COMMENT ON COLUMN public.patient.rejection_reason IS 'Required reason when status = REJECTED';

CREATE OR REPLACE FUNCTION public.search_patients_for_staff(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_status text DEFAULT NULL,
  p_created_by_role text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_sort_by text DEFAULT 'updated_at',
  p_sort_dir text DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_status text;
  v_role text;
  v_sort_by text;
  v_sort_dir text;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public.staff_can_access_patients() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := nullif(trim(p_query), '');
  IF v_query IS NOT NULL THEN
    v_query := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');
  END IF;

  v_status := nullif(upper(trim(coalesce(p_status, ''))), '');
  IF v_status IN ('SUBMITTED', 'UNVERIFIED') THEN
    v_status := 'UNVERIFIED';
  ELSIF v_status NOT IN ('ACTIVE', 'UNVERIFIED', 'DRAFT', 'INACTIVE', 'REJECTED') THEN
    v_status := NULL;
  END IF;

  v_role := nullif(lower(trim(coalesce(p_created_by_role, ''))), '');
  IF v_role NOT IN ('patient', 'doctor', 'nurse', 'admin') THEN
    v_role := NULL;
  END IF;

  v_sort_by := nullif(lower(trim(coalesce(p_sort_by, ''))), '');
  IF v_sort_by NOT IN ('full_name', 'date_of_birth', 'updated_at') THEN
    v_sort_by := 'updated_at';
  END IF;

  v_sort_dir := CASE WHEN lower(coalesce(p_sort_dir, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;

  v_page := GREATEST(coalesce(p_page, 1), 1);
  v_limit := LEAST(GREATEST(coalesce(p_limit, 10), 1), 100);
  v_offset := (v_page - 1) * v_limit;

  WITH filtered AS (
    SELECT p.*
    FROM public.patient p
    WHERE
      (
        v_query IS NULL
        OR p.phone_number ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.email_address ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.id_number ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.member_id ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.insurance_provider ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.legal_first_name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.legal_last_name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR trim(coalesce(p.legal_last_name, '') || ' ' || coalesce(p.legal_first_name, ''))
          ILIKE '%' || v_query || '%' ESCAPE '\'
      )
      AND (v_status IS NULL OR p.status = v_status)
      AND (v_role IS NULL OR p.created_by_role = v_role)
      AND (p_date_from IS NULL OR p.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR p.created_at::date <= p_date_to)
  ),
  counted AS (
    SELECT count(*)::bigint AS total
    FROM filtered
  ),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY
      CASE WHEN v_sort_by = 'full_name' AND v_sort_dir = 'asc'
        THEN lower(trim(coalesce(f.legal_last_name, '') || ' ' || coalesce(f.legal_first_name, ''))) END ASC NULLS LAST,
      CASE WHEN v_sort_by = 'full_name' AND v_sort_dir = 'desc'
        THEN lower(trim(coalesce(f.legal_last_name, '') || ' ' || coalesce(f.legal_first_name, ''))) END DESC NULLS LAST,
      CASE WHEN v_sort_by = 'date_of_birth' AND v_sort_dir = 'asc' THEN f.date_of_birth END ASC NULLS LAST,
      CASE WHEN v_sort_by = 'date_of_birth' AND v_sort_dir = 'desc' THEN f.date_of_birth END DESC NULLS LAST,
      CASE WHEN v_sort_by = 'updated_at' AND v_sort_dir = 'asc' THEN f.updated_at END ASC NULLS LAST,
      CASE WHEN v_sort_by = 'updated_at' AND v_sort_dir = 'desc' THEN f.updated_at END DESC NULLS LAST,
      f.updated_at DESC NULLS LAST,
      f.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    coalesce((SELECT jsonb_agg(to_jsonb(paged.*)) FROM paged), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.search_patients_for_staff(
  text, integer, integer, text, text, date, date, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_patients_for_staff(
  text, integer, integer, text, text, date, date, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_patient_profile(
  p_patient_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_status text;
  v_action text;
  v_reason text;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'P0001';
  END IF;

  SELECT role INTO v_role
    FROM public.user_profiles
   WHERE user_id = v_actor;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_action := lower(trim(coalesce(p_action, '')));
  IF v_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_status
    FROM public.patient
   WHERE id = p_patient_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_status IS DISTINCT FROM 'UNVERIFIED' THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0003';
  END IF;

  IF v_action = 'approve' THEN
    UPDATE public.patient
       SET status = 'ACTIVE',
           reviewed_by = v_actor,
           reviewed_at = now(),
           rejection_reason = NULL
     WHERE id = p_patient_id;
    RETURN jsonb_build_object('id', p_patient_id, 'status', 'ACTIVE');
  END IF;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0004';
  END IF;

  UPDATE public.patient
     SET status = 'REJECTED',
         reviewed_by = v_actor,
         reviewed_at = now(),
         rejection_reason = v_reason
   WHERE id = p_patient_id;

  RETURN jsonb_build_object(
    'id', p_patient_id,
    'status', 'REJECTED',
    'rejection_reason', v_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_patient_profile(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_patient_profile(uuid, text, text) TO authenticated;

-- RULE-008f: only ACTIVE profiles may book via the patient app.
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_profile_id    uuid,
  p_specialty_id  uuid,
  p_slot_id       uuid,
  p_note          text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id        uuid;
  v_slot_date         date;
  v_start_time        time;
  v_session_start     time;
  v_session_end       time;
  v_appt_id           uuid;
  v_qr_expires        timestamptz;
  v_reminder_at       timestamptz;
  v_conflict_count    int;
  v_profile_status    text;
  v_slot_doctor_id    uuid;
  v_assigned_doctor   uuid;
  v_specialty_name    text;
BEGIN
  v_patient_id := auth.uid();
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_profile_status
    FROM public.patient
   WHERE id = p_profile_id AND user_id = v_patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_profile_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'PROFILE_UNVERIFIED' USING ERRCODE = 'P0003';
  END IF;

  SELECT slot_date, start_time, doctor_id
    INTO v_slot_date, v_start_time, v_slot_doctor_id
    FROM public.appointment_slots
   WHERE id = p_slot_id
     AND specialty_id = p_specialty_id
     AND is_available = TRUE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING ERRCODE = 'P0004';
  END IF;

  IF (v_slot_date + v_start_time)::timestamptz <= now() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING ERRCODE = 'P0005';
  END IF;

  IF v_start_time < '12:00' THEN
    v_session_start := '06:00'; v_session_end := '12:00';
  ELSE
    v_session_start := '12:00'; v_session_end := '18:00';
  END IF;

  SELECT count(*) INTO v_conflict_count
    FROM public.appointments a
    JOIN public.appointment_slots s ON s.id = a.slot_id
   WHERE a.patient_id = v_patient_id
     AND a.profile_id = p_profile_id
     AND s.slot_date = v_slot_date
     AND s.start_time >= v_session_start
     AND s.start_time <  v_session_end
     AND a.status NOT IN ('CANCELLED', 'NO_SHOW');
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'DUPLICATE_SESSION' USING ERRCODE = 'P0006';
  END IF;

  IF v_slot_doctor_id IS NULL THEN
    SELECT name INTO v_specialty_name
      FROM public.specialties WHERE id = p_specialty_id;

    SELECT up.user_id INTO v_assigned_doctor
      FROM public.user_profiles up
      LEFT JOIN (
        SELECT s2.doctor_id, count(*) AS cnt
          FROM public.appointments a2
          JOIN public.appointment_slots s2 ON s2.id = a2.slot_id
         WHERE s2.slot_date = v_slot_date
           AND a2.status NOT IN ('CANCELLED', 'NO_SHOW')
         GROUP BY s2.doctor_id
      ) load ON load.doctor_id = up.user_id
     WHERE up.role = 'doctor'
       AND up.specialty = v_specialty_name
     ORDER BY coalesce(load.cnt, 0) ASC
     LIMIT 1;

    IF v_assigned_doctor IS NOT NULL THEN
      UPDATE public.appointment_slots
         SET doctor_id = v_assigned_doctor
       WHERE id = p_slot_id;
    END IF;
  END IF;

  UPDATE public.appointment_slots SET is_available = FALSE WHERE id = p_slot_id;

  v_qr_expires  := (v_slot_date::timestamptz + INTERVAL '1 day' - INTERVAL '1 second');
  v_reminder_at := (v_slot_date + v_start_time)::timestamptz - INTERVAL '24 hours';

  INSERT INTO public.appointments (
    patient_id, profile_id, specialty_id, slot_id,
    status, note, qr_token, qr_expires_at, reminder_at
  ) VALUES (
    v_patient_id, p_profile_id, p_specialty_id, p_slot_id,
    'CONFIRMED', p_note, gen_random_uuid(), v_qr_expires, v_reminder_at
  )
  RETURNING id INTO v_appt_id;

  RETURN v_appt_id;
END;
$$;
