-- Medical chart / bệnh án: dữ liệu hiển thị Provider Portal (overview, vitals, labs, emergency contact, clinical note).
-- RLS: mọi user đã đăng nhập có thể đọc/ghi (phù hợp môi trường demo; production nên tách role provider/patient).

create table public.patient_medical_charts (
  id uuid primary key default gen_random_uuid(),

  -- Liên kết bệnh nhân (user đăng nhập phía patient)
  patient_user_id uuid not null unique references auth.users (id) on delete cascade,

  -- Header / hồ sơ
  display_patient_id text,
  full_name text,
  pronouns text,
  date_of_birth date,
  status text default 'Stable',
  last_visit_at timestamptz,
  last_visit_label text,

  blood_type text,
  height_cm numeric,
  weight_kg numeric,

  -- JSON: mảng chuỗi, ví dụ ["Type 2 Diabetes", "Mild Hypertension"]
  diagnoses jsonb not null default '[]'::jsonb,
  -- JSON: mảng chuỗi, ví dụ ["Metformin 500mg", "Lisinopril 10mg"]
  medications jsonb not null default '[]'::jsonb,
  allergies jsonb not null default '[]'::jsonb,

  clinical_note text,

  heart_rate_bpm integer,
  temperature_f numeric(5, 2),
  blood_pressure_systolic integer,
  blood_pressure_diastolic integer,

  -- JSON: [{ "name": "Blood Panel", "date": "2024-01-12" }]
  recent_labs jsonb not null default '[]'::jsonb,

  emergency_contact_name text,
  emergency_contact_phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patient_medical_charts is 'Bệnh án / medical record summary for provider portal.';

create index patient_medical_charts_patient_user_id_idx on public.patient_medical_charts (patient_user_id);

create trigger patient_medical_charts_set_updated_at
  before update on public.patient_medical_charts
  for each row execute function public.set_updated_at();

alter table public.patient_medical_charts enable row level security;

-- Demo: mọi user đã xác thực đều xem/sửa được (thay bằng policy theo role provider khi triển khai thật)
create policy "medical_charts_select_authenticated"
  on public.patient_medical_charts for select
  to authenticated
  using (true);

create policy "medical_charts_insert_authenticated"
  on public.patient_medical_charts for insert
  to authenticated
  with check (true);

create policy "medical_charts_update_authenticated"
  on public.patient_medical_charts for update
  to authenticated
  using (true)
  with check (true);

create policy "medical_charts_delete_authenticated"
  on public.patient_medical_charts for delete
  to authenticated
  using (true);
