const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%&*";
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

/** AC7: mật khẩu tạm 12 ký tự */
export function generateTempPassword(length = 12): string {
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint8Array(1))[0] % chars.length];
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  const rest: string[] = [];
  for (let i = required.length; i < length; i++) {
    rest.push(pick(ALL));
  }
  const combined = [...required, ...rest];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint8Array(1))[0] % (i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}
