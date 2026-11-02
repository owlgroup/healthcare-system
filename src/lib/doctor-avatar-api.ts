import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return 'Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.';
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return 'Ảnh tối đa 5MB.';
  }
  return null;
}

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadDoctorAvatar(
  userId: string,
  file: File,
): Promise<{ storagePath: string }> {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const ext = extensionForMime(file.type);
  const storagePath = `${userId}/avatar_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, file, { upsert: true, cacheControl: '3600', contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error: fnError } = await supabase.functions.invoke('update-doctor-avatar', {
    body: { avatar_path: storagePath },
  });

  if (fnError || data?.error) {
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
    throw new Error(fnError?.message || data?.error || 'Lỗi cập nhật avatar');
  }

  return { storagePath };
}

export async function createAvatarSignedUrl(
  storagePath: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!storagePath?.trim()) return null;
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
