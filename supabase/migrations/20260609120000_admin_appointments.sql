-- FR-009: Admin Appointment Management
-- Extends appointments table, adds audit log, admin RPCs for walk-in / check-in / cancel / reschedule / bulk-cancel

-- ─── Extend appointments table ───────────────────────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS walk_in        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_reason  TEXT;

-- Walk-ins don't have a pre-booked slot; allow NULL
ALTER TABLE public.appointments
  ALTER COLUMN slot_id       DROP NOT NULL,
  ALTER COLUMN qr_expires_at DROP NOT NULL,
  ALTER COLUMN reminder_at   DROP NOT NULL;

-- ─── Appointments audit log (RULE-009c) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointments_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID NOT NULL REFERENCES public.appointments (id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN (
                    'CREATE_WALKIN','CHECKIN','CANCEL','RESCHEDULE','BULK_CANCEL'
                  )),
  performed_by    UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_status      public.appointment_status,
  new_status      public.appointment_status,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS appt_audit_appt_idx ON public.appointments_audit_log (appointment_id);
CREATE INDEX IF NOT EXISTS appt_audit_at_idx   ON public.appointments_audit_log (performed_at DESC);

ALTER TABLE public.appointments_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appt_audit_admin_read" ON public.appointments_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─── RLS: admin read all appointments & patient profiles ─────────────────────

CREATE POLICY "appointments_admin_all" ON public.appointments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "patient_admin_read" ON public.patient
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can insert patient profiles for walk-in quick-create
CREATE POLICY "patient_admin_insert" ON public.patient
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─── RPC: admin_search_patients ───────────────────────────────────────────────
-- Searches patient table by phone / name / CCCD for walk-in lookup.

