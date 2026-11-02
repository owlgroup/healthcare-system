-- Pending patient login sessions — DOB verification before issuing JWT (mirrors admin_mfa_sessions)

CREATE TABLE IF NOT EXISTS public.patient_dob_login_sessions (
  dob_token          UUID PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email              TEXT NOT NULL,
  access_token       TEXT NOT NULL,
  refresh_token      TEXT NOT NULL,
  expires_in         INT NOT NULL,
  expires_at         BIGINT,
  token_type         TEXT NOT NULL DEFAULT 'bearer',
  attempts           INT NOT NULL DEFAULT 0,
  expires_session_at TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patient_dob_login_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS patient_dob_login_sessions_email_idx
  ON public.patient_dob_login_sessions (email);

CREATE INDEX IF NOT EXISTS patient_dob_login_sessions_expires_idx
  ON public.patient_dob_login_sessions (expires_session_at);
