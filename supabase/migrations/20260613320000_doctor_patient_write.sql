-- Allow admin and doctor roles to INSERT and UPDATE patient records.
-- SELECT is already handled by patient_select_staff_jwt via staff_can_access_patients().

CREATE POLICY patient_insert_staff
  ON public.patient FOR INSERT
  TO authenticated
  WITH CHECK (public.staff_can_access_patients());

CREATE POLICY patient_update_staff
  ON public.patient FOR UPDATE
  TO authenticated
  USING  (public.staff_can_access_patients())
  WITH CHECK (public.staff_can_access_patients());
