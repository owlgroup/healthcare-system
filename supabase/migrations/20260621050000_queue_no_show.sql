-- FR-021: Check-in & AI Routing — NO_SHOW automation
-- RULE-021d: CONFIRMED appointments not checked-in 30+ min after slot start → NO_SHOW.
-- Function auto_no_show() is called every minute via pg_cron.

-- ─── auto_no_show function ────────────────────────────────────────────────────

create or replace function public.auto_no_show()
returns jsonb
language plpgsql security definer as $$
declare
  v_ids   uuid[];
  v_count int;
  v_id    uuid;
begin
  -- Find CONFIRMED appointments whose slot start was > 30 minutes ago (today only)
  select array_agg(a.id)
  into v_ids
  from public.appointments a
  join public.appointment_slots s on s.id = a.slot_id
  where a.status = 'CONFIRMED'
    and s.slot_date = current_date
    and (s.slot_date + s.start_time)::timestamptz + interval '30 minutes' < now();

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return jsonb_build_object('processed', 0);
  end if;

  v_count := array_length(v_ids, 1);

  -- Mark appointments as NO_SHOW
  update public.appointments
  set status = 'NO_SHOW', updated_at = now()
  where id = any(v_ids);

  -- Free appointment slots
  update public.appointment_slots
  set is_available = true
  where id in (
    select slot_id from public.appointments where id = any(v_ids)
  );

  -- Remove any pending queue entries for these appointments
  delete from public.queue_entries
  where appointment_id = any(v_ids)
    and status in ('WAITING','CALLED');

  -- Write audit logs
  foreach v_id in array v_ids loop
    insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    values (
      null,   -- system action
      'PATIENT_NO_SHOW',
      'appointments',
      v_id,
      jsonb_build_object('triggered_by', 'auto_no_show', 'processed_at', now())
    );
  end loop;

  return jsonb_build_object('processed', v_count);
end;
$$;

comment on function public.auto_no_show() is
  'Idempotent batch job — marks CONFIRMED appointments as NO_SHOW after 30-minute grace period '
  '(RULE-021d). Frees slots and removes pending queue entries. Called by pg_cron every minute.';

-- ─── pg_cron schedule ────────────────────────────────────────────────────────
-- Requires pg_cron extension to be enabled in Supabase (Database → Extensions → pg_cron).
-- Schedule: every minute. Skip if pg_cron is not available.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'auto-no-show-every-minute',
      '* * * * *',
      $cron$ select public.auto_no_show() $cron$
    );
  end if;
end;
$$;
