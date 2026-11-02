export const PIN_MAX_ATTEMPTS = 3;

/** Remaining tries after `failedCount` wrong PINs have been recorded. */
export function remainingPinAttempts(failedCount: number): number {
  return Math.max(0, PIN_MAX_ATTEMPTS - failedCount);
}

export function formatPinInvalidMessage(attemptsRemaining: number): string {
  return `Mã PIN không đúng. Còn ${attemptsRemaining} lần thử.`;
}
