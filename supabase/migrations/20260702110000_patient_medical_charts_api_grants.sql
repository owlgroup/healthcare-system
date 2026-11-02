-- Expose patient_medical_charts to PostgREST (fixes 404 when table exists but API cache/grants missing)

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_medical_charts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_medical_charts TO service_role;

GRANT EXECUTE ON FUNCTION public.upsert_my_health_chart() TO authenticated;

NOTIFY pgrst, 'reload schema';
