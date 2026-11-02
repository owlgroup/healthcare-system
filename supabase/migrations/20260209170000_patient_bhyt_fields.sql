-- Add BHYT OCR-mapped fields and allow single insurance image flow.

alter table public.patient
  add column if not exists bhyt_name text,
  add column if not exists bhyt_dob date,
  add column if not exists bhyt_gender text,
  add column if not exists bhyt_address text,
  add column if not exists bhyt_kcb text,
  add column if not exists bhyt_kcb_code text,
  add column if not exists bhyt_valid_from date,
  add column if not exists bhyt_five_year date;

comment on column public.patient.bhyt_name is 'Name extracted from BHYT OCR.';
comment on column public.patient.bhyt_dob is 'Date of birth from BHYT OCR.';
comment on column public.patient.bhyt_gender is 'Gender from BHYT OCR.';
comment on column public.patient.bhyt_address is 'Address/organization from BHYT OCR.';
comment on column public.patient.bhyt_kcb is 'Registered healthcare facility (KCB) from BHYT OCR.';
comment on column public.patient.bhyt_kcb_code is 'Healthcare facility code from BHYT OCR.';
comment on column public.patient.bhyt_valid_from is 'Insurance valid-from date from BHYT OCR.';
comment on column public.patient.bhyt_five_year is 'Five-year milestone date from BHYT OCR.';
