/** Cross-check personal identity fields extracted from CCCD vs BHYT. */

import { parseDdMmYyyyToIso } from "@/lib/cccd-ocr";

/** Name mismatch ratio above this value is treated as a conflict. */
export const NAME_MISMATCH_THRESHOLD = 0.2;

export type CccdBhytCompareInput = {
  cccdName: string;
  cccdDob: string;
  bhytName: string;
  bhytDob: string;
};

export type CccdBhytCompareResult = {
  hasMismatch: boolean;
  nameMismatch: boolean;
  dobMismatch: boolean;
  nameMismatchRatio: number;
  skipped: boolean;
  cccdName: string;
  bhytName: string;
  cccdDob: string;
  bhytDob: string;
};

function isBlank(value: string | undefined | null): boolean {
  return !String(value ?? "").trim();
}

/** CCCD full name: family name (legalLastName) then given name (legalFirstName). */
export function joinCccdFullName(legalLastName: string, legalFirstName: string): string {
  return `${legalLastName} ${legalFirstName}`.replace(/\s+/g, " ").trim();
}

/** Uppercase, strip Vietnamese diacritics, collapse whitespace. */
export function normalizeVnName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function tokenSorted(normalized: string): string {
  return normalized.split(" ").filter(Boolean).sort().join(" ");
}

function ratioFor(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return levenshtein(a, b) / maxLen;
}

/** 0 = identical after normalize; 1 = completely different. Uses the better of as-is vs token-sorted. */
export function nameMismatchRatio(left: string, right: string): number {
  const a = normalizeVnName(left);
  const b = normalizeVnName(right);
  if (!a && !b) return 0;
  if (!a || !b) return 1;
  return Math.min(ratioFor(a, b), ratioFor(tokenSorted(a), tokenSorted(b)));
}

function normalizeDob(value: string): string {
  return parseDdMmYyyyToIso(value.trim());
}

export function compareCccdBhytIdentity(input: CccdBhytCompareInput): CccdBhytCompareResult {
  const cccdName = input.cccdName.trim();
  const bhytName = input.bhytName.trim();
  const cccdDob = input.cccdDob.trim();
  const bhytDob = input.bhytDob.trim();

  const bhytEmpty = isBlank(bhytName) && isBlank(bhytDob);
  if (bhytEmpty) {
    return {
      hasMismatch: false,
      nameMismatch: false,
      dobMismatch: false,
      nameMismatchRatio: 0,
      skipped: true,
      cccdName,
      bhytName,
      cccdDob,
      bhytDob,
    };
  }

  const canCompareName = !isBlank(cccdName) && !isBlank(bhytName);
  const ratio = canCompareName ? nameMismatchRatio(cccdName, bhytName) : 0;
  const nameMismatch = canCompareName && ratio > NAME_MISMATCH_THRESHOLD;

  const canCompareDob = !isBlank(cccdDob) && !isBlank(bhytDob);
  const isoCccd = canCompareDob ? normalizeDob(cccdDob) : "";
  const isoBhyt = canCompareDob ? normalizeDob(bhytDob) : "";
  const dobMismatch = canCompareDob && (!isoCccd || !isoBhyt || isoCccd !== isoBhyt);

  return {
    hasMismatch: nameMismatch || dobMismatch,
    nameMismatch,
    dobMismatch,
    nameMismatchRatio: ratio,
    skipped: false,
    cccdName,
    bhytName,
    cccdDob,
    bhytDob,
  };
}
