/**
 * Encryption/Decryption utility for sensitive data (CCCD, SĐT, medical records)
 * Uses AES-256-GCM (authenticated encryption)
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;
const DECRYPT_FAILURE_PLACEHOLDER = '[Lỗi giải mã]';
/** IV (12) + GCM tag (16) = 28 bytes → ~40 base64 chars. */
const MIN_CIPHERTEXT_BASE64_LENGTH = 40;

/**
 * AES-GCM blobs stored as base64 (no whitespace). Used to avoid showing
 * ciphertext in patient UI and to skip decrypting already-plaintext fields.
 */
export function looksLikeEncryptedToken(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < MIN_CIPHERTEXT_BASE64_LENGTH) return false;
  if (/\s/.test(trimmed)) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed);
}

/** Hide ciphertext / decrypt errors in patient-facing UI. */
export function sanitizeSensitiveDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  const trimmed = value.trim();
  if (trimmed === DECRYPT_FAILURE_PLACEHOLDER || looksLikeEncryptedToken(trimmed)) {
    return '—';
  }
  return value;
}

/** Empty string instead of ciphertext so form inputs stay editable. */
export function sanitizeSensitiveInput(value: string | null | undefined): string {
  const display = sanitizeSensitiveDisplay(value);
  return display === '—' ? '' : display;
}

let cryptoKey: CryptoKey | null = null;

function getSecretKey(): string {
  const key = import.meta.env.VITE_ENCRYPTION_SECRET_KEY;
  if (!key) {
    throw new Error('VITE_ENCRYPTION_SECRET_KEY is not defined in environment');
  }
  return key;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('healthcare-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

async function getCryptoKey(): Promise<CryptoKey> {
  if (!cryptoKey) {
    cryptoKey = await deriveKey(getSecretKey());
  }
  return cryptoKey;
}

/**
 * Encrypt sensitive data
 * @param plaintext - Data to encrypt (CCCD, phone, medical info)
 * @returns Base64 encoded ciphertext (IV + encrypted data + auth tag)
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  if (looksLikeEncryptedToken(plaintext)) return plaintext;

  const key = await getCryptoKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoder.encode(plaintext)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt sensitive data
 * @param ciphertext - Base64 encoded encrypted data
 * @returns Original plaintext
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) return '';
  if (!looksLikeEncryptedToken(ciphertext)) return ciphertext;

  try {
    const key = await getCryptoKey();
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    console.error('Decryption failed - data may be corrupted or key mismatch');
    return DECRYPT_FAILURE_PLACEHOLDER;
  }
}

/**
 * Encrypt multiple fields in an object
 * @param data - Object with sensitive fields
 * @param fields - Array of field names to encrypt
 */
export async function encryptFields<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...data };
  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'string' && value) {
      (result as Record<string, unknown>)[field as string] = await encrypt(value);
    }
  }
  return result;
}

/**
 * Decrypt multiple fields in an object
 * @param data - Object with encrypted fields
 * @param fields - Array of field names to decrypt
 */
export async function decryptFields<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...data };
  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'string' && value) {
      (result as Record<string, unknown>)[field as string] = await decrypt(value);
    }
  }
  return result;
}

/**
 * Mask sensitive data for display (partial reveal)
 * @param value - Decrypted value
 * @param type - Type of data for appropriate masking
 */
export function maskSensitiveData(
  value: string,
  type: 'cccd' | 'phone' | 'medical'
): string {
  if (!value) return '';

  switch (type) {
    case 'cccd':
      // Show last 4 digits: ********1234
      return value.length > 4
        ? '*'.repeat(value.length - 4) + value.slice(-4)
        : value;

    case 'phone':
      // Show last 3 digits: *******789
      return value.length > 3
        ? '*'.repeat(value.length - 3) + value.slice(-3)
        : value;

    case 'medical':
      // Show first 10 chars + ...
      return value.length > 10
        ? value.slice(0, 10) + '...'
        : value;

    default:
      return '***';
  }
}

/**
 * Mask email for display: t•••••••3@gmail.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '—';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0] || ''}${'•'.repeat(6)}@${domain}`;
  }
  return `${local[0]}${'•'.repeat(Math.min(local.length - 2, 7))}${local.slice(-1)}@${domain}`;
}

/**
 * Mask date of birth for display: ••/••/1994
 */
export function maskDob(dob: string): string {
  if (!dob) return '—';
  // Handle various date formats
  const match = dob.match(/(\d{4})/);
  if (match) {
    return `••/••/${match[1]}`;
  }
  return '••/••/••••';
}

// Sensitive field definitions for the healthcare system (ISO 27799 & HL7 FHIR)
export const SENSITIVE_FIELDS = {
  // Patient identifiers (PII)
  patient: [
    'id_number',
    'phone_number',
    'residential_address',
    'member_id',
    'bhyt_address',
  ] as const,

  // SOAP notes (PHI)
  medical_examinations: [
    's_text',
    'o_text',
    'a_text',
    'p_text',
  ] as const,

  // Pre-consultation data
  pre_consultations: [
    'chief_complaint',
    'surgical_history',
    'otc_supplements',
    'smoking_frequency',
    'alcohol_frequency',
  ] as const,

  // Emergency contacts
  patient_emergency_contacts: [
    'full_name',
    'phone_number',
    'relationship',
  ] as const,

  // Sexual health (highly sensitive)
  patient_sexual_health: [
    'sexual_orientation',
    'sex_at_birth',
    'prep_pep_status',
    'last_std_test_result',
    'notes_for_doctor',
  ] as const,

  // User profiles
  user_profiles: ['phone'] as const,

  // Medical charts
  patient_medical_charts: [
    'clinical_note',
    'emergency_contact_phone',
    'emergency_contact_name',
  ] as const,
} as const;

export type SensitiveTable = keyof typeof SENSITIVE_FIELDS;

/**
 * Decrypt a single row from database
 */
export async function decryptRow<T extends Record<string, unknown>>(
  row: T,
  table: SensitiveTable
): Promise<T> {
  const fields = SENSITIVE_FIELDS[table] as readonly string[];
  return decryptFields(row, fields as (keyof T)[]);
}

/**
 * Decrypt multiple rows from database
 */
export async function decryptRows<T extends Record<string, unknown>>(
  rows: T[],
  table: SensitiveTable
): Promise<T[]> {
  return Promise.all(rows.map(row => decryptRow(row, table)));
}

/**
 * Encrypt a row before saving to database
 */
export async function encryptRow<T extends Record<string, unknown>>(
  row: T,
  table: SensitiveTable
): Promise<T> {
  const fields = SENSITIVE_FIELDS[table] as readonly string[];
  return encryptFields(row, fields as (keyof T)[]);
}
