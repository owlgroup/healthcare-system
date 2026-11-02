/** Frontend validation for CCCD / BHYT image uploads (PAT-PRP-005). */

export const ID_IMAGE_TYPE_ERROR = "Chỉ chấp nhận file ảnh (JPG, PNG)";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];

function hasAllowedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** True when the file is a JPG/JPEG/PNG image (MIME, or extension if MIME is empty). */
export function isAllowedIdImageFile(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  if (mime) return ALLOWED_MIME_TYPES.has(mime);
  return hasAllowedExtension(file.name);
}
