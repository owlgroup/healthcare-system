-- Master data RLS: allow custom roles with master_data.* permissions (not only admin)

CREATE OR REPLACE FUNCTION public.user_has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.role_permissions rp ON rp.role_id = up.role_id
    JOIN public.permissions perm ON perm.id = rp.permission_id
    WHERE up.user_id = auth.uid()
      AND perm.slug = p_permission
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = auth.uid()
      AND up.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_permission(text) TO authenticated;

-- ─── Write (insert / update / delete / select all rows) ─────────────────────

CREATE POLICY "specialties_master_data_write" ON public.specialties
  FOR ALL TO authenticated
  USING (public.user_has_permission('master_data.write'))
  WITH CHECK (public.user_has_permission('master_data.write'));

CREATE POLICY "services_master_data_write" ON public.services
  FOR ALL TO authenticated
  USING (public.user_has_permission('master_data.write'))
  WITH CHECK (public.user_has_permission('master_data.write'));

CREATE POLICY "rooms_master_data_write" ON public.rooms
  FOR ALL TO authenticated
  USING (public.user_has_permission('master_data.write'))
  WITH CHECK (public.user_has_permission('master_data.write'));

CREATE POLICY "doctor_schedules_master_data_write" ON public.doctor_schedules
  FOR ALL TO authenticated
  USING (public.user_has_permission('master_data.write'))
  WITH CHECK (public.user_has_permission('master_data.write'));

CREATE POLICY "appointment_slots_master_data_write" ON public.appointment_slots
  FOR ALL TO authenticated
  USING (public.user_has_permission('master_data.write'))
  WITH CHECK (public.user_has_permission('master_data.write'));

CREATE POLICY "question_categories_master_data_write" ON public.question_categories
  FOR ALL TO authenticated
  USING (public.user_has_permission('master_data.write'))
  WITH CHECK (public.user_has_permission('master_data.write'));

CREATE POLICY "facilities_master_data_write" ON public.facilities
  FOR ALL TO authenticated
  USING (public.user_has_permission('master_data.write'))
  WITH CHECK (public.user_has_permission('master_data.write'));

-- ─── Read (include inactive rows in admin/customer master-data UI) ────────────

CREATE POLICY "specialties_master_data_read" ON public.specialties
  FOR SELECT TO authenticated
  USING (public.user_has_permission('master_data.read'));

CREATE POLICY "services_master_data_read" ON public.services
  FOR SELECT TO authenticated
  USING (public.user_has_permission('master_data.read'));

CREATE POLICY "rooms_master_data_read" ON public.rooms
  FOR SELECT TO authenticated
  USING (public.user_has_permission('master_data.read'));

CREATE POLICY "question_categories_master_data_read" ON public.question_categories
  FOR SELECT TO authenticated
  USING (public.user_has_permission('master_data.read'));

CREATE POLICY "facilities_master_data_read" ON public.facilities
  FOR SELECT TO authenticated
  USING (public.user_has_permission('master_data.read'));

CREATE POLICY "doctor_schedules_master_data_read" ON public.doctor_schedules
  FOR SELECT TO authenticated
  USING (
    public.user_has_permission('master_data.read')
    OR public.user_has_permission('master_data.write')
  );

CREATE POLICY "master_data_audit_log_permission_read" ON public.master_data_audit_log
  FOR SELECT TO authenticated
  USING (public.user_has_permission('audit.read'));

-- ─── Soft-delete RPC ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deactivate_master_record(
  p_table text,
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_appointments integer := 0;
BEGIN
  IF NOT (
    public.user_has_permission('master_data.deactivate')
    OR public.user_has_permission('master_data.write')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  IF p_table = 'specialties' THEN
    SELECT count(*) INTO v_active_appointments
    FROM public.appointments a
    WHERE a.specialty_id = p_id AND a.status NOT IN ('CANCELLED', 'COMPLETED', 'NO_SHOW');
  ELSIF p_table = 'facilities' THEN
    SELECT count(*) INTO v_active_appointments
    FROM public.appointment_slots s
    WHERE s.facility_id = p_id AND s.is_available = true;
  ELSIF p_table = 'rooms' THEN
    SELECT count(*) INTO v_active_appointments
    FROM public.appointment_slots s
    WHERE s.room_id = p_id AND s.is_available = true;
  END IF;

  IF v_active_appointments > 0 THEN
    RAISE EXCEPTION 'HAS_ACTIVE_DEPENDENCIES:% active records', v_active_appointments
      USING ERRCODE = 'P0010';
  END IF;

  EXECUTE format('UPDATE public.%I SET is_active = false WHERE id = $1', p_table)
  USING p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_master_record(text, uuid) TO authenticated;
