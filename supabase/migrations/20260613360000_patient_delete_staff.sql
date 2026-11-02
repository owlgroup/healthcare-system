-- Allow admin and doctor to DELETE patient records.
CREATE POLICY patient_delete_staff
  ON public.patient FOR DELETE
  TO authenticated
  USING (public.staff_can_access_patients());
