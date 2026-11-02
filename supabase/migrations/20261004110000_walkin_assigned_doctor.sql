-- Add assigned_doctor_id to appointments for walk-in appointments
-- When a doctor creates a walk-in, they are automatically assigned to it

-- 1. Add column for assigned doctor (used when slot_id IS NULL for walk-ins)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS assigned_doctor_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.appointments.assigned_doctor_id
  IS 'Doctor assigned to walk-in appointments (when slot_id is NULL). Set to creating doctor for walk-ins.';

CREATE INDEX IF NOT EXISTS appt_assigned_doctor_idx ON public.appointments (assigned_doctor_id);

-- 2. Update admin_create_walkin to set assigned_doctor_id when doctor creates walk-in
CREATE OR REPLACE FUNCTION public.admin_create_walkin(
  p_profile_id   UUID,
  p_specialty_id UUID,
  p_note         TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id          UUID;
  v_patient_id        UUID;
  v_appt_id           UUID;
  v_is_doctor         BOOLEAN;
  v_assigned_doctor   UUID;
BEGIN
  v_actor_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE user_id = v_actor_id AND role IN ('admin', 'doctor')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  -- Check if actor is a doctor
  v_is_doctor := EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE user_id = v_actor_id AND role = 'doctor'
  );

  -- Doctor can only create walk-in for their own specialty
  IF v_is_doctor THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.specialties sp
        JOIN public.user_profiles up ON up.specialty = sp.name
       WHERE sp.id = p_specialty_id
         AND up.user_id = v_actor_id
    ) THEN
      RAISE EXCEPTION 'SPECIALTY_MISMATCH' USING errcode = 'P0012';
    END IF;
    -- Doctor is assigned to the walk-in they create
    v_assigned_doctor := v_actor_id;
  ELSE
    -- Admin creates walk-in without assigned doctor
    v_assigned_doctor := NULL;
  END IF;

  -- Get patient's user_id (may be NULL for patients without account)
  SELECT user_id INTO v_patient_id FROM public.patient WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  INSERT INTO public.appointments (
    patient_id, profile_id, specialty_id,
    status, note, walk_in,
    qr_expires_at, reminder_at,
    assigned_doctor_id
  ) VALUES (
    v_patient_id,  -- May be NULL for patients without account
    p_profile_id, p_specialty_id,
    'CONFIRMED', p_note, TRUE,
    (CURRENT_DATE::text || ' 23:59:59')::TIMESTAMPTZ,
    NULL,
    v_assigned_doctor
  )
  RETURNING id INTO v_appt_id;

  INSERT INTO public.appointments_audit_log (appointment_id, action, performed_by, new_status, notes)
  VALUES (v_appt_id, 'CREATE_WALKIN', v_actor_id, 'CONFIRMED', p_note);

  RETURN v_appt_id;
END;
$$;

COMMENT ON FUNCTION public.admin_create_walkin IS 'Create walk-in appointment. Doctor creating walk-in is auto-assigned. Supports patients with or without auth account.';

