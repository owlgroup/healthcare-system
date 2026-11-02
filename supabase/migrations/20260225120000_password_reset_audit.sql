-- FR-003: password history (last 3) + audit logs

CREATE TABLE IF NOT EXISTS public.password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_created
  ON public.password_history (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  email TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_created
  ON public.audit_logs (event_type, created_at DESC);

ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- service_role only (edge functions)
CREATE POLICY password_history_service ON public.password_history
  FOR ALL
  USING (auth.role () = 'service_role')
  WITH CHECK (auth.role () = 'service_role');

CREATE POLICY audit_logs_service ON public.audit_logs
  FOR ALL
  USING (auth.role () = 'service_role')
  WITH CHECK (auth.role () = 'service_role');
