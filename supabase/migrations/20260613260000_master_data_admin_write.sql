-- Admin write access for master data tables

-- Helper: reuse existing staff_can_access_patients function pattern
-- Admin check inline: role = 'admin' in user_profiles

-- specialties
CREATE POLICY "specialties_admin_write" ON public.specialties
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- services
CREATE POLICY "services_admin_write" ON public.services
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- rooms
CREATE POLICY "rooms_admin_write" ON public.rooms
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- doctor_schedules
CREATE POLICY "doctor_schedules_admin_write" ON public.doctor_schedules
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- appointment_slots (admin can manage slots)
CREATE POLICY "appointment_slots_admin_write" ON public.appointment_slots
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
