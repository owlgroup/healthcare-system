-- FR-021: Check-in & AI Routing — doctor_shifts table
-- Maps doctors to rooms for a given date/time window.
-- Used by the AI routing engine (assign_room RPC) to find eligible rooms.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.doctor_shifts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    uuid        NOT NULL,
  room_id      uuid        NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  shift_date   date        NOT NULL,
  start_time   time        NOT NULL,
  end_time     time        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.doctor_shifts IS
  'Doctor-to-room shift schedule used by AI routing to find eligible rooms (FR-021).';

COMMENT ON COLUMN public.doctor_shifts.doctor_id IS
  'References the doctor''s user_id from user_profiles (auth.users UUID, no FK constraint).';

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_doctor_shifts_doctor_date ON public.doctor_shifts (doctor_id, shift_date);
CREATE INDEX idx_doctor_shifts_room_date   ON public.doctor_shifts (room_id,   shift_date);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.doctor_shifts ENABLE ROW LEVEL SECURITY;

-- Staff (admin, receptionist, doctor, nurse) can read all shifts
CREATE POLICY "doctor_shifts_staff_read" ON public.doctor_shifts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'receptionist', 'doctor', 'nurse')
    )
  );

-- Admin and receptionist can insert shifts
CREATE POLICY "doctor_shifts_admin_receptionist_insert" ON public.doctor_shifts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'receptionist')
    )
  );

-- Admin and receptionist can update shifts
CREATE POLICY "doctor_shifts_admin_receptionist_update" ON public.doctor_shifts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'receptionist')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'receptionist')
    )
  );

-- Admin and receptionist can delete shifts
CREATE POLICY "doctor_shifts_admin_receptionist_delete" ON public.doctor_shifts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'receptionist')
    )
  );
