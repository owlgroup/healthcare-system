-- FR-019: Master Data Core CRUD
-- Entities: Services, extended Facilities, Rooms, Doctor Schedules (RRULE),
--           Question Categories, ICD-10 stub, Audit Log
-- AC3: nightly slot-generation function (pg_cron target)
-- AC4: soft-delete only (is_active = false)
-- AC5: audit trigger on every master-data table
-- AC6: master_data.* permissions seeded here

-- ─── Extend existing facilities table ───────────────────────────────────────

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS phone       text,
  ADD COLUMN IF NOT EXISTS is_active   boolean not null default true,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz not null default now();

-- ─── Services (Dịch vụ khám) ────────────────────────────────────────────────

create table if not exists public.services (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  description          text,
  specialty_id         uuid references public.specialties (id) on delete restrict,
  price_vnd            numeric(12,0),
  duration_minutes     integer not null default 30,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.services is 'Medical services offered (khám tổng quát, chuyên sâu, VIP…).';

create index if not exists services_specialty_idx on public.services (specialty_id);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- ─── Rooms (Phòng khám) ──────────────────────────────────────────────────────

create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities (id) on delete restrict,
  name         text not null,
  room_number  text,
  capacity     integer not null default 1,
  equipment    text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (facility_id, room_number)
);

comment on table public.rooms is 'Examination rooms within a facility.';

create index if not exists rooms_facility_idx on public.rooms (facility_id);

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- ─── Doctor schedules (Lịch làm việc bác sĩ) ────────────────────────────────
-- work_days: integer[] using ISO dow — 0=Sun, 1=Mon … 6=Sat
-- exceptions: jsonb array of "YYYY-MM-DD" date strings

create table if not exists public.doctor_schedules (
  id                    uuid primary key default gen_random_uuid(),
  doctor_id             uuid not null references public.user_profiles (user_id) on delete cascade,
  specialty_id          uuid not null references public.specialties (id) on delete restrict,
  facility_id           uuid not null references public.facilities (id) on delete restrict,
  room_id               uuid references public.rooms (id) on delete set null,
  work_days             integer[] not null,               -- e.g. {1,2,3,4,5}
  work_start_time       time not null default '08:00',
  work_end_time         time not null default '17:00',
  slot_duration_minutes integer not null default 30,
  exceptions            jsonb not null default '[]'::jsonb,  -- ["2026-01-01"]
  valid_from            date not null default current_date,
  valid_until           date,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint ck_valid_days check (
    array_length(work_days, 1) > 0
    and work_days <@ array[0,1,2,3,4,5,6]
  ),
  constraint ck_times check (work_start_time < work_end_time)
);

comment on table public.doctor_schedules is
  'RRULE-style weekly work schedule per doctor. work_days uses ISO dow (0=Sun).';
comment on column public.doctor_schedules.exceptions is
  'JSON array of "YYYY-MM-DD" strings — dates excluded from the regular schedule.';

create index if not exists ds_doctor_idx   on public.doctor_schedules (doctor_id);
create index if not exists ds_specialty_idx on public.doctor_schedules (specialty_id);

create trigger doctor_schedules_set_updated_at
  before update on public.doctor_schedules
  for each row execute function public.set_updated_at();

-- ─── Extend appointment_slots with doctor & room context ────────────────────

alter table public.appointment_slots
  add column if not exists doctor_id    uuid references public.user_profiles (user_id) on delete set null,
  add column if not exists facility_id  uuid references public.facilities (id) on delete set null,
  add column if not exists room_id      uuid references public.rooms (id) on delete set null,
  add column if not exists schedule_id  uuid references public.doctor_schedules (id) on delete set null;

-- ─── Question Categories ─────────────────────────────────────────────────────

create table if not exists public.question_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.question_categories is
  'Categories for questionnaire sets (Tim mạch, Tâm lý, PHQ-9…).';

