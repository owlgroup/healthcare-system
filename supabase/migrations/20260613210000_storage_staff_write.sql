-- Allow staff (admin/doctor) to upload patient documents to storage buckets.
-- Files are stored under the patient's own user_id folder.
create policy "identity_documents_insert_staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'identity-documents'
    and public.staff_can_access_patients()
  );

create policy "insurance_cards_insert_staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'insurance-cards'
    and public.staff_can_access_patients()
  );

-- Allow admins to update any patient profile row (to complete incomplete profiles).
create policy "patient_admin_update"
  on public.patient for update
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'admin'
    )
  );
