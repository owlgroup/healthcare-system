-- Admin portal: đọc danh sách hồ sơ bệnh nhân (bác sĩ đã có patient_select_doctor)

CREATE POLICY patient_select_admin
  ON public.patient
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid ()
        AND up.role = 'admin'
    )
  );
