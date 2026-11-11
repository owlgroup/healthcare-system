/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Public app origin for patient-facing links (mirror SITE_URL in .env). */
  readonly VITE_SITE_URL?: string;
  /** Healthcare STT + NLP backend (Module 5/6). */
  readonly VITE_STT_API_URL?: string;
  /** OCR service (POST /ocr for CCCD/BHYT, POST /ocr/phieu for exam forms). */
  readonly VITE_OCR_SERVICE_URL?: string;
  /** Legacy OCR backend for /public/ocr/cccd and /public/ocr/bhyt. */
  readonly VITE_OCR_CCCD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