CREATE OR REPLACE FUNCTION public.admin_search_patients(
  p_query TEXT
) RETURNS TABLE (
  profile_id   UUID,
  patient_id   UUID,
  patient_name TEXT,
  phone_number TEXT,
  id_number    TEXT,
  date_of_birth DATE,
  submitted_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS profile_id,
    p.user_id AS patient_id,
    TRIM(COALESCE(p.legal_last_name, '') || ' ' || COALESCE(p.legal_first_name, '')) AS patient_name,
    p.phone_number,
    p.id_number,
    p.date_of_birth,
    p.submitted_at
  FROM public.patient p
  WHERE
    p.phone_number ILIKE '%' || p_query || '%'
    OR p.id_number  ILIKE '%' || p_query || '%'
    OR p.legal_first_name ILIKE '%' || p_query || '%'
    OR p.legal_last_name  ILIKE '%' || p_query || '%'
    OR (p.legal_last_name || ' ' || p.legal_first_name) ILIKE '%' || p_query || '%'
  ORDER BY p.legal_last_name, p.legal_first_name
  LIMIT 20;
END;
$$;

-- ─── RPC: admin_insert_patient_profile ───────────────────────────────────────
-- Quick-creates a patient record for a new auth user (walk-in, no existing profile).

CREATE OR REPLACE FUNCTION public.admin_insert_patient_profile(
  p_user_id         UUID,
  p_legal_first_name TEXT,
  p_legal_last_name  TEXT,
  p_phone_number     TEXT DEFAULT NULL,
  p_date_of_birth    DATE DEFAULT NULL,
  p_id_number        TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.patient (
    user_id, legal_first_name, legal_last_name,
    phone_number, date_of_birth, id_number,
    submitted_at
  ) VALUES (
    p_user_id, p_legal_first_name, p_legal_last_name,
    p_phone_number, p_date_of_birth, p_id_number,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET legal_first_name = EXCLUDED.legal_first_name,
        legal_last_name  = EXCLUDED.legal_last_name,
        phone_number     = COALESCE(EXCLUDED.phone_number, public.patient.phone_number),
        date_of_birth    = COALESCE(EXCLUDED.date_of_birth, public.patient.date_of_birth),
        id_number        = COALESCE(EXCLUDED.id_number, public.patient.id_number),
        submitted_at     = COALESCE(public.patient.submitted_at, NOW())
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

-- ─── RPC: admin_create_walkin ─────────────────────────────────────────────────
-- RULE-009a: Walk-in auto CONFIRMED, no slot required.

CREATE OR REPLACE FUNCTION public.admin_create_walkin(
  p_profile_id   UUID,
  p_specialty_id UUID,
  p_note         TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_id   UUID;
  v_patient_id UUID;
  v_appt_id    UUID;
BEGIN
  v_admin_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  -- Resolve patient's auth user id from profile
  SELECT user_id INTO v_patient_id FROM public.patient WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  -- Create appointment (CONFIRMED, no slot, walk_in = true)
  INSERT INTO public.appointments (
    patient_id, profile_id, specialty_id,
    status, note, walk_in,
    qr_expires_at, reminder_at
  ) VALUES (
    v_patient_id, p_profile_id, p_specialty_id,
    'CONFIRMED', p_note, TRUE,
    (CURRENT_DATE::text || ' 23:59:59')::TIMESTAMPTZ,
    NULL
  )
  RETURNING id INTO v_appt_id;

  -- Audit log
  INSERT INTO public.appointments_audit_log (appointment_id, action, performed_by, new_status, notes)
  VALUES (v_appt_id, 'CREATE_WALKIN', v_admin_id, 'CONFIRMED', p_note);

  RETURN v_appt_id;
END;
$$;

-- ─── RPC: admin_checkin_appointment ───────────────────────────────────────────
-- Transitions CONFIRMED → CHECKED_IN (RULE-009c: audit log).

CREATE OR REPLACE FUNCTION public.admin_checkin_appointment(
  p_appointment_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_id  UUID;
  v_old_status public.appointment_status;
BEGIN
  v_admin_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  SELECT status INTO v_old_status
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0007';
  END IF;

  IF v_old_status != 'CONFIRMED' THEN
    RAISE EXCEPTION 'CANNOT_CHECKIN' USING errcode = 'P0011';
  END IF;

  UPDATE public.appointments
  SET status = 'CHECKED_IN'
  WHERE id = p_appointment_id;

  INSERT INTO public.appointments_audit_log (appointment_id, action, performed_by, old_status, new_status)
  VALUES (p_appointment_id, 'CHECKIN', v_admin_id, v_old_status, 'CHECKED_IN');
END;
$$;

-- ─── RPC: admin_cancel_appointment ────────────────────────────────────────────
-- RULE-009b: reason ≥ 5 chars required. Frees slot. Audit log.

CREATE OR REPLACE FUNCTION public.admin_cancel_appointment(
  p_appointment_id UUID,
  p_reason         TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_id   UUID;
  v_old_status public.appointment_status;
  v_slot_id    UUID;
BEGIN
  v_admin_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'REASON_TOO_SHORT' USING errcode = 'P0012';
  END IF;

  SELECT status, slot_id INTO v_old_status, v_slot_id
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0007';
  END IF;

  IF v_old_status IN ('CANCELLED', 'COMPLETED') THEN
    RAISE EXCEPTION 'CANNOT_CANCEL' USING errcode = 'P0008';
  END IF;

  UPDATE public.appointments
  SET
    status        = 'CANCELLED',
    cancel_reason = p_reason,
    cancelled_at  = NOW(),
    cancelled_by  = 'admin'
  WHERE id = p_appointment_id;

  -- Free the slot if this appointment had one
  IF v_slot_id IS NOT NULL THEN
    UPDATE public.appointment_slots SET is_available = TRUE WHERE id = v_slot_id;
  END IF;

  INSERT INTO public.appointments_audit_log (appointment_id, action, performed_by, old_status, new_status, notes)
  VALUES (p_appointment_id, 'CANCEL', v_admin_id, v_old_status, 'CANCELLED', p_reason);
END;
$$;

-- ─── RPC: admin_reschedule_appointment ────────────────────────────────────────
-- AF-2: Change to a different available slot. Validates slot is free.

CREATE OR REPLACE FUNCTION public.admin_reschedule_appointment(
  p_appointment_id UUID,
  p_new_slot_id    UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_id     UUID;
  v_old_status   public.appointment_status;
  v_old_slot_id  UUID;
  v_slot_date    DATE;
  v_start_time   TIME;
BEGIN
  v_admin_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  SELECT status, slot_id INTO v_old_status, v_old_slot_id
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0007';
  END IF;

  IF v_old_status NOT IN ('CONFIRMED', 'CHECKED_IN') THEN
    RAISE EXCEPTION 'CANNOT_RESCHEDULE' USING errcode = 'P0013';
  END IF;

  -- Lock new slot
  SELECT slot_date, start_time INTO v_slot_date, v_start_time
  FROM public.appointment_slots
  WHERE id = p_new_slot_id AND is_available = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING errcode = 'P0004';
  END IF;

  IF (v_slot_date + v_start_time)::TIMESTAMPTZ <= NOW() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING errcode = 'P0005';
  END IF;

  -- Free old slot
  IF v_old_slot_id IS NOT NULL AND v_old_slot_id != p_new_slot_id THEN
    UPDATE public.appointment_slots SET is_available = TRUE WHERE id = v_old_slot_id;
  END IF;

  -- Book new slot
  UPDATE public.appointment_slots SET is_available = FALSE WHERE id = p_new_slot_id;

  -- Update appointment
  UPDATE public.appointments
  SET
    slot_id       = p_new_slot_id,
    status        = 'CONFIRMED',
    qr_expires_at = (v_slot_date::TEXT || ' 23:59:59')::TIMESTAMPTZ,
    reminder_at   = (v_slot_date + v_start_time)::TIMESTAMPTZ - INTERVAL '24 hours'
  WHERE id = p_appointment_id;

  INSERT INTO public.appointments_audit_log (
    appointment_id, action, performed_by, old_status, new_status,
    notes
  )
  VALUES (
    p_appointment_id, 'RESCHEDULE', v_admin_id, v_old_status, 'CONFIRMED',
    'New slot: ' || v_slot_date::TEXT || ' ' || v_start_time::TEXT
  );
END;
$$;

-- ─── RPC: admin_bulk_cancel ───────────────────────────────────────────────────
-- AF-3: Cancel multiple appointments (e.g. doctor absence). RULE-009d: needs confirm N.

CREATE OR REPLACE FUNCTION public.admin_bulk_cancel(
  p_appointment_ids UUID[],
  p_reason          TEXT
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_id  UUID;
  v_appt_id   UUID;
  v_slot_id   UUID;
  v_old_status public.appointment_status;
  v_cancelled INT := 0;
BEGIN
  v_admin_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'REASON_TOO_SHORT' USING errcode = 'P0012';
  END IF;

  FOREACH v_appt_id IN ARRAY p_appointment_ids LOOP
    SELECT status, slot_id INTO v_old_status, v_slot_id
    FROM public.appointments
    WHERE id = v_appt_id AND status NOT IN ('CANCELLED','COMPLETED')
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    UPDATE public.appointments
    SET
      status        = 'CANCELLED',
      cancel_reason = p_reason,
      cancelled_at  = NOW(),
      cancelled_by  = 'admin'
    WHERE id = v_appt_id;

    IF v_slot_id IS NOT NULL THEN
      UPDATE public.appointment_slots SET is_available = TRUE WHERE id = v_slot_id;
    END IF;

    INSERT INTO public.appointments_audit_log (appointment_id, action, performed_by, old_status, new_status, notes)
    VALUES (v_appt_id, 'BULK_CANCEL', v_admin_id, v_old_status, 'CANCELLED', p_reason);

    v_cancelled := v_cancelled + 1;
  END LOOP;

  RETURN v_cancelled;
END;
$$;

-- ─── RPC: admin_get_appointments ──────────────────────────────────────────────
-- Returns appointments with joined specialty, slot, patient, doctor for admin views.

CREATE OR REPLACE FUNCTION public.admin_get_appointments(
  p_date         DATE    DEFAULT NULL,
  p_specialty_id UUID    DEFAULT NULL,
  p_status       TEXT    DEFAULT NULL,
  p_doctor_id    UUID    DEFAULT NULL,
  p_search       TEXT    DEFAULT NULL
) RETURNS TABLE (
  id              UUID,
  patient_id      UUID,
  profile_id      UUID,
  specialty_id    UUID,
  slot_id         UUID,
  status          public.appointment_status,
  note            TEXT,
  walk_in         BOOLEAN,
  cancel_reason   TEXT,
  cancelled_at    TIMESTAMPTZ,
  cancelled_by    TEXT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  specialty_name  TEXT,
  specialty_icon  TEXT,
  slot_date       DATE,
  start_time      TIME,
  end_time        TIME,
  doctor_id       UUID,
  patient_name    TEXT,
  patient_phone   TEXT,
  patient_dob     DATE,
  doctor_name     TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.patient_id,
    a.profile_id,
    a.specialty_id,
    a.slot_id,
    a.status,
    a.note,
    a.walk_in,
    a.cancel_reason,
    a.cancelled_at,
    a.cancelled_by,
    a.created_at,
    a.updated_at,
    sp.name                                                       AS specialty_name,
    sp.icon                                                       AS specialty_icon,
    sl.slot_date,
    sl.start_time,
    sl.end_time,
    sl.doctor_id,
    TRIM(COALESCE(pt.legal_last_name,'') || ' ' || COALESCE(pt.legal_first_name,'')) AS patient_name,
    pt.phone_number                                               AS patient_phone,
    pt.date_of_birth                                              AS patient_dob,
    up_doc.full_name                                              AS doctor_name
  FROM public.appointments a
  LEFT JOIN public.specialties         sp     ON sp.id       = a.specialty_id
  LEFT JOIN public.appointment_slots   sl     ON sl.id       = a.slot_id
  LEFT JOIN public.patient             pt     ON pt.id       = a.profile_id
  LEFT JOIN public.user_profiles       up_doc ON up_doc.user_id = sl.doctor_id
  WHERE
    -- Date filter: slot_date for booked, created_at::date for walk-ins
    (p_date IS NULL
      OR sl.slot_date = p_date
      OR (a.walk_in = TRUE AND a.slot_id IS NULL AND a.created_at::DATE = p_date)
    )
    AND (p_specialty_id IS NULL OR a.specialty_id = p_specialty_id)
    AND (p_status IS NULL OR a.status = p_status::public.appointment_status)
    AND (p_doctor_id IS NULL OR sl.doctor_id = p_doctor_id)
    AND (
      p_search IS NULL
      OR pt.phone_number   ILIKE '%' || p_search || '%'
      OR pt.legal_first_name ILIKE '%' || p_search || '%'
      OR pt.legal_last_name  ILIKE '%' || p_search || '%'
      OR pt.id_number       ILIKE '%' || p_search || '%'
    )
  ORDER BY
    COALESCE(sl.slot_date, a.created_at::DATE) DESC,
    COALESCE(sl.start_time, a.created_at::TIME) ASC,
    a.created_at DESC;
END;
$$;

-- ─── Seed appointment permissions ────────────────────────────────────────────

INSERT INTO public.permissions (slug, name, category) VALUES
  ('appointments.read',   'Xem lịch hẹn',          'appointments'),
  ('appointments.write',  'Tạo / Sửa lịch hẹn',    'appointments'),
  ('appointments.cancel', 'Hủy lịch hẹn',           'appointments')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'admin'
  AND p.slug LIKE 'appointments.%'
ON CONFLICT DO NOTHING;