-- 3. Update search_admin_appointments to use assigned_doctor_id for walk-ins
CREATE OR REPLACE FUNCTION public.search_admin_appointments(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_status text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_specialty_id uuid DEFAULT NULL,
  p_doctor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_status public.appointment_status;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = auth.uid()
      AND up.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := nullif(trim(p_query), '');
  IF v_query IS NOT NULL THEN
    v_query := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');
  END IF;

  BEGIN
    v_status := nullif(trim(coalesce(p_status, '')), '')::public.appointment_status;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_status := NULL;
  END;

  v_page := GREATEST(coalesce(p_page, 1), 1);
  v_limit := LEAST(GREATEST(coalesce(p_limit, 10), 1), 100);
  v_offset := (v_page - 1) * v_limit;

  WITH base AS (
    SELECT
      a.*,
      sp.name AS specialty_name,
      sp.icon AS specialty_icon,
      sl.slot_date,
      sl.start_time,
      sl.end_time,
      COALESCE(sl.doctor_id, a.assigned_doctor_id) AS doctor_id,
      TRIM(COALESCE(pt.legal_last_name, '') || ' ' || COALESCE(pt.legal_first_name, '')) AS patient_name,
      pt.phone_number AS patient_phone,
      pt.date_of_birth AS patient_dob,
      up_doc.full_name AS doctor_name,
      COALESCE(sl.slot_date, a.created_at::date) AS appt_date,
      COALESCE(sl.start_time, a.created_at::time) AS appt_time,
      pc.status AS pre_consult_status_raw,
      pc.flags AS pre_consult_flags,
      dpc.id AS pre_consult_doctor_id,
      dpc.flags AS pre_consult_doctor_flags,
      EXISTS (
        SELECT 1
        FROM public.vital_signs vs
        WHERE vs.appointment_id = a.id
      ) AS has_vital_signs
    FROM public.appointments a
    LEFT JOIN public.specialties sp ON sp.id = a.specialty_id
    LEFT JOIN public.appointment_slots sl ON sl.id = a.slot_id
    LEFT JOIN public.patient pt ON pt.id = a.profile_id
    LEFT JOIN public.user_profiles up_doc ON up_doc.user_id = COALESCE(sl.doctor_id, a.assigned_doctor_id)
    LEFT JOIN LATERAL (
      SELECT pc2.status, pc2.flags
      FROM public.pre_consultations pc2
      WHERE pc2.appointment_id = a.id
      ORDER BY pc2.updated_at DESC
      LIMIT 1
    ) pc ON TRUE
    LEFT JOIN LATERAL (
      SELECT dpc2.id, dpc2.flags
      FROM public.doctor_pre_consultations dpc2
      WHERE dpc2.appointment_id = a.id
      ORDER BY dpc2.updated_at DESC
      LIMIT 1
    ) dpc ON TRUE
    WHERE
      (v_status IS NULL OR a.status = v_status)
      AND (p_specialty_id IS NULL OR a.specialty_id = p_specialty_id)
      AND (p_doctor_id IS NULL OR COALESCE(sl.doctor_id, a.assigned_doctor_id) = p_doctor_id)
      AND (p_date_from IS NULL OR COALESCE(sl.slot_date, a.created_at::date) >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(sl.slot_date, a.created_at::date) <= p_date_to)
      AND (
        v_query IS NULL
        OR pt.phone_number ILIKE '%' || v_query || '%' ESCAPE '\'
        OR pt.id_number ILIKE '%' || v_query || '%' ESCAPE '\'
        OR pt.legal_first_name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR pt.legal_last_name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR TRIM(COALESCE(pt.legal_last_name, '') || ' ' || COALESCE(pt.legal_first_name, ''))
          ILIKE '%' || v_query || '%' ESCAPE '\'
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS total
    FROM base
  ),
  paged AS (
    SELECT b.*
    FROM base b
    ORDER BY
      b.appt_date DESC,
      b.appt_time ASC NULLS LAST,
      b.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'patient_id', p.patient_id,
            'profile_id', p.profile_id,
            'specialty_id', p.specialty_id,
            'slot_id', p.slot_id,
            'status', p.status,
            'note', p.note,
            'walk_in', p.walk_in,
            'cancel_reason', p.cancel_reason,
            'cancelled_at', p.cancelled_at,
            'cancelled_by', p.cancelled_by,
            'created_at', p.created_at,
            'updated_at', p.updated_at,
            'specialty_name', p.specialty_name,
            'specialty_icon', p.specialty_icon,
            'slot_date', p.slot_date,
            'start_time', p.start_time,
            'end_time', p.end_time,
            'doctor_id', p.doctor_id,
            'patient_name', nullif(trim(p.patient_name), ''),
            'patient_phone', p.patient_phone,
            'patient_dob', p.patient_dob,
            'doctor_name', p.doctor_name,
            'pre_consult_status_raw', p.pre_consult_status_raw,
            'pre_consult_flags', p.pre_consult_flags,
            'pre_consult_doctor_exists', p.pre_consult_doctor_id IS NOT NULL,
            'pre_consult_doctor_flags', p.pre_consult_doctor_flags,
            'has_vital_signs', p.has_vital_signs
          )
          ORDER BY p.appt_date DESC, p.appt_time ASC NULLS LAST, p.created_at DESC
        )
        FROM paged p
      ),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- 4. Update search_doctor_appointments to use assigned_doctor_id for walk-ins