insert into public.question_categories (name, sort_order) values
  ('Tim mạch', 1), ('Tâm lý', 2), ('PHQ-9', 3), ('Tổng quát', 4)
on conflict (name) do nothing;

create trigger question_categories_set_updated_at
  before update on public.question_categories
  for each row execute function public.set_updated_at();

-- ─── ICD-10 Master (stub — full import Sprint 5) ─────────────────────────────

create table if not exists public.icd10_master (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  name_vi      text not null,
  name_en      text,
  category     text,
  icd_version  text not null default '2024',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (code, icd_version)
);

comment on table public.icd10_master is 'ICD-10 disease codes. Populated via CSV import (Sprint 5).';

create index if not exists icd10_code_idx on public.icd10_master (code);
create index if not exists icd10_version_idx on public.icd10_master (icd_version);

-- ─── Master Data Audit Log (AC5) ────────────────────────────────────────────

create table if not exists public.master_data_audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   uuid not null,
  action      text not null check (action in ('INSERT','UPDATE','DEACTIVATE')),
  changed_by  uuid references auth.users (id) on delete set null,
  changed_at  timestamptz not null default now(),
  old_data    jsonb,
  new_data    jsonb
);

comment on table public.master_data_audit_log is 'Immutable audit trail for all master data CRUD operations.';

create index if not exists mdal_table_record_idx on public.master_data_audit_log (table_name, record_id);
create index if not exists mdal_changed_at_idx   on public.master_data_audit_log (changed_at desc);

-- Trigger function — appended to every master-data table
create or replace function public.master_data_audit_trigger()
returns trigger language plpgsql security definer as $$
declare
  v_action text;
  v_new    jsonb;
  v_old    jsonb;
begin
  if (TG_OP = 'INSERT') then
    v_action := 'INSERT';
    v_new    := to_jsonb(NEW);
    v_old    := null;
  else
    -- UPDATE
    if (OLD.is_active = true and NEW.is_active = false) then
      v_action := 'DEACTIVATE';
    else
      v_action := 'UPDATE';
    end if;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  end if;

  insert into public.master_data_audit_log (table_name, record_id, action, changed_by, old_data, new_data)
  values (TG_TABLE_NAME, NEW.id, v_action, auth.uid(), v_old, v_new);

  return NEW;
end;
$$;

-- Attach audit trigger to each master-data table
create trigger specialties_audit
  after insert or update on public.specialties
  for each row execute function public.master_data_audit_trigger();

create trigger services_audit
  after insert or update on public.services
  for each row execute function public.master_data_audit_trigger();

create trigger facilities_audit
  after insert or update on public.facilities
  for each row execute function public.master_data_audit_trigger();

create trigger rooms_audit
  after insert or update on public.rooms
  for each row execute function public.master_data_audit_trigger();

create trigger doctor_schedules_audit
  after insert or update on public.doctor_schedules
  for each row execute function public.master_data_audit_trigger();

create trigger question_categories_audit
  after insert or update on public.question_categories
  for each row execute function public.master_data_audit_trigger();

-- ─── AC4: Soft-delete RPCs (check FK before deactivating) ───────────────────

create or replace function public.deactivate_master_record(
  p_table  text,
  p_id     uuid
) returns void language plpgsql security definer as $$
declare
  v_active_appointments integer := 0;
