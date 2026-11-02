/** OCR service for Vietnamese CCCD (Citizen ID). */

import type { OnboardingFormData } from "@/hooks/useOnboardingForm";

export type CccdParsed = {
  id?: string;
  name?: string;
  dob?: string;
  gender?: string;
  nationality?: string;
  ethnicity?: string;
  hometown?: string;
  address?: string;
  expiry?: string;
  issued?: string;
  extra?: string;
};

export type CccdOcrResponse = {
  type?: string;
  parsed?: CccdParsed;
  raw?: string;
  confidence?: number;
};

export type OcrQualityResult = {
  isLowQuality: boolean;
  confidence: number;
  filledFieldCount: number;
  totalExpectedFields: number;
  message?: string;
};

export type BhytParsed = {
  id?: string;
  name?: string;
  dob?: string;
  gender?: string;
  address?: string;
  kcb?: string;
  kcb_code?: string;
  valid_from?: string;
  five_year?: string;
};

export type BhytOcrResponse = {
  type?: string;
  parsed?: BhytParsed;
  raw?: string;
  confidence?: number;
};

const LOW_QUALITY_THRESHOLD = 70;
const CCCD_EXPECTED_FIELDS = ["id", "name", "dob", "gender", "address"] as const;
const BHYT_EXPECTED_FIELDS = ["id", "name", "dob", "kcb"] as const;

/** Check OCR quality based on confidence and filled fields. */
export function checkCccdOcrQuality(response: CccdOcrResponse): OcrQualityResult {
  const parsed = response.parsed ?? {};
  const confidence = response.confidence ?? 0;

  const filledFields = CCCD_EXPECTED_FIELDS.filter(
    (field) => parsed[field]?.trim()
  );
  const filledFieldCount = filledFields.length;
  const totalExpectedFields = CCCD_EXPECTED_FIELDS.length;

  const inferredConfidence = confidence > 0
    ? confidence
    : Math.round((filledFieldCount / totalExpectedFields) * 100);

  const isLowQuality = inferredConfidence < LOW_QUALITY_THRESHOLD || filledFieldCount < 2;

  return {
    isLowQuality,
    confidence: inferredConfidence,
    filledFieldCount,
    totalExpectedFields,
    message: isLowQuality
      ? "Ảnh không đủ rõ. Vui lòng chụp lại hoặc nhập thủ công."
      : undefined,
  };
}

/** Check BHYT OCR quality based on confidence and filled fields. */
export function checkBhytOcrQuality(response: BhytOcrResponse): OcrQualityResult {
  const parsed = response.parsed ?? {};
  const confidence = response.confidence ?? 0;

  const filledFields = BHYT_EXPECTED_FIELDS.filter(
    (field) => parsed[field]?.trim()
  );
  const filledFieldCount = filledFields.length;
  const totalExpectedFields = BHYT_EXPECTED_FIELDS.length;

  const inferredConfidence = confidence > 0
    ? confidence
    : Math.round((filledFieldCount / totalExpectedFields) * 100);

  const isLowQuality = inferredConfidence < LOW_QUALITY_THRESHOLD || filledFieldCount < 2;

  return {
    isLowQuality,
    confidence: inferredConfidence,
    filledFieldCount,
    totalExpectedFields,
    message: isLowQuality
      ? "Ảnh BHYT không đủ rõ. Vui lòng chụp lại hoặc nhập thủ công."
      : undefined,
  };
}

function getOcrBaseUrl(): string {
  const raw = import.meta.env.VITE_OCR_CCCD_URL;
  const base = (typeof raw === "string" && raw.trim() ? raw.trim() : "http://localhost:3000").replace(/\/$/, "");
  return base;
}

function getOcrServiceUrl(): string {
  const raw = import.meta.env.VITE_OCR_SERVICE_URL;
  return (typeof raw === "string" && raw.trim() ? raw.trim() : "https://ocr.187-127-103-1.nip.io").replace(/\/$/, "");
}

/** Call the OCR service for a single image slot. */
export async function fetchOcrSingle(
  file: File,
  type: "cccd" | "bhyt",
  slot: "front" = "front",
): Promise<CccdOcrResponse & BhytOcrResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  formData.append(slot, file);

  const url = `${getOcrServiceUrl()}/ocr`;
  const res = await fetch(url, { method: "POST", body: formData });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `OCR request failed (${res.status})`);
  }

  return (await res.json()) as CccdOcrResponse & BhytOcrResponse;
}

/** Convert dd/mm/yyyy (or d/m/yyyy) to yyyy-mm-dd for HTML date inputs. */
export function parseDdMmYyyyToIso(value: string): string {
  const t = value.trim();
  if (!t) return "";
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Vietnamese ID: family name usually first token → legal last name;
 * remainder → legal first name (given + middle).
 */
export function splitVietnameseFullName(fullName: string): { legalFirstName: string; legalLastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { legalFirstName: "", legalLastName: "" };
  if (parts.length === 1) return { legalFirstName: "", legalLastName: parts[0] };
  return {
    legalLastName: parts[0],
    legalFirstName: parts.slice(1).join(" "),
  };
}

export async function fetchCccdOcr(
  front: File,
  back: File,
  options?: { extraImage?: File | null },
): Promise<CccdOcrResponse> {
  const formData = new FormData();
  formData.append("front", front);
  formData.append("back", back);
  if (options?.extraImage) {
    formData.append("image", options.extraImage);
  }

  const url = `${getOcrBaseUrl()}/public/ocr/cccd`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `OCR request failed (${res.status})`);
  }

  return (await res.json()) as CccdOcrResponse;
}

