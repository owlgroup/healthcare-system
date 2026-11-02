-- Provider portal: bác sĩ đọc được hồ sơ patient (RLS trước đó chỉ cho patient xem row của mình)

CREATE POLICY patient_select_doctor
  ON public.patient
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid ()
        AND up.role = 'doctor'
    )
  );
