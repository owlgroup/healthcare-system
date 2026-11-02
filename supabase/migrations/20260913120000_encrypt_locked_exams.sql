-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Encrypt SOAP notes in locked medical examinations
-- Run this ONCE after running the encrypt-existing-data.ts script
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Create a temporary function to bypass trigger and encrypt data
CREATE OR REPLACE FUNCTION temp_encrypt_locked_exams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Disable all triggers on medical_examinations
  ALTER TABLE public.medical_examinations DISABLE TRIGGER ALL;

  -- Note: The actual encryption must be done from the application
  -- because PostgreSQL doesn't have the same encryption key.
  -- This function just disables/enables the trigger.

  RAISE NOTICE 'Triggers disabled. Run encryption from application now.';
END;
$$;

-- Step 2: Create function to re-enable triggers
CREATE OR REPLACE FUNCTION temp_enable_exam_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE public.medical_examinations ENABLE TRIGGER ALL;
  RAISE NOTICE 'Triggers re-enabled.';
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION temp_encrypt_locked_exams() TO service_role;
GRANT EXECUTE ON FUNCTION temp_enable_exam_triggers() TO service_role;

-- Instructions:
-- 1. Run: SELECT temp_encrypt_locked_exams();
-- 2. Run the Node.js encryption script
-- 3. Run: SELECT temp_enable_exam_triggers();
-- 4. Drop temp functions:
--    DROP FUNCTION temp_encrypt_locked_exams();
--    DROP FUNCTION temp_enable_exam_triggers();
