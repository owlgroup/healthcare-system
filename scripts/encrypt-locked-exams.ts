/**
 * Encrypt locked medical examinations by temporarily disabling the trigger
 * Run: npx tsx scripts/encrypt-locked-exams.ts
 *
 * This script bypasses the EXAM_LOCKED trigger to encrypt SOAP notes
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' },
  auth: { persistSession: false },
});

// Crypto functions
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

async function deriveKey(secret: string): Promise<Buffer> {
  const crypto = await import('crypto');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(secret, 'healthcare-salt-v1', 100000, 32, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
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
    if (decoded.length >= 29 && value.match(/^[A-Za-z0-9+/]+=*$/)) {
      return true;
    }
  } catch {
    // Not encrypted
  }
  return false;
}

async function main() {
  console.log('🔐 Encrypting LOCKED medical examinations...');
  console.log('============================================\n');

  // Step 1: Disable the trigger using RPC function
  console.log('1️⃣  Disabling EXAM_LOCKED trigger...');
  const { error: disableError } = await supabase.rpc('temp_encrypt_locked_exams');

  if (disableError) {
    console.log('   ⚠️  RPC not found. Please run migration first:');
    console.log('      npx supabase db push');
    console.log('   Or run in Supabase SQL Editor:');
    console.log('      SELECT temp_encrypt_locked_exams();');
    console.log('\n   Attempting direct update anyway...');
  } else {
    console.log('   ✅ Trigger disabled');
  }

  // Step 2: Fetch all medical examinations
  console.log('\n2️⃣  Fetching medical examinations...');
  const { data: exams, error: fetchError } = await supabase
    .from('medical_examinations')
    .select('id, s_text, o_text, a_text, p_text, status');

  if (fetchError) {
    console.error('   ❌ Error fetching:', fetchError.message);
    return;
  }

  console.log(`   Found ${exams?.length || 0} records`);

  // Step 3: Encrypt each record using raw SQL
  console.log('\n3️⃣  Encrypting SOAP notes...');

  let updated = 0;
  let skipped = 0;

  for (const exam of exams || []) {
    const updates: Record<string, string> = {};
    let needsUpdate = false;

    for (const field of ['s_text', 'o_text', 'a_text', 'p_text']) {
      const value = exam[field as keyof typeof exam] as string;
      if (value && typeof value === 'string' && !isAlreadyEncrypted(value)) {
        updates[field] = await encrypt(value);
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      // Direct update - will work if trigger is disabled
      const { error: updateError } = await supabase
        .from('medical_examinations')
        .update(updates)
        .eq('id', exam.id);

      if (updateError) {
        console.log(`   ❌ ${exam.id} (${exam.status}): ${updateError.message}`);
      } else {
        console.log(`   ✅ ${exam.id} (${exam.status}): encrypted`);
        updated++;
      }
    } else {
      skipped++;
    }
  }

  // Step 4: Re-enable trigger
  console.log('\n4️⃣  Re-enabling trigger...');
  const { error: enableError } = await supabase.rpc('temp_enable_exam_triggers');
  if (enableError) {
    console.log('   ⚠️  Run manually in Supabase SQL Editor:');
    console.log('      SELECT temp_enable_exam_triggers();');
  } else {
    console.log('   ✅ Trigger re-enabled');
  }

  console.log('\n============================================');
  console.log(`🎉 Complete! Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(console.error);
