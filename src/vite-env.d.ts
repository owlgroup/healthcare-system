/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Public app origin for patient-facing links (mirror SITE_URL in .env). */
  readonly VITE_SITE_URL?: string;
  /** Healthcare STT + NLP backend (Module 5/6). */
  readonly VITE_STT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