export async function fetchBhytOcr(image: File): Promise<BhytOcrResponse> {
  const formData = new FormData();
  formData.append("image", image);

  const url = `${getOcrBaseUrl()}/public/ocr/bhyt`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `BHYT OCR request failed (${res.status})`);
  }

  return (await res.json()) as BhytOcrResponse;
}

/** Normalize OCR gender text to Nam / Nữ for admin patient forms. */
export function normalizeOcrGender(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  if (t === "nam" || t === "male" || t === "m") return "Nam";
  if (t === "nữ" || t === "nu" || t === "female" || t === "f") return "Nữ";
  return "";
}

/** Maps OCR `parsed` into onboarding field updates (user can edit after). */
export function mapCccdParsedToFormUpdates(parsed: CccdParsed): {
  identity: Partial<OnboardingFormData["identity"]>;
  personal: Partial<OnboardingFormData["personal"]>;
  gender?: string;
} {
  const identity: Partial<OnboardingFormData["identity"]> = {};
  const personal: Partial<OnboardingFormData["personal"]> = {};

  if (parsed.id?.trim()) identity.idNumber = parsed.id.trim();
  if (parsed.address?.trim()) identity.residentialAddress = parsed.address.trim();
  const expIso = parseDdMmYyyyToIso(parsed.expiry ?? "");
  if (expIso) identity.expirationDate = expIso;
  const issuedIso = parseDdMmYyyyToIso(parsed.issued ?? "");
  if (issuedIso) identity.issuedDate = issuedIso;
  if (parsed.extra?.trim()) identity.issuer = parsed.extra.trim();

  if (parsed.name?.trim()) {
    const { legalFirstName, legalLastName } = splitVietnameseFullName(parsed.name);
    if (legalFirstName) personal.legalFirstName = legalFirstName;
    if (legalLastName) personal.legalLastName = legalLastName;
  }

  const dobIso = parseDdMmYyyyToIso(parsed.dob ?? "");
  if (dobIso) personal.dateOfBirth = dobIso;

  const gender = parsed.gender?.trim() ? normalizeOcrGender(parsed.gender) : undefined;

  return { identity, personal, gender };
}

export function mapBhytParsedToInsuranceUpdates(parsed: BhytParsed): Partial<OnboardingFormData["insurance"]> {
  const updates: Partial<OnboardingFormData["insurance"]> = {};

  if (parsed.id?.trim()) updates.memberId = parsed.id.trim();
  if (parsed.kcb?.trim()) {
    updates.provider = parsed.kcb.trim();
  } else if (parsed.address?.trim()) {
    updates.provider = parsed.address.trim();
  }
  if (parsed.name?.trim()) updates.bhytName = parsed.name.trim();
  if (parsed.gender?.trim()) updates.bhytGender = parsed.gender.trim();
  if (parsed.address?.trim()) updates.bhytAddress = parsed.address.trim();
  if (parsed.kcb?.trim()) updates.bhytKcb = parsed.kcb.trim();
  if (parsed.kcb_code?.trim()) updates.bhytKcbCode = parsed.kcb_code.trim();

  const dobIso = parseDdMmYyyyToIso(parsed.dob ?? "");
  if (dobIso) updates.bhytDob = dobIso;
  const validFromIso = parseDdMmYyyyToIso(parsed.valid_from ?? "");
  if (validFromIso) updates.bhytValidFrom = validFromIso;
  const fiveYearIso = parseDdMmYyyyToIso(parsed.five_year ?? "");
  if (fiveYearIso) updates.bhytFiveYear = fiveYearIso;

  return updates;
}

/** Treat whitespace-only strings as empty for OCR auto-fill. */
export function isOcrTargetFieldEmpty(value: string | undefined | null): boolean {
  return !String(value ?? "").trim();
}

/** Keep existing non-empty value; otherwise use OCR suggestion. */
export function coalesceOcrField(existing: string, incoming: string | undefined): string {
  if (!isOcrTargetFieldEmpty(existing)) return existing;
  const trimmed = incoming?.trim();
  return trimmed ?? existing;
}

/** Merge OCR partial updates into string fields — fill empty only, never overwrite. */
export function mergeOcrFillEmpty<T extends Record<string, string>>(
  current: T,
  updates: Partial<T>,
): T {
  const next = { ...current };
  for (const key of Object.keys(updates) as (keyof T)[]) {
    const incoming = updates[key];
    if (incoming === undefined) continue;
    next[key] = coalesceOcrField(current[key], incoming as string);
  }
  return next;
}

/** Apply CCCD OCR parsed data to a flat form record (fill-empty-only). */
export function applyCccdParsedFillEmpty<T extends Record<string, string>>(
  current: T,
  parsed: CccdParsed,
  genderField: keyof T = "gender" as keyof T,
): T {
  const { identity, personal, gender } = mapCccdParsedToFormUpdates(parsed);
  const updates = {
    idNumber: identity.idNumber,
    expirationDate: identity.expirationDate,
    residentialAddress: identity.residentialAddress,
    issuedDate: identity.issuedDate,
    issuer: identity.issuer,
    legalFirstName: personal.legalFirstName,
    legalLastName: personal.legalLastName,
    dateOfBirth: personal.dateOfBirth,
    ...(gender !== undefined ? { [genderField]: gender } : {}),
  } as Partial<T>;
  return mergeOcrFillEmpty(current, updates);
}

/** Apply BHYT OCR parsed data to a form/insurance record (fill-empty-only). */
export function applyBhytParsedFillEmpty<T extends Record<string, string>>(
  current: T,
  parsed: BhytParsed,
): T {
  return mergeOcrFillEmpty(current, mapBhytParsedToInsuranceUpdates(parsed) as Partial<T>);
}
