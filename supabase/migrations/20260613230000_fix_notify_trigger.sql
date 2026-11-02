-- Fix trigger: when slot has no doctor_id, fall back to
-- all doctors in user_profiles whose specialty text matches the appointment's specialty name.

create or replace function public.notify_doctor_on_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id      uuid;
  v_slot_date      date;
  v_start_time     time;
  v_patient_name   text;
  v_specialty_name text;
  v_is_walk_in     boolean;
  v_rec            record;
begin
  v_is_walk_in := coalesce(new.walk_in, false);

  -- Resolve slot date/time and optional doctor_id
  if new.slot_id is not null then
    select s.doctor_id, s.slot_date, s.start_time
      into v_doctor_id, v_slot_date, v_start_time
      from public.appointment_slots s
     where s.id = new.slot_id;
  end if;

  -- Patient name
  select coalesce(
           nullif(trim(coalesce(legal_last_name,'') || ' ' || coalesce(legal_first_name,'')), ''),
           full_name
         )
    into v_patient_name
    from public.patient
   where id = new.profile_id;

  -- Specialty name
  select name into v_specialty_name
    from public.specialties
   where id = new.specialty_id;

  if v_doctor_id is not null then
    -- Slot has explicit doctor assigned → notify that doctor only
    insert into public.notifications
      (recipient_user_id, appointment_id, patient_name, specialty_name,
       slot_date, slot_time, walk_in)
    values
      (v_doctor_id, new.id, v_patient_name, v_specialty_name,
       v_slot_date, v_start_time, v_is_walk_in);
  else
    -- No doctor on slot → notify all doctors whose specialty matches
    for v_rec in
      select up.user_id
        from public.user_profiles up
       where up.role = 'doctor'
         and up.specialty = v_specialty_name
    loop
      insert into public.notifications
        (recipient_user_id, appointment_id, patient_name, specialty_name,
         slot_date, slot_time, walk_in)
      values
        (v_rec.user_id, new.id, v_patient_name, v_specialty_name,
         v_slot_date, v_start_time, v_is_walk_in);
    end loop;
  end if;

  return new;
end;
$$;
