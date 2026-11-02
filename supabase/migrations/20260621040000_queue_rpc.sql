-- FR-021: Check-in & AI Routing — Supabase RPC functions
-- Functions: get_next_token, assign_room, perform_checkin, call_next_patient
-- All functions use SECURITY DEFINER so they run with service_role privileges
-- (bypassing RLS on queue_token_counters, etc.).

-- ─── get_next_token ───────────────────────────────────────────────────────────
-- Atomically increments the per-prefix daily counter.
-- RULE-021a: resets to 1 each day.
-- Returns: (prefix char(1), number int)

create or replace function public.get_next_token(
  p_service_type text  -- 'GENERAL' | 'SPECIALIST' | 'EMERGENCY'
) returns table (out_prefix char(1), out_number int)
language plpgsql security definer as $$
declare
  v_prefix   char(1);
  v_number   int;
begin
  -- Map service_type → prefix
  v_prefix := case p_service_type
    when 'SPECIALIST'  then 'B'
    when 'EMERGENCY'   then 'C'
    else                     'A'   -- GENERAL (default)
  end;

  -- Atomic SELECT FOR UPDATE: lock the counter row to prevent race conditions
  select last_number into v_number
  from public.queue_token_counters
  where prefix = v_prefix
  for update;

  -- RULE-021a: reset counter when the date changes
  update public.queue_token_counters
  set
    last_number  = case when counter_date < current_date then 1 else last_number + 1 end,
    counter_date = current_date
  where prefix = v_prefix
  returning last_number into v_number;

  -- Guard: should never exceed 999 in a real clinic day, but raise to alert ops
  if v_number > 999 then
    raise exception 'TOKEN_LIMIT_EXCEEDED: prefix % has exceeded 999 tokens today', v_prefix
      using errcode = 'P0010';
  end if;

  out_prefix := v_prefix;
  out_number := v_number;
  return next;
end;
$$;

comment on function public.get_next_token(text) is
  'Returns the next atomic queue token (prefix + number) for the given service_type. '
  'Daily reset per RULE-021a. Race-condition-safe via SELECT FOR UPDATE.';


-- ─── assign_room ──────────────────────────────────────────────────────────────
-- AI routing engine: selects the best room for a patient.
-- Scoring: score = (1/queue_count)*0.6 + availability*0.4
-- EMERGENCY bypasses scoring → always goes to position 1.
-- Returns: (room_id, room_name, doctor_id, doctor_name, estimated_wait, position)
-- Returns NULL room_id when no eligible room exists (pending assignment).

create or replace function public.assign_room(
  p_specialty_id  uuid,
  p_service_type  text   default 'GENERAL'
) returns table (
  out_room_id      uuid,
  out_room_name    text,
  out_doctor_id    uuid,
  out_doctor_name  text,
  out_est_wait     int,
  out_position     int
)
language plpgsql security definer as $$
declare
  v_row record;
  v_queue_count  int;
  v_avg_consult  numeric;
  v_score        numeric;
  v_best_score   numeric := -1;
  v_best         record;
  v_position     int;
begin
  -- EMERGENCY: skip scoring, use round-robin and push to position 1
  -- Normal: score = (1/queue_count)*0.6 + 1.0*0.4

  for v_row in
    select
      r.id            as room_id,
      r.name          as room_name,
      ds.doctor_id,
      coalesce(up.full_name, 'Bác sĩ')  as doctor_name,
      count(qe.id)::int                 as queue_count,
      coalesce(
        (select avg(extract(epoch from (qe2.done_at - qe2.in_room_at)) / 60)::numeric
         from public.queue_entries qe2
         where qe2.doctor_id = ds.doctor_id
           and qe2.done_at is not null
           and qe2.in_room_at is not null
           and qe2.checked_in_at > now() - interval '30 days'),
        15   -- fallback: 15-minute average
      )::numeric as avg_consult
    from public.rooms r
    join public.doctor_shifts ds
      on ds.room_id   = r.id
      and ds.shift_date = current_date
      and current_time between ds.start_time and ds.end_time
    left join public.user_profiles up
      on up.user_id = ds.doctor_id
    left join public.queue_entries qe
      on qe.room_id = r.id
      and qe.status in ('WAITING','CALLED','IN_ROOM')
    where r.is_active = true
      and (r.specialty_id = p_specialty_id or r.specialty_id is null)
    group by r.id, r.name, ds.doctor_id, up.full_name
  loop
    if p_service_type = 'EMERGENCY' then
      -- For EMERGENCY: pick any eligible room (first by id), position = 1
      v_best := v_row;
      exit;  -- take the first eligible room immediately
    end if;

    -- Scoring for non-emergency
    -- queue_count=0 → score = 0.6*∞ → cap at 1.0; use 1.0 for empty room
    if v_row.queue_count = 0 then
      v_score := 1.0;
    else
      v_score := (1.0 / v_row.queue_count) * 0.6 + 1.0 * 0.4;
    end if;

    if v_score > v_best_score then
      v_best_score := v_score;
      v_best := v_row;
    end if;
  end loop;

  -- No eligible room found → return NULLs (pending assignment)
  if v_best is null then
    out_room_id     := null;
    out_room_name   := null;
    out_doctor_id   := null;
    out_doctor_name := null;
    out_est_wait    := null;
    out_position    := 0;
    return next;
    return;
  end if;

  -- Compute position and estimated wait
  select count(*) + 1 into v_position
  from public.queue_entries
  where room_id = v_best.room_id
    and status in ('WAITING','CALLED','IN_ROOM');

  if p_service_type = 'EMERGENCY' then
    v_position := 1;
  end if;

  out_room_id     := v_best.room_id;
  out_room_name   := v_best.room_name;
  out_doctor_id   := v_best.doctor_id;
  out_doctor_name := v_best.doctor_name;
  out_est_wait    := ((v_position - 1) * v_best.avg_consult)::int;
  out_position    := v_position;
  return next;

