/** Shared CCCD identity required-field validation for all profile forms. */

export const CCCD_REQUIRED_EMPTY = "Vui lòng nhập";

export const CCCD_REQUIRED_KEYS = [
  "idNumber",
  "expirationDate",
  "residentialAddress",
  "issuedDate",
  "issuer",
] as const;

export type CccdRequiredKey = (typeof CCCD_REQUIRED_KEYS)[number];

export type CccdRequiredFields = Record<CccdRequiredKey, string>;

export function validateCccdRequired(
  fields: CccdRequiredFields,
): Partial<Record<CccdRequiredKey, string>> {
  const errs: Partial<Record<CccdRequiredKey, string>> = {};
  for (const key of CCCD_REQUIRED_KEYS) {
    if (!fields[key]?.trim()) errs[key] = CCCD_REQUIRED_EMPTY;
  }
  return errs;
}
