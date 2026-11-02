-- Fix duplicate function signatures for pre_consultation functions
-- Drop old functions without p_symptom_onset_at parameter

-- Drop old update_pre_consultation (without p_symptom_onset_at)
DROP FUNCTION IF EXISTS public.update_pre_consultation(
  UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT[], JSONB, TEXT, JSONB, JSONB, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

-- Drop old update_doctor_pre_consultation (without p_symptom_onset_at)
DROP FUNCTION IF EXISTS public.update_doctor_pre_consultation(
  UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT[], JSONB, TEXT, JSONB, JSONB, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);
