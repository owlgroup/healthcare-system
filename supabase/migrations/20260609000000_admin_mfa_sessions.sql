CREATE TABLE IF NOT EXISTS public.admin_mfa_sessions (
  mfa_token      UUID PRIMARY KEY,
  user_id        UUID NOT NULL,
  email          TEXT NOT NULL,
  portal         TEXT NOT NULL,
  attempts       INT NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ NOT NULL,
  cooldown_until TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_mfa_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_mfa_sessions_email_idx    ON public.admin_mfa_sessions (email);
CREATE INDEX IF NOT EXISTS admin_mfa_sessions_expires_idx  ON public.admin_mfa_sessions (expires_at);
