/**
 * Migration script to encrypt existing sensitive data in database
 * Run: npx tsx scripts/encrypt-existing-data.ts
 *
 * WARNING: Run this ONCE. Running again will double-encrypt data.
 * Backup your database before running!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENCRYPTION_KEY = process.env.VITE_ENCRYPTION_SECRET_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ENCRYPTION_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Crypto functions (Node.js compatible)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

async function deriveKey(secret: string): Promise<Buffer> {
  const crypto = await import('crypto');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      secret,
      'healthcare-salt-v1',
      100000,
      32,
      'sha256',
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
}

let cachedKey: Buffer | null = null;

async function getKey(): Promise<Buffer> {
  if (!cachedKey) {
    cachedKey = await deriveKey(ENCRYPTION_KEY);
  }
  return cachedKey;
}

async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return '';

  const crypto = await import('crypto');
  const key = await getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, encrypted, tag]);
  return combined.toString('base64');
}

function isAlreadyEncrypted(value: string): boolean {
  if (!value) return false;
  try {
    const decoded = Buffer.from(value, 'base64');
    // Check if it looks like our encrypted format (IV + data + tag)
    // Minimum length: 12 (IV) + 1 (data) + 16 (tag) = 29 bytes
    if (decoded.length >= 29 && value.match(/^[A-Za-z0-9+/]+=*$/)) {
      return true;
    }
  } catch {
    // Not base64, so not encrypted
  }
  return false;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SENSITIVE DATA FIELDS - Based on ISO 27799 & HL7 FHIR PHI Standards
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Categories of Protected Health Information (PHI):
 * 1. Patient Identifiers (PII) - CCCD, phone, address, email
 * 2. Clinical Data - Diagnoses, treatments, medications, SOAP notes
 * 3. Sensitive Health Info - Mental health, sexual health, substance use
 * 4. Contact Information - Emergency contacts, family info
 * 5. Insurance/Financial - Member ID, insurance numbers
 */
const TABLES_TO_ENCRYPT = [
  // ─── 1. PATIENT IDENTIFIERS (PII) ─────────────────────────────────────────
  {
    table: 'patient',
    fields: [
      'id_number',           // CCCD/Passport
      'phone_number',        // SĐT
      'residential_address', // Địa chỉ
      'member_id',           // Mã thẻ BHYT
      'bhyt_address',        // Địa chỉ trên thẻ BHYT
    ],
    idField: 'id',
  },
  {
    table: 'user_profiles',
    fields: ['phone'],       // SĐT nhân viên/bác sĩ
    idField: 'user_id',
  },

  // ─── 2. CLINICAL DATA (PHI - Protected Health Information) ────────────────
  {
    table: 'medical_examinations',
    fields: [
      's_text',              // Subjective - Triệu chứng chủ quan
      'o_text',              // Objective - Khám lâm sàng
      'a_text',              // Assessment - Đánh giá/chẩn đoán
      'p_text',              // Plan - Kế hoạch điều trị
    ],
    idField: 'id',
  },
  {
    table: 'pre_consultations',
    fields: [
      'chief_complaint',     // Lý do khám
      'surgical_history',    // Tiền sử phẫu thuật
      'otc_supplements',     // Thuốc/thực phẩm chức năng
      'smoking_frequency',   // Tần suất hút thuốc
      'alcohol_frequency',   // Tần suất uống rượu
    ],
    idField: 'id',
  },
  {
    table: 'patient_medical_charts',
    fields: [
      'clinical_note',           // Ghi chú lâm sàng
      'emergency_contact_phone', // SĐT liên hệ khẩn cấp
      'emergency_contact_name',  // Tên người liên hệ
    ],
    idField: 'id',
  },

  // ─── 3. SENSITIVE HEALTH INFO ─────────────────────────────────────────────
  {
    table: 'patient_sexual_health',
    fields: [
      'sexual_orientation',    // Xu hướng tính dục
      'sex_at_birth',          // Giới tính khi sinh
      'prep_pep_status',       // Tình trạng PrEP/PEP
      'last_std_test_result',  // Kết quả xét nghiệm STD
      'notes_for_doctor',      // Ghi chú cho bác sĩ
    ],
    idField: 'patient_user_id',
  },

  // ─── 4. EMERGENCY CONTACTS ────────────────────────────────────────────────
  {
    table: 'patient_emergency_contacts',
    fields: [
      'full_name',           // Tên người liên hệ
      'phone_number',        // SĐT liên hệ
      'relationship',        // Quan hệ
    ],
    idField: 'id',
  },

  // ─── 5. QUESTIONNAIRE RESPONSES (Mental Health Screening) ─────────────────
  {
    table: 'questionnaire_responses',
    fields: [
      'intervention',        // Can thiệp đề xuất
    ],
    idField: 'id',
  },

  // ─── 6. CONSULTATION RECORDINGS ───────────────────────────────────────────
  {
    table: 'consultation_recordings',
    fields: [
      'transcript',          // Bản ghi âm buổi khám
      'summary',             // Tóm tắt cuộc khám
    ],
    idField: 'id',
  },

  // ─── 7. SOAP EDIT HISTORY (Audit Trail) ───────────────────────────────────
  {
    table: 'soap_edit_delta',
    fields: [
      'old_value',           // Giá trị cũ
      'new_value',           // Giá trị mới
    ],
    idField: 'id',
  },
];

async function encryptTable(
  table: string,
  fields: string[],
  idField: string
): Promise<{ updated: number; skipped: number }> {
  console.log(`\n📦 Processing table: ${table}`);
  console.log(`   Fields to encrypt: ${fields.join(', ')}`);

  const { data: rows, error } = await supabase
    .from(table)
    .select(`${idField}, ${fields.join(', ')}`);

  if (error) {
    console.error(`   ❌ Error reading ${table}:`, error.message);
    return { updated: 0, skipped: 0 };
  }

  if (!rows || rows.length === 0) {
    console.log(`   ℹ️  No rows found`);
    return { updated: 0, skipped: 0 };
  }

  console.log(`   Found ${rows.length} rows`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const updates: Record<string, string> = {};
    let needsUpdate = false;

    for (const field of fields) {
      const value = row[field];
      if (value && typeof value === 'string' && !isAlreadyEncrypted(value)) {
        updates[field] = await encrypt(value);
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from(table)
        .update(updates)
        .eq(idField, row[idField]);

      if (updateError) {
        console.error(`   ❌ Error updating row ${row[idField]}:`, updateError.message);
      } else {
        updated++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`   ✅ Updated: ${updated}, Skipped (already encrypted or empty): ${skipped}`);
  return { updated, skipped };
}

async function main() {
  console.log('🔐 Starting encryption migration...');
  console.log('=====================================');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Encryption key: ${ENCRYPTION_KEY.substring(0, 8)}...`);
  console.log('');

  // Confirm before proceeding
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('⚠️  Have you backed up your database? (yes/no): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Migration cancelled. Please backup your database first.');
    process.exit(1);
  }

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const { table, fields, idField } of TABLES_TO_ENCRYPT) {
    const { updated, skipped } = await encryptTable(table, fields, idField);
    totalUpdated += updated;
    totalSkipped += skipped;
  }

  console.log('\n=====================================');
  console.log('🎉 Migration complete!');
  console.log(`   Total rows updated: ${totalUpdated}`);
  console.log(`   Total rows skipped: ${totalSkipped}`);
  console.log('\n⚠️  Remember to update your application code to decrypt data when reading!');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
