export const PIN_LENGTH = 6;

/**
 * Normalize typed or pasted PIN text to digits only, capped at PIN_LENGTH.
 * Digits are extracted before capping because the profile page shows the PIN
 * as "908 358" — a native maxLength would cut the pasted text to "908 35".
 */
export function sanitizePinInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PIN_LENGTH);
}
