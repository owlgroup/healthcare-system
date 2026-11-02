-- Patient onboarding: Personal & Identity + Insurance (matches Qcare Plus onboarding UI)
-- Storage paths point to objects under buckets identity-documents / insurance-cards (folder per user_id).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.patient_identity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,

  -- Identity / OCR fields
  id_number text,
  id_expiration_date date,
  residential_address text,
  id_issued_date date,
  id_issuer text,
  id_document_storage_path text,

  -- Personal information
  legal_first_name text,
  legal_last_name text,
  date_of_birth date,
  phone_number text,
  email_address text,
  preferred_pronouns text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patient_identity is 'Personal & Identity onboarding step (government ID + profile fields).';
comment on column public.patient_identity.id_document_storage_path is 'Supabase Storage path in bucket identity-documents, e.g. {user_id}/id_front_<timestamp>.pdf';

create table public.patient_insurance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,

  insurance_provider text,
  member_id text,
  group_number text,
  card_front_storage_path text,
  card_back_storage_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patient_insurance is 'Insurance onboarding step (coverage + card uploads).';
comment on column public.patient_insurance.card_front_storage_path is 'Supabase Storage path in bucket insurance-cards.';
comment on column public.patient_insurance.card_back_storage_path is 'Supabase Storage path in bucket insurance-cards.';

create index patient_identity_user_id_idx on public.patient_identity (user_id);
create index patient_insurance_user_id_idx on public.patient_insurance (user_id);

-- Keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger patient_identity_set_updated_at
  before update on public.patient_identity
  for each row execute function public.set_updated_at();

create trigger patient_insurance_set_updated_at
  before update on public.patient_insurance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.patient_identity enable row level security;
alter table public.patient_insurance enable row level security;

create policy "Users can read own patient_identity"
  on public.patient_identity for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own patient_identity"
  on public.patient_identity for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own patient_identity"
  on public.patient_identity for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own patient_insurance"
  on public.patient_insurance for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own patient_insurance"
  on public.patient_insurance for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own patient_insurance"
  on public.patient_insurance for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage buckets (private PHI / insurance uploads)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'identity-documents',
    'identity-documents',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'application/pdf']::text[]
  ),
  (
    'insurance-cards',
    'insurance-cards',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'application/pdf']::text[]
  )
on conflict (id) do nothing;

-- Objects live under folder named with auth.uid() as first segment
create policy "identity_documents_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "identity_documents_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "identity_documents_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "identity_documents_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "insurance_cards_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'insurance-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "insurance_cards_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'insurance-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "insurance_cards_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'insurance-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "insurance_cards_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'insurance-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