exception
  when others then
    -- Fallback: round-robin by room_id ASC with matching specialty
    begin
      select r.id, r.name, ds.doctor_id,
             coalesce(up.full_name, 'Bác sĩ') as doctor_name
      into v_best
      from public.rooms r
      join public.doctor_shifts ds on ds.room_id = r.id
        and ds.shift_date = current_date
      left join public.user_profiles up on up.user_id = ds.doctor_id
      where r.is_active = true
        and (r.specialty_id = p_specialty_id or r.specialty_id is null)
      order by r.id asc
      limit 1;

      raise warning 'assign_room fallback triggered: %', sqlerrm;

      out_room_id     := v_best.room_id;
      out_room_name   := v_best.room_name;
      out_doctor_id   := v_best.doctor_id;
      out_doctor_name := v_best.doctor_name;
      out_est_wait    := 15;
      out_position    := 1;
      return next;
    exception when others then
      -- Truly no room available
      out_room_id := null; out_room_name := null;
      out_doctor_id := null; out_doctor_name := null;
      out_est_wait := null; out_position := 0;
      return next;
    end;
end;
$$;

comment on function public.assign_room(uuid, text) is
  'AI routing engine. Scores rooms by queue load and assigns the best available room. '
  'EMERGENCY bypasses scoring. Falls back to round-robin on error. Returns NULL room_id when no room is available.';


-- ─── perform_checkin ──────────────────────────────────────────────────────────
-- Orchestrates the full check-in flow atomically.
-- For QR check-in: validates and consumes the qr_token.
-- For walk-in: skips token validation (p_walk_in = true).
-- Returns JSON with queue entry details.

create or replace function public.perform_checkin(
  p_appointment_id  uuid,
  p_walk_in         boolean  default false,
  p_service_type    text     default 'GENERAL'
) returns jsonb
language plpgsql security definer as $$
declare
  v_appt          record;
  v_patient_id    uuid;
  v_token_row     record;
  v_room_row      record;
  v_entry_id      uuid;
  v_existing      int;
