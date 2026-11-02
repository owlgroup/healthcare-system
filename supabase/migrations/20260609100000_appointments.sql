-- FR-008: Patient appointment booking
-- Tables: specialties, appointment_slots, appointments
-- RPC: book_appointment (race-condition safe via SELECT FOR UPDATE)

-- ─── Specialties (master data) ──────────────────────────────────────────────

create table public.specialties (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.specialties is 'Medical specialties available for booking.';

insert into public.specialties (name, description, icon) values
  ('Tim mạch',        'Khám và điều trị bệnh tim mạch',          'heart-pulse'),
  ('Nội tổng quát',   'Khám nội khoa tổng quát',                 'stethoscope'),
  ('Nhi khoa',        'Khám và điều trị trẻ em',                 'baby'),
  ('Da liễu',         'Khám và điều trị bệnh da liễu',           'shield'),
  ('Thần kinh',       'Khám và điều trị bệnh thần kinh',         'brain'),
  ('Cơ xương khớp',   'Khám và điều trị bệnh xương khớp',        'bone'),
  ('Tai Mũi Họng',    'Khám tai mũi họng',                       'ear'),
  ('Mắt',             'Khám và điều trị bệnh về mắt',            'eye');

-- ─── Appointment slots ───────────────────────────────────────────────────────

create table public.appointment_slots (
  id           uuid primary key default gen_random_uuid(),
  specialty_id uuid not null references public.specialties (id) on delete cascade,
  slot_date    date not null,
  start_time   time not null,
  end_time     time not null,
  is_available boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (specialty_id, slot_date, start_time)
);

comment on table public.appointment_slots is 'Available time slots per specialty per date. Locked on booking.';

create index appt_slots_specialty_date_idx on public.appointment_slots (specialty_id, slot_date, is_available);

-- ─── Appointments ────────────────────────────────────────────────────────────

create type public.appointment_status as enum (
  'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
);

create table public.appointments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references auth.users (id) on delete cascade,
  profile_id      uuid not null references public.patient (id) on delete restrict,
  specialty_id    uuid not null references public.specialties (id) on delete restrict,
  slot_id         uuid not null references public.appointment_slots (id) on delete restrict,
  status          public.appointment_status not null default 'CONFIRMED',
  note            text,
  qr_token        uuid not null default gen_random_uuid(),
  qr_expires_at   timestamptz not null,     -- 23:59 on the appointment date
  reminder_at     timestamptz not null,     -- slot start - 24h
  reminder_sent   boolean not null default false,
  cancelled_at    timestamptz,
  cancelled_by    text,                     -- 'patient' | 'admin'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.appointments is 'Patient appointments. Created with CONFIRMED status. qr_token used for check-in (FR-021).';
comment on column public.appointments.qr_token is 'One-time QR token for check-in. TTL = 23:59 on appointment date.';

create index appt_patient_idx     on public.appointments (patient_id, status);
create index appt_slot_idx        on public.appointments (slot_id);
create index appt_reminder_idx    on public.appointments (reminder_at) where reminder_sent = false;
create index appt_qr_token_idx    on public.appointments (qr_token);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ─── Helper: ensure slots exist for a specialty+date ────────────────────────
-- Generates Mon-Sat slots: 08:00-11:30 (30-min intervals) + 14:00-16:30
-- Called before fetching available slots so the calendar always has data.

create or replace function public.ensure_slots_exist(
  p_specialty_id uuid,
  p_date         date
) returns void language plpgsql security definer as $$
declare
  v_dow       int;
  v_time      time;
  slot_times  time[] := array[
    '08:00','08:30','09:00','09:30','10:00','10:30','11:00',
    '14:00','14:30','15:00','15:30','16:00'
  ];
  t           time;
begin
  v_dow := extract(dow from p_date); -- 0=Sun, 6=Sat
  if v_dow = 0 then return; end if;  -- No slots on Sunday

  foreach t in array slot_times loop
    insert into public.appointment_slots (specialty_id, slot_date, start_time, end_time)
    values (p_specialty_id, p_date, t, t + interval '30 minutes')
    on conflict (specialty_id, slot_date, start_time) do nothing;
  end loop;
end;
$$;

-- ─── RPC: book_appointment ───────────────────────────────────────────────────
-- Race-condition safe: SELECT ... FOR UPDATE on the slot row.
-- Returns the created appointment id, or raises an exception.

create or replace function public.book_appointment(
  p_profile_id    uuid,
  p_specialty_id  uuid,
  p_slot_id       uuid,
  p_note          text default null
) returns uuid language plpgsql security definer as $$
declare
  v_patient_id   uuid;
  v_slot_date    date;
  v_start_time   time;
  v_session_start time;
  v_session_end   time;
  v_appt_id      uuid;
  v_qr_expires   timestamptz;
  v_reminder_at  timestamptz;
  v_conflict_count int;
  v_profile_submitted timestamptz;
begin
  -- Identify calling user
  v_patient_id := auth.uid();
  if v_patient_id is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  -- RULE-008f: profile must be ACTIVE (submitted)
  select submitted_at into v_profile_submitted
  from public.patient
  where id = p_profile_id and user_id = v_patient_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_profile_submitted is null then
    raise exception 'PROFILE_UNVERIFIED' using errcode = 'P0003';
  end if;

  -- Lock the slot (SELECT FOR UPDATE) to prevent race condition
  select slot_date, start_time
  into v_slot_date, v_start_time
  from public.appointment_slots
  where id = p_slot_id
    and specialty_id = p_specialty_id
    and is_available = true
  for update;

  if not found then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0004';
  end if;

  -- Slot must be in the future
  if (v_slot_date + v_start_time)::timestamptz <= now() then
    raise exception 'SLOT_IN_PAST' using errcode = 'P0005';
  end if;

  -- RULE-008a: no two appointments in the same session (morning 06-12 / afternoon 12-18)
  if v_start_time < '12:00' then
    v_session_start := '06:00';
    v_session_end   := '12:00';
  else
    v_session_start := '12:00';
    v_session_end   := '18:00';
  end if;

  select count(*) into v_conflict_count
  from public.appointments a
  join public.appointment_slots s on s.id = a.slot_id
  where a.patient_id = v_patient_id
    and a.profile_id = p_profile_id
    and s.slot_date = v_slot_date
    and s.start_time >= v_session_start
    and s.start_time < v_session_end
    and a.status not in ('CANCELLED', 'NO_SHOW');

  if v_conflict_count > 0 then
    raise exception 'DUPLICATE_SESSION' using errcode = 'P0006';
  end if;

  -- Mark slot as taken
  update public.appointment_slots set is_available = false where id = p_slot_id;

  -- Compute derived timestamps
  v_qr_expires  := (v_slot_date::text || ' 23:59:59')::timestamptz;
  v_reminder_at := (v_slot_date + v_start_time)::timestamptz - interval '24 hours';

  -- Create appointment (CONFIRMED, RULE-008c)
  insert into public.appointments (
    patient_id, profile_id, specialty_id, slot_id,
    status, note, qr_expires_at, reminder_at
  ) values (
    v_patient_id, p_profile_id, p_specialty_id, p_slot_id,
    'CONFIRMED', p_note, v_qr_expires, v_reminder_at
  )
  returning id into v_appt_id;

  return v_appt_id;
end;
$$;

-- ─── RPC: cancel_appointment ─────────────────────────────────────────────────
-- RULE-008b: patient may only cancel ≥ 2h before slot start.

create or replace function public.cancel_appointment(
  p_appointment_id uuid
) returns void language plpgsql security definer as $$
declare
  v_patient_id  uuid;
  v_slot_id     uuid;
  v_slot_date   date;
  v_start_time  time;
  v_status      public.appointment_status;
  v_apt_time    timestamptz;
begin
  v_patient_id := auth.uid();

  select a.slot_id, a.status, s.slot_date, s.start_time
  into v_slot_id, v_status, v_slot_date, v_start_time
  from public.appointments a
  join public.appointment_slots s on s.id = a.slot_id
  where a.id = p_appointment_id
    and a.patient_id = v_patient_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0007';
  end if;

  if v_status not in ('CONFIRMED') then
    raise exception 'CANNOT_CANCEL' using errcode = 'P0008';
  end if;

  v_apt_time := (v_slot_date + v_start_time)::timestamptz;

  -- RULE-008b: must be ≥ 2h before
  if now() >= (v_apt_time - interval '2 hours') then
    raise exception 'TOO_LATE_TO_CANCEL' using errcode = 'P0009';
  end if;

  update public.appointments
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by = 'patient'
  where id = p_appointment_id;

  -- Free the slot
  update public.appointment_slots set is_available = true where id = v_slot_id;
end;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.specialties      enable row level security;
alter table public.appointment_slots enable row level security;
alter table public.appointments     enable row level security;

-- Specialties: public read
create policy "specialties_public_read"
  on public.specialties for select using (is_active = true);

-- Slots: public read
create policy "slots_public_read"
  on public.appointment_slots for select using (true);

-- Appointments: patients see only their own
create policy "appointments_own_read"
  on public.appointments for select
  using (patient_id = auth.uid());

-- Insert/update via RPC only (security definer functions bypass RLS)
