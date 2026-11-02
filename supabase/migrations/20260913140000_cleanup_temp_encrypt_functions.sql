-- ═══════════════════════════════════════════════════════════════════════════
-- Cleanup: Remove temporary encryption helper functions
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.temp_encrypt_locked_exams();
DROP FUNCTION IF EXISTS public.temp_enable_exam_triggers();
