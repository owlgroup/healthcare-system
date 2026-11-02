-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: Create proper functions to disable/enable exam_lock_guard trigger
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop old functions if exist
DROP FUNCTION IF EXISTS public.temp_encrypt_locked_exams();
DROP FUNCTION IF EXISTS public.temp_enable_exam_triggers();

-- Function to DISABLE exam_lock_guard trigger
CREATE OR REPLACE FUNCTION public.temp_encrypt_locked_exams()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE public.medical_examinations DISABLE TRIGGER exam_lock_guard;
  RETURN 'Trigger exam_lock_guard DISABLED. Run encryption now.';
END;
$$;

-- Function to RE-ENABLE exam_lock_guard trigger
CREATE OR REPLACE FUNCTION public.temp_enable_exam_triggers()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE public.medical_examinations ENABLE TRIGGER exam_lock_guard;
  RETURN 'Trigger exam_lock_guard RE-ENABLED.';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.temp_encrypt_locked_exams() TO authenticated;
GRANT EXECUTE ON FUNCTION public.temp_encrypt_locked_exams() TO service_role;
GRANT EXECUTE ON FUNCTION public.temp_enable_exam_triggers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.temp_enable_exam_triggers() TO service_role;
