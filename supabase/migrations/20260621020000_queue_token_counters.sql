-- FR-021: Check-in & AI Routing — queue_token_counters table
-- Atomic counter backing the token assignment system.
-- RULE-021a: counters reset daily (counter_date tracks the current day;
-- get_next_token() resets last_number to 0 whenever counter_date ≠ today).
-- Direct client access is intentionally blocked via RLS; updates are only
-- performed through SECURITY DEFINER RPCs (get_next_token).

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.queue_token_counters (
  prefix         char(1)  PRIMARY KEY CHECK (prefix IN ('A', 'B', 'C')),
  counter_date   date     NOT NULL DEFAULT CURRENT_DATE,
  last_number    int      NOT NULL DEFAULT 0
                          CHECK (last_number >= 0 AND last_number <= 999)
);

COMMENT ON TABLE public.queue_token_counters IS
  'Atomic per-prefix token counter for the queue system (FR-021). '
  'One row per service-type prefix (A=GENERAL, B=SPECIALIST, C=EMERGENCY). '
  'RULE-021a: last_number resets to 0 each day when get_next_token() detects counter_date ≠ today.';

COMMENT ON COLUMN public.queue_token_counters.prefix IS
  'Single-character token prefix: A=GENERAL, B=SPECIALIST, C=EMERGENCY.';

COMMENT ON COLUMN public.queue_token_counters.counter_date IS
  'The date for which last_number is valid. Compared against CURRENT_DATE in get_next_token() to trigger daily reset.';

COMMENT ON COLUMN public.queue_token_counters.last_number IS
  'Last issued token number for today (0–999). Incremented atomically via SELECT … FOR UPDATE in get_next_token().';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.queue_token_counters ENABLE ROW LEVEL SECURITY;

-- No direct client read or write; all access goes through SECURITY DEFINER RPCs.
-- service_role bypasses RLS by default (Supabase behaviour) and is used by RPCs.

-- ─── Seed rows ────────────────────────────────────────────────────────────────

INSERT INTO public.queue_token_counters (prefix)
VALUES ('A'), ('B'), ('C')
ON CONFLICT DO NOTHING;
