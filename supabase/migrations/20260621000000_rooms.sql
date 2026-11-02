-- FR-021: Check-in & AI Routing — rooms extension
-- Adds specialty_id FK to the existing rooms table so the AI routing engine
-- can filter eligible rooms by specialty (R4.1, R4.2).
-- Seeds 3 sample rooms used for local development / demo.

-- ─── Add specialty_id to rooms ───────────────────────────────────────────────

alter table public.rooms
  add column if not exists specialty_id uuid references public.specialties (id) on delete set null;

comment on column public.rooms.specialty_id is
  'Primary specialty served by this room. NULL = general-purpose room.';

create index if not exists rooms_specialty_idx on public.rooms (specialty_id);

-- ─── RLS: staff can read all rooms; anon/patient can read active rooms ────────
-- Note: rooms_public_read (is_active = true) was already created in
-- 20260609110000_master_data.sql — add the staff-all-read policy here.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'rooms'
      and policyname = 'rooms_staff_read_all'
  ) then
    execute $policy$
      create policy "rooms_staff_read_all"
        on public.rooms for select
        using (
          exists (
            select 1 from public.user_profiles
            where user_id = auth.uid()
              and role in ('admin', 'receptionist', 'doctor', 'nurse')
          )
        )
    $policy$;
  end if;
end;
$$;

-- ─── Seed: 3 sample rooms ─────────────────────────────────────────────────────
-- specialty_id is left NULL here because specialty UUIDs are environment-specific.
-- Administrators can update specialty_id via the Master Data admin UI after deployment.
-- Only insert if a default facility exists.

do $$
declare
  v_facility_id uuid;
begin
  select id into v_facility_id from public.facilities limit 1;
  if v_facility_id is not null then
    insert into public.rooms (facility_id, name, room_number, specialty_id, is_active)
    values
      (v_facility_id, 'Phòng 1 - Nội khoa',  '101', null, true),
      (v_facility_id, 'Phòng 2 - Nhi khoa',  '102', null, true),
      (v_facility_id, 'Phòng 3 - Tim mạch',  '103', null, true)
    on conflict (facility_id, room_number) do nothing;
  end if;
end;
$$;