CREATE OR REPLACE FUNCTION public.search_doctor_appointments(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_status text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_id uuid;
  v_query text;
  v_status public.appointment_status;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = v_doctor_id
      AND up.role = 'doctor'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := nullif(trim(p_query), '');
  IF v_query IS NOT NULL THEN
    v_query := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');
  END IF;

  BEGIN
    v_status := nullif(trim(coalesce(p_status, '')), '')::public.appointment_status;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_status := NULL;
  END;

  v_page := GREATEST(coalesce(p_page, 1), 1);
  v_limit := LEAST(GREATEST(coalesce(p_limit, 10), 1), 100);
  v_offset := (v_page - 1) * v_limit;

  WITH base AS (
    SELECT
      a.*,
      sp.name AS specialty_name,
      sp.icon AS specialty_icon,
      sl.slot_date,
      sl.start_time,
      sl.end_time,
      COALESCE(sl.doctor_id, a.assigned_doctor_id) AS doctor_id,
      TRIM(COALESCE(pt.legal_last_name, '') || ' ' || COALESCE(pt.legal_first_name, '')) AS patient_name,
      pt.phone_number AS patient_phone,
      pt.date_of_birth AS patient_dob,
      up_doc.full_name AS doctor_name,
      COALESCE(sl.slot_date, a.created_at::date) AS appt_date,
      COALESCE(sl.start_time, a.created_at::time) AS appt_time,
      pc.status AS pre_consult_status_raw,
      pc.flags AS pre_consult_flags,
      dpc.id AS pre_consult_doctor_id,
      dpc.flags AS pre_consult_doctor_flags,
      EXISTS (
        SELECT 1
        FROM public.vital_signs vs
        WHERE vs.appointment_id = a.id
      ) AS has_vital_signs
    FROM public.appointments a
    LEFT JOIN public.specialties sp ON sp.id = a.specialty_id
    LEFT JOIN public.appointment_slots sl ON sl.id = a.slot_id
    LEFT JOIN public.patient pt ON pt.id = a.profile_id
    LEFT JOIN public.user_profiles up_doc ON up_doc.user_id = COALESCE(sl.doctor_id, a.assigned_doctor_id)
    LEFT JOIN LATERAL (
      SELECT pc2.status, pc2.flags
      FROM public.pre_consultations pc2
      WHERE pc2.appointment_id = a.id
      ORDER BY pc2.updated_at DESC
      LIMIT 1
    ) pc ON TRUE
    LEFT JOIN LATERAL (
      SELECT dpc2.id, dpc2.flags
      FROM public.doctor_pre_consultations dpc2
      WHERE dpc2.appointment_id = a.id
      ORDER BY dpc2.updated_at DESC
      LIMIT 1
    ) dpc ON TRUE
    WHERE
      (
        -- Slot assigned to this doctor
        EXISTS (
          SELECT 1
          FROM public.appointment_slots s
          WHERE s.id = a.slot_id
            AND s.doctor_id = v_doctor_id
        )
        -- Slot not assigned, but specialty matches
        OR (
          a.slot_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.appointment_slots s2
            WHERE s2.id = a.slot_id
              AND s2.doctor_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM public.specialties sp2
                JOIN public.user_profiles up ON up.specialty = sp2.name
                WHERE sp2.id = a.specialty_id
                  AND up.user_id = v_doctor_id
                  AND up.role = 'doctor'
              )
          )
        )
        -- Walk-in assigned to this doctor
        OR (
          a.walk_in = TRUE
          AND a.slot_id IS NULL
          AND a.assigned_doctor_id = v_doctor_id
        )
        -- Walk-in not assigned, but specialty matches
        OR (
          a.walk_in = TRUE
          AND a.slot_id IS NULL
          AND a.assigned_doctor_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.specialties sp3
            JOIN public.user_profiles up ON up.specialty = sp3.name
            WHERE sp3.id = a.specialty_id
              AND up.user_id = v_doctor_id
              AND up.role = 'doctor'
          )
        )
      )
      AND (v_status IS NULL OR a.status = v_status)
      AND (p_date_from IS NULL OR COALESCE(sl.slot_date, a.created_at::date) >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(sl.slot_date, a.created_at::date) <= p_date_to)
      AND (
        v_query IS NULL
        OR pt.phone_number ILIKE '%' || v_query || '%' ESCAPE '\'
        OR pt.legal_first_name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR pt.legal_last_name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR TRIM(COALESCE(pt.legal_last_name, '') || ' ' || COALESCE(pt.legal_first_name, ''))
          ILIKE '%' || v_query || '%' ESCAPE '\'
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS total
    FROM base
  ),
  paged AS (
    SELECT b.*
    FROM base b
    ORDER BY
      b.appt_date DESC,
      b.appt_time ASC NULLS LAST,
      b.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'patient_id', p.patient_id,
            'profile_id', p.profile_id,
            'specialty_id', p.specialty_id,
            'slot_id', p.slot_id,
            'status', p.status,
            'note', p.note,
            'walk_in', p.walk_in,
            'cancel_reason', p.cancel_reason,
            'cancelled_at', p.cancelled_at,
            'cancelled_by', p.cancelled_by,
            'created_at', p.created_at,
            'updated_at', p.updated_at,
            'specialty_name', p.specialty_name,
            'specialty_icon', p.specialty_icon,
            'slot_date', p.slot_date,
            'start_time', p.start_time,
            'end_time', p.end_time,
            'doctor_id', p.doctor_id,
            'patient_name', nullif(trim(p.patient_name), ''),
            'patient_phone', p.patient_phone,
            'patient_dob', p.patient_dob,
            'doctor_name', p.doctor_name,
            'pre_consult_status_raw', p.pre_consult_status_raw,
            'pre_consult_flags', p.pre_consult_flags,
            'pre_consult_doctor_exists', p.pre_consult_doctor_id IS NOT NULL,
            'pre_consult_doctor_flags', p.pre_consult_doctor_flags,
            'has_vital_signs', p.has_vital_signs
          )
          ORDER BY p.appt_date DESC, p.appt_time ASC NULLS LAST, p.created_at DESC
        )
        FROM paged p
      ),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;
