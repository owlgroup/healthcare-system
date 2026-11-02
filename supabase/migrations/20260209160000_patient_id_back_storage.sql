-- Store back side of government ID (CCCD) alongside front path.

alter table public.patient
  add column if not exists id_document_back_storage_path text;

comment on column public.patient.id_document_back_storage_path is 'Supabase Storage path in bucket identity-documents for ID back image.';
