-- FR-022: Automated pre-consultation reminder (within 2 hours of appointment)
-- Adds tracking column, candidate query RPC, and pg_cron schedule.

-- ─── Tracking column ─────────────────────────────────────────────────────────

alter table public.appointments
  add column if not exists pre_consult_auto_reminder_sent boolean not null default false;

comment on column public.appointments.pre_consult_auto_reminder_sent is
  'True after the automated pre-consult reminder email was sent (cron job, <2h before slot).';

create index if not exists appt_pre_consult_auto_reminder_idx
  on public.appointments (pre_consult_auto_reminder_sent)
  where pre_consult_auto_reminder_sent = false;

-- ─── Candidate query (used by scan-pre-consult-reminders edge function) ─────

create or replace function public.find_pre_consult_reminder_candidates()
returns table (id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select a.id
  from public.appointments a
  join public.appointment_slots s on s.id = a.slot_id
  left join public.pre_consultations pc on pc.appointment_id = a.id
  where a.status = 'CONFIRMED'
    and a.pre_consult_auto_reminder_sent = false
    and s.slot_date = current_date
    and (s.slot_date + s.start_time)::timestamptz > now()
    and (s.slot_date + s.start_time)::timestamptz <= now() + interval '2 hours'
    and coalesce(pc.status::text, 'DRAFT') <> 'SUBMITTED';
$$;

comment on function public.find_pre_consult_reminder_candidates() is
  'Returns CONFIRMED today appointments starting within 2 hours that still need pre-consult submission.';

revoke all on function public.find_pre_consult_reminder_candidates() from public;
grant execute on function public.find_pre_consult_reminder_candidates() to service_role;

-- ─── pg_cron trigger (invokes scan-pre-consult-reminders edge function) ──────
-- Requires pg_cron + pg_net extensions (Supabase Dashboard → Database → Extensions).
-- After deploy, store secrets in Vault (one-time, per environment):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'supabase_project_url');
--   select vault.create_secret('<service-role-key>', 'supabase_service_role_key');

create or replace function public.trigger_pre_consult_reminder_scan()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'supabase_project_url'
  limit 1;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'supabase_service_role_key'
  limit 1;

  if v_url is null or v_key is null then
    return jsonb_build_object(
      'skipped', true,
      'reason', 'Vault secrets supabase_project_url / supabase_service_role_key not configured'
    );
  end if;

  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/scan-pre-consult-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  ) into v_request_id;

  return jsonb_build_object('request_id', v_request_id);
exception
  when undefined_table then
    return jsonb_build_object('skipped', true, 'reason', 'pg_net or vault extension not available');
  when others then
    return jsonb_build_object('skipped', true, 'reason', SQLERRM);
end;
$$;

comment on function public.trigger_pre_consult_reminder_scan() is
  'Cron target: POST scan-pre-consult-reminders edge function via pg_net.';

revoke all on function public.trigger_pre_consult_reminder_scan() from public;
grant execute on function public.trigger_pre_consult_reminder_scan() to service_role;

-- Schedule: every 15 minutes (requires pg_cron extension)
do $cron$
declare
  v_jobid bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not enabled — skipping pre-consult reminder cron schedule. '
      'Enable pg_cron (Dashboard → Database → Extensions) then run: '
      'select cron.schedule(''pre-consult-reminder-scan-every-15min'', ''*/15 * * * *'', '
      '$$ select public.trigger_pre_consult_reminder_scan() $$);';
    return;
  end if;

  select jobid into v_jobid
  from cron.job
  where jobname = 'pre-consult-reminder-scan-every-15min';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'pre-consult-reminder-scan-every-15min',
    '*/15 * * * *',
    $$ select public.trigger_pre_consult_reminder_scan() $$
  );
end;
$cron$;
