-- Multiple audio recordings per examination appointment (FR-023 history)

CREATE TABLE IF NOT EXISTS public.consultation_recordings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id      UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  doctor_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_storage_path  TEXT NOT NULL,
  duration_seconds    INTEGER,
  transcript_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consultation_recordings_appt_created_idx
  ON public.consultation_recordings (appointment_id, created_at DESC);

COMMENT ON TABLE public.consultation_recordings IS
  'Historical consultation audio clips for an appointment (multiple per session).';

ALTER TABLE public.consultation_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultation_recordings_doctor_all" ON public.consultation_recordings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role IN ('doctor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

-- Backfill one row per existing voice_session that already has audio
INSERT INTO public.consultation_recordings (
  appointment_id, doctor_id, audio_storage_path, transcript_snapshot, created_at
)
SELECT
  vs.appointment_id,
  vs.doctor_id,
  vs.audio_storage_path,
  vs.transcript_raw,
  vs.created_at
FROM public.voice_sessions vs
WHERE vs.audio_storage_path IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.consultation_recordings cr
    WHERE cr.appointment_id = vs.appointment_id
      AND cr.audio_storage_path = vs.audio_storage_path
  );
