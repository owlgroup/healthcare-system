/**
 * AI circuit breaker: pause AI features for 5 minutes after consecutive failures.
 */

const BREAKER_KEY = 'healthcare_ai_circuit_breaker';
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000;

type BreakerState = {
  failures: number;
  openUntil: number | null;
};

function loadState(): BreakerState {
  try {
    const raw = sessionStorage.getItem(BREAKER_KEY);
    if (raw) return JSON.parse(raw) as BreakerState;
  } catch {
    // ignore
  }
  return { failures: 0, openUntil: null };
}

function saveState(state: BreakerState): void {
  sessionStorage.setItem(BREAKER_KEY, JSON.stringify(state));
}

export function isAiCircuitOpen(): boolean {
  const state = loadState();
  if (state.openUntil && Date.now() < state.openUntil) return true;
  if (state.openUntil && Date.now() >= state.openUntil) {
    saveState({ failures: 0, openUntil: null });
  }
  return false;
}

export function recordAiFailure(): void {
  const state = loadState();
  const failures = state.failures + 1;
  if (failures >= FAILURE_THRESHOLD) {
    saveState({ failures, openUntil: Date.now() + COOLDOWN_MS });
  } else {
    saveState({ ...state, failures });
  }
}

export function recordAiSuccess(): void {
  saveState({ failures: 0, openUntil: null });
}

export function getAiCircuitCooldownRemaining(): number {
  const state = loadState();
  if (!state.openUntil) return 0;
  return Math.max(0, state.openUntil - Date.now());
}