begin
  v_patient_id := auth.uid();
  if v_patient_id is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  -- Lock the appointment row
  select a.*, s.specialty_id as appt_specialty_id
  into v_appt
  from public.appointments a
  join public.appointment_slots s on s.id = a.slot_id
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0020';
  end if;

  -- Only CONFIRMED appointments can check in
  if v_appt.status <> 'CONFIRMED' then
    raise exception 'INVALID_STATUS: appointment is %', v_appt.status
      using errcode = 'P0021';
  end if;

  -- QR token validation (skip for walk-in)
  if not p_walk_in then
    if v_appt.qr_token_consumed then
      raise exception 'QR_TOKEN_CONSUMED' using errcode = 'P0022';
    end if;
    if v_appt.qr_expires_at < now() then
      raise exception 'QR_TOKEN_EXPIRED' using errcode = 'P0023';
    end if;
    -- Mark token as consumed
    update public.appointments
    set qr_token_consumed = true
    where id = p_appointment_id;
  end if;

  -- RULE-021f: check for existing active queue entry
  select count(*) into v_existing
  from public.queue_entries
  where patient_id = v_appt.patient_id
    and status in ('WAITING','CALLED','IN_ROOM');

  if v_existing > 0 then
    raise exception 'ALREADY_IN_QUEUE' using errcode = 'P0024';
  end if;

  -- Get next token
  select out_prefix, out_number
  into v_token_row
  from public.get_next_token(p_service_type);

  -- Assign room via AI routing engine
  select out_room_id, out_room_name, out_doctor_id, out_doctor_name, out_est_wait, out_position
  into v_room_row
  from public.assign_room(v_appt.appt_specialty_id, p_service_type);

  -- Insert queue entry
  insert into public.queue_entries (
    appointment_id,
    patient_id,
    profile_id,
    room_id,
    doctor_id,
    specialty_id,
    service_type,
    token_prefix,
    token_number,
    status,
    position,
    walk_in,
    estimated_wait
  ) values (
    p_appointment_id,
    v_appt.patient_id,
    v_appt.profile_id,
    v_room_row.out_room_id,
    v_room_row.out_doctor_id,
    v_appt.appt_specialty_id,
    p_service_type,
    v_token_row.out_prefix,
    v_token_row.out_number,
    'WAITING',
    coalesce(v_room_row.out_position, 0),
    p_walk_in,
    v_room_row.out_est_wait
  )
  returning id into v_entry_id;

  -- Update appointment status to CHECKED_IN
  update public.appointments
  set status = 'CHECKED_IN', updated_at = now()
  where id = p_appointment_id;

  -- Audit log
  insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata)
  values (
    v_patient_id,
    'PATIENT_CHECKED_IN',
    'queue_entries',
    v_entry_id,
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'token', v_token_row.out_prefix || lpad(v_token_row.out_number::text, 3, '0'),
      'walk_in', p_walk_in,
      'service_type', p_service_type,
      'room_id', v_room_row.out_room_id
    )
  );

  return jsonb_build_object(
    'queue_entry_id',  v_entry_id,
    'token_full',      v_token_row.out_prefix || lpad(v_token_row.out_number::text, 3, '0'),
    'room_name',       v_room_row.out_room_name,
    'doctor_name',     v_room_row.out_doctor_name,
    'estimated_wait',  v_room_row.out_est_wait,
    'position',        coalesce(v_room_row.out_position, 0)
  );
end;
$$;

comment on function public.perform_checkin(uuid, boolean, text) is
  'Orchestrates patient check-in (QR or walk-in). Validates token, assigns queue number, '
  'routes to optimal room, updates appointment status, and writes audit log.';


-- ─── call_next_patient ────────────────────────────────────────────────────────
-- Doctor triggers "Complete + Call Next".
-- Marks current IN_ROOM/CALLED entry as DONE and promotes next WAITING entry.

create or replace function public.call_next_patient(
  p_doctor_id  uuid,
  p_room_id    uuid
) returns jsonb
language plpgsql security definer as $$
declare
  v_current_id  uuid;
  v_next        record;
  v_doctor_uid  uuid;
begin
  v_doctor_uid := auth.uid();

  -- Mark the current active entry (CALLED or IN_ROOM) as DONE
  update public.queue_entries
  set status  = 'DONE',
      done_at = now()
  where room_id = p_room_id
    and doctor_id = p_doctor_id
    and status in ('CALLED','IN_ROOM')
  returning id into v_current_id;

  -- Get the next WAITING entry for this room (lowest position, then oldest check-in)
  select qe.id, qe.patient_id, qe.token_full, qe.appointment_id,
         pat.legal_first_name || ' ' || pat.legal_last_name as patient_name
  into v_next
  from public.queue_entries qe
  left join public.patient pat on pat.id = qe.profile_id
  where qe.room_id = p_room_id
    and qe.status = 'WAITING'
  order by qe.position asc, qe.checked_in_at asc
  limit 1
  for update;

  if not found then
    -- No next patient — queue is empty
    return jsonb_build_object('called', false, 'message', 'Hàng chờ trống');
  end if;

  -- Promote next entry to CALLED
  update public.queue_entries
  set status    = 'CALLED',
      called_at = now()
  where id = v_next.id;

  -- Insert a notification for the patient (follows existing notifications table pattern)
  insert into public.notifications (
    appointment_id,
    patient_name,
    specialty_name,
    slot_date,
    slot_time,
    walk_in,
    read
  )
  select
    v_next.appointment_id,
    v_next.patient_name,
    s.name,
    sl.slot_date::text,
    sl.start_time::text,
    qe.walk_in,
    false
  from public.queue_entries qe
  join public.appointments a   on a.id = qe.appointment_id
  join public.appointment_slots sl on sl.id = a.slot_id
  join public.specialties s   on s.id = qe.specialty_id
  where qe.id = v_next.id;

  return jsonb_build_object(
    'called',        true,
    'queue_entry_id', v_next.id,
    'token_full',    v_next.token_full,
    'patient_name',  v_next.patient_name
  );
end;
$$;

comment on function public.call_next_patient(uuid, uuid) is
  'Marks the current patient as DONE and calls the next WAITING patient in the room queue. '
  'Inserts a notification for the promoted patient.';
