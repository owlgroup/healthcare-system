/** Generate a random 6-digit sign PIN (100000–999999). */
export function generateSignPin(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const n = 100_000 + (arr[0] % 900_000);
  return String(n);
}
