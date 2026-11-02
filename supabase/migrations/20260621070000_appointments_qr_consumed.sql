-- FR-021: Check-in & AI Routing — qr_token_consumed column
-- Marks a QR token as used after a successful check-in.
-- RULE-021c: QR token is single-use; once consumed it cannot be used again.

-- ─── Add column ───────────────────────────────────────────────────────────────

alter table public.appointments
  add column if not exists qr_token_consumed boolean not null default false;

comment on column public.appointments.qr_token_consumed is
  'True after the QR token has been successfully used for check-in (FR-021). '
  'Enforces single-use per RULE-021c. Set atomically inside perform_checkin() RPC.';

-- ─── Index ────────────────────────────────────────────────────────────────────
-- Helps perform_checkin() quickly find appointments with unconsumed tokens.

create index if not exists appt_qr_consumed_idx
  on public.appointments (qr_token_consumed)
  where qr_token_consumed = false;
