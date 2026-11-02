-- FR-012: Clinical Questionnaire Management (Admin) — standalone module
-- Only category_id references the existing shared question_categories table.

-- ─── Questionnaires ───────────────────────────────────────────────────────────

create table if not exists public.questionnaires (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  category_id          uuid references public.question_categories (id) on delete set null,
  description          text,
  status               text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  version              integer not null default 1,
  parent_id            uuid references public.questionnaires (id) on delete set null,
  intervention_matrix  jsonb not null default '[]'::jsonb,
  scoring_config       jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.questionnaires is
  'Clinical questionnaire definitions (PHQ-8, AUDIT-C, PHA DD3024…) — FR-012.';

create index if not exists questionnaires_category_idx on public.questionnaires (category_id);
create index if not exists questionnaires_parent_idx on public.questionnaires (parent_id);
create index if not exists questionnaires_status_idx on public.questionnaires (status);

create trigger questionnaires_set_updated_at
  before update on public.questionnaires
  for each row execute function public.set_updated_at();

-- ─── Sections ─────────────────────────────────────────────────────────────────

create table if not exists public.questionnaire_sections (
  id               uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires (id) on delete cascade,
  key              text not null,
  role             text not null default 'PATIENT' check (role in ('PATIENT', 'NURSE', 'DOCTOR')),
  title            text not null,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists qsections_questionnaire_idx on public.questionnaire_sections (questionnaire_id);

create trigger questionnaire_sections_set_updated_at
  before update on public.questionnaire_sections
  for each row execute function public.set_updated_at();

-- ─── Questions ────────────────────────────────────────────────────────────────

create table if not exists public.questionnaire_questions (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.questionnaire_sections (id) on delete cascade,
  type        text not null check (type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT', 'NUMBER', 'SCALE', 'GRID_MATRIX')),
  text        text not null,
  sort_order  integer not null default 0,
  options     jsonb not null default '[]'::jsonb,
  config      jsonb not null default '{}'::jsonb,
  skip_logic  jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists qquestions_section_idx on public.questionnaire_questions (section_id);

create trigger questionnaire_questions_set_updated_at
  before update on public.questionnaire_questions
  for each row execute function public.set_updated_at();

-- ─── Responses (minimal stub — backs the RULE-012b "has responses" guard) ────
-- NOTE: Migration 20260620300000_questionnaire_assignments.sql drops this stub
-- and recreates the table with the full FR-013 schema.

create table if not exists public.questionnaire_responses (
  id               uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires (id) on delete cascade,
  created_at       timestamptz not null default now()
);

create index if not exists qresponses_questionnaire_idx on public.questionnaire_responses (questionnaire_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.questionnaires enable row level security;
alter table public.questionnaire_sections enable row level security;
alter table public.questionnaire_questions enable row level security;
alter table public.questionnaire_responses enable row level security;

create policy "questionnaires_admin_write" on public.questionnaires
  for all
  using (exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin'));

create policy "questionnaire_sections_admin_write" on public.questionnaire_sections
  for all
  using (exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin'));

create policy "questionnaire_questions_admin_write" on public.questionnaire_questions
  for all
  using (exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin'));

create policy "questionnaire_responses_admin_read" on public.questionnaire_responses
  for select
  using (exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin'));

-- RULE-012a (future): expose ACTIVE questionnaires to patient/staff once a
-- consumer flow exists, e.g.:
-- create policy "questionnaires_active_read" on public.questionnaires
--   for select using (status = 'ACTIVE');

-- ─── Permission slugs (menu-gating parity with master_data.*) ────────────────

insert into public.permissions (slug, name, category) values
  ('questionnaire.read',    'Xem Bộ câu hỏi lâm sàng', 'questionnaire'),
  ('questionnaire.write',   'Tạo / Sửa Bộ câu hỏi lâm sàng', 'questionnaire'),
  ('questionnaire.publish', 'Phát hành Bộ câu hỏi lâm sàng', 'questionnaire')
on conflict (slug) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.slug = 'admin' and p.slug like 'questionnaire.%'
on conflict do nothing;
