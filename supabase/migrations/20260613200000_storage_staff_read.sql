-- Allow staff (admin/doctor) to read from patient document storage buckets
-- so they can generate signed URLs when viewing patient records.

create policy "identity_documents_select_staff"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'identity-documents'
    and public.staff_can_access_patients()
  );

create policy "insurance_cards_select_staff"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'insurance-cards'
    and public.staff_can_access_patients()
  );
