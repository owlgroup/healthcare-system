-- Unified patient profile: personal, identity (ID), and insurance (single row per auth user).
-- File binaries live in Storage buckets identity-documents / insurance-cards (see prior migration).

create table public.patient (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,

  -- Identity document (upload path in bucket identity-documents)
  id_document_storage_path text,

  -- Auto-filled / identity fields
  id_number text,
  id_expiration_date date,
  residential_address text,
  id_issued_date date,
  id_issuer text,

  -- Personal information
  legal_first_name text,
  legal_last_name text,
  date_of_birth date,
  phone_number text,
  email_address text,
  preferred_pronouns text,

  -- Insurance
  insurance_provider text,
  member_id text,
  group_number text,
  card_front_storage_path text,
  card_back_storage_path text,

  consent_accepted boolean not null default false,
  submitted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patient is 'Patient onboarding profile (identity + personal + insurance) for the logged-in user.';
comment on column public.patient.id_document_storage_path is 'Path in bucket identity-documents, first folder segment = user uuid.';
comment on column public.patient.card_front_storage_path is 'Path in bucket insurance-cards.';
comment on column public.patient.card_back_storage_path is 'Path in bucket insurance-cards.';

create index patient_user_id_idx on public.patient (user_id);

create trigger patient_set_updated_at
  before update on public.patient
  for each row execute function public.set_updated_at();

alter table public.patient enable row level security;

create policy "Users can read own patient row"
  on public.patient for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own patient row"
  on public.patient for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own patient row"
  on public.patient for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
