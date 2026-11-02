-- Admin CRUD for question_categories (Danh mục câu hỏi)
-- Missing from 20260613260000_master_data_admin_write.sql — caused RLS violations on insert/update.

create policy "question_categories_admin_write"
  on public.question_categories
  for all
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
