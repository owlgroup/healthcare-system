-- Pending registrations (pre-auth signup tracking)
create table if not exists public.pending_registrations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.pending_registrations is 'Emails in active signup flow before auth.users row exists.';

alter table public.pending_registrations enable row level security;

-- No policies: only service_role (Edge Functions) can access via admin client
