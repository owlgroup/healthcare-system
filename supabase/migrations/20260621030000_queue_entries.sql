-- FR-021: Check-in & AI Routing — queue_entries table
-- Central table tracking every patient in the waiting queue.
-- RULE-021f: a patient may have at most 1 active entry (WAITING/CALLED/IN_ROOM)
--            enforced by a partial unique index.

-- ─── Table ────────────────────────────────────────────────────────────────────

create table public.queue_entries (
  id              uuid        primary key default gen_random_uuid(),
  appointment_id  uuid        not null references public.appointments(id) on delete cascade,
  patient_id      uuid        not null,
  profile_id      uuid        not null,
  room_id         uuid        references public.rooms(id) on delete set null,
  doctor_id       uuid,                          -- assigned doctor user_id (no FK — may be null)
  specialty_id    uuid        references public.specialties(id) on delete set null,
  service_type    text        not null default 'GENERAL'
                              check (service_type in ('GENERAL','SPECIALIST','EMERGENCY')),
  token_prefix    char(1)     not null check (token_prefix in ('A','B','C')),
  token_number    int         not null check (token_number >= 1 and token_number <= 999),
  token_full      text        generated always as
                              (token_prefix || lpad(token_number::text, 3, '0')) stored,
  status          text        not null default 'WAITING'
                              check (status in ('WAITING','CALLED','IN_ROOM','DONE','REMOVED')),
  position        int         not null default 0,
  walk_in         bool        not null default false,
  estimated_wait  int,                           -- minutes; null = unknown
  checked_in_at   timestamptz not null default now(),
  called_at       timestamptz,
  in_room_at      timestamptz,
  done_at         timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.queue_entries is
  'Live patient queue for FR-021. One row per check-in. '
  'RULE-021f: at most 1 active entry (WAITING/CALLED/IN_ROOM) per patient at any time.';

comment on column public.queue_entries.token_full is
  'Generated token string, e.g. "A015". Prefix: A=GENERAL, B=SPECIALIST, C=EMERGENCY.';

comment on column public.queue_entries.position is
  'Position within the room queue. Lower = closer to being called.';

comment on column public.queue_entries.estimated_wait is
  'Estimated wait in minutes at time of check-in (queue_count × avg_consult_time). May be null.';

-- ─── RULE-021f: only 1 active entry per patient ───────────────────────────────
-- Partial unique index prevents duplicate active queue entries for the same patient.

create unique index unique_active_patient_queue
  on public.queue_entries (patient_id)
  where status in ('WAITING','CALLED','IN_ROOM');

-- ─── Performance indexes ──────────────────────────────────────────────────────

create index idx_queue_entries_status
  on public.queue_entries (status);

create index idx_queue_entries_room_status
  on public.queue_entries (room_id, status);

create index idx_queue_entries_doctor_status
  on public.queue_entries (doctor_id, status);

create index idx_queue_entries_checkin
  on public.queue_entries (checked_in_at);

create index idx_queue_entries_appointment
  on public.queue_entries (appointment_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.queue_entries enable row level security;

-- 1. Patients see only their own active entries
create policy "queue_patient_read"
  on public.queue_entries for select
  using (patient_id = auth.uid());

-- 2. Staff (admin/receptionist/doctor/nurse) read all entries
create policy "queue_staff_read"
  on public.queue_entries for select
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid()
        and role in ('admin', 'receptionist', 'doctor', 'nurse')
    )
  );

-- 3. Public lobby display: anon reads only active entries (status in WAITING/CALLED/IN_ROOM)
create policy "queue_public_display_read"
  on public.queue_entries for select
  using (status in ('WAITING','CALLED','IN_ROOM'));

-- 4. Staff (admin/receptionist/doctor) can insert queue entries
create policy "queue_staff_insert"
  on public.queue_entries for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid()
        and role in ('admin', 'receptionist', 'doctor')
    )
  );

-- 5. Staff can update entries (doctor marks DONE, admin reassigns room)
create policy "queue_staff_update"
  on public.queue_entries for update
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid()
        and role in ('admin', 'receptionist', 'doctor')
    )
  );
