-- ---------------------------------------------------------------------------
-- Doctor notifications: persisted table + trigger + RLS + realtime
-- ---------------------------------------------------------------------------

-- 1. Table
create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  recipient_user_id   uuid not null references auth.users (id) on delete cascade,
  appointment_id      uuid references public.appointments (id) on delete cascade,
  patient_name        text,
  specialty_name      text,
  slot_date           date,
  slot_time           time,
  walk_in             boolean not null default false,
  read                boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_user_id, created_at desc);
create index if not exists notifications_appt_idx      on public.notifications (appointment_id);

-- 2. RLS: doctors can only see their own notifications
alter table public.notifications enable row level security;

create policy "notifications_own_select"
  on public.notifications for select
  using (recipient_user_id = auth.uid());

create policy "notifications_own_update"
  on public.notifications for update
  using (recipient_user_id = auth.uid());

-- Service-role / trigger can insert (no auth context inside trigger)
create policy "notifications_service_insert"
  on public.notifications for insert
  with check (true);

-- 3. Trigger function: fires after each appointment INSERT
create or replace function public.notify_doctor_on_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id     uuid;
  v_slot_date     date;
  v_start_time    time;
  v_patient_name  text;
  v_specialty_name text;
begin
  -- Walk-in appointments have no slot; skip if no slot
  if new.slot_id is null then
    return new;
  end if;

  -- Resolve doctor + slot time from appointment_slots
  select s.doctor_id, s.slot_date, s.start_time
    into v_doctor_id, v_slot_date, v_start_time
    from public.appointment_slots s
   where s.id = new.slot_id;

  if v_doctor_id is null then
    return new;
  end if;

  -- Patient name from profile
  select coalesce(trim(legal_last_name || ' ' || legal_first_name), full_name)
    into v_patient_name
    from public.patient
   where id = new.profile_id;

  -- Specialty name
  select name into v_specialty_name
    from public.specialties
   where id = new.specialty_id;

  insert into public.notifications
    (recipient_user_id, appointment_id, patient_name, specialty_name, slot_date, slot_time, walk_in)
  values
    (v_doctor_id, new.id, v_patient_name, v_specialty_name, v_slot_date, v_start_time, coalesce(new.walk_in, false));

  return new;
end;
$$;

drop trigger if exists trg_notify_doctor_on_appointment on public.appointments;
create trigger trg_notify_doctor_on_appointment
  after insert on public.appointments
  for each row execute function public.notify_doctor_on_appointment();

-- 4. Enable Realtime on notifications table
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