begin
  -- Only allow from admin portal
  if not exists (
    select 1 from public.user_profiles
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- Check active appointments for specialty / facility / room
  if p_table = 'specialties' then
    select count(*) into v_active_appointments
    from public.appointments a
    where a.specialty_id = p_id and a.status not in ('CANCELLED','COMPLETED','NO_SHOW');
  elsif p_table = 'facilities' then
    select count(*) into v_active_appointments
    from public.appointment_slots s
    where s.facility_id = p_id and s.is_available = true;
  elsif p_table = 'rooms' then
    select count(*) into v_active_appointments
    from public.appointment_slots s
    where s.room_id = p_id and s.is_available = true;
  end if;

  if v_active_appointments > 0 then
    raise exception 'HAS_ACTIVE_DEPENDENCIES:% active records', v_active_appointments
      using errcode = 'P0010';
  end if;

  execute format('update public.%I set is_active = false where id = $1', p_table)
  using p_id;
end;
$$;

-- ─── AC3: Nightly slot generation (00:00 cron target) ────────────────────────
-- pg_cron setup (run once in Supabase dashboard):
--   SELECT cron.schedule('generate-slots-nightly', '0 0 * * *',
--          $$SELECT public.generate_slots_30d()$$);

create or replace function public.generate_slots_30d()
returns jsonb language plpgsql security definer as $$
declare
  sched     record;
  cur_date  date;
  cur_time  time;
  end_date  date := current_date + interval '30 days';
  slots_created int := 0;
begin
  for sched in
    select ds.*, sp.id as spec_id
    from public.doctor_schedules ds
    join public.specialties sp on sp.id = ds.specialty_id
    where ds.is_active = true
      and sp.is_active = true
      and ds.valid_from <= current_date
      and (ds.valid_until is null or ds.valid_until >= current_date)
  loop
    cur_date := current_date;
    while cur_date <= end_date loop
      -- Check day-of-week matches schedule
      if extract(dow from cur_date)::integer = any(sched.work_days) then
        -- Skip exception dates
        if not (sched.exceptions ? cur_date::text) then
          -- Generate time slots
          cur_time := sched.work_start_time;
          while (cur_time + (sched.slot_duration_minutes || ' minutes')::interval) <= sched.work_end_time loop
            insert into public.appointment_slots (
              specialty_id, slot_date, start_time, end_time,
              doctor_id, facility_id, room_id, schedule_id
            ) values (
              sched.specialty_id,
              cur_date,
              cur_time,
              cur_time + (sched.slot_duration_minutes || ' minutes')::interval,
              sched.doctor_id,
              sched.facility_id,
              sched.room_id,
              sched.id
            )
            on conflict (specialty_id, slot_date, start_time) do nothing;

            slots_created := slots_created + 1;
            cur_time := cur_time + (sched.slot_duration_minutes || ' minutes')::interval;
          end loop;
        end if;
      end if;
      cur_date := cur_date + 1;
    end loop;
  end loop;

  return jsonb_build_object('slots_created', slots_created, 'run_at', now());
end;
$$;

comment on function public.generate_slots_30d() is
  'Nightly cron target: generates appointment slots for the next 30 days from active doctor_schedules.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.services            enable row level security;
alter table public.rooms               enable row level security;
alter table public.doctor_schedules    enable row level security;
alter table public.question_categories enable row level security;
alter table public.icd10_master        enable row level security;
alter table public.master_data_audit_log enable row level security;

-- Admin: full access; staff/doctor: read
create policy "services_public_read"
  on public.services for select using (is_active = true);

create policy "rooms_public_read"
  on public.rooms for select using (is_active = true);

create policy "question_categories_public_read"
  on public.question_categories for select using (is_active = true);

create policy "icd10_public_read"
  on public.icd10_master for select using (is_active = true);

create policy "doctor_schedules_admin_read"
  on public.doctor_schedules for select
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role in ('admin','doctor')
    )
  );

create policy "audit_log_admin_read"
  on public.master_data_audit_log for select
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- ─── Seed additional permissions (AC6) ───────────────────────────────────────

insert into public.permissions (slug, name, category) values
  ('master_data.read',   'Xem Master Data',      'master_data'),
  ('master_data.write',  'Tạo / Sửa Master Data','master_data'),
  ('master_data.deactivate', 'Vô hiệu Master Data', 'master_data'),
  ('icd10.import',       'Import ICD-10 CSV',    'master_data')
on conflict (slug) do nothing;

-- Grant master_data permissions to admin role
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.slug = 'admin'
  and p.slug like 'master_data.%'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.slug = 'master_data.read'
where r.slug = 'doctor'
on conflict do nothing;
