const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDobValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function isValidIsoDate(value: string): boolean {
  const normalized = normalizeDobValue(value);
  if (!normalized || !ISO_DATE_RE.test(normalized)) return false;
  const [y, m, d] = normalized.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}
