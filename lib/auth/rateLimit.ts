type LoginAttemptState = {
  count: number;
  lockedUntil: number;
};

const attempts = new Map<string, LoginAttemptState>();
const maxFailures = 5;
const lockMs = 60_000;

function currentAttempt(key: string, now: number): LoginAttemptState {
  const state = attempts.get(key);
  if (state === undefined || (state.lockedUntil > 0 && state.lockedUntil <= now)) {
    return { count: 0, lockedUntil: 0 };
  }
  return state;
}

export function getLoginLock(
  key: string,
  now = Date.now(),
): { locked: boolean; retryAfterSeconds: number } {
  const state = currentAttempt(key, now);
  const retryAfterSeconds = Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
  return {
    locked: state.lockedUntil > now,
    retryAfterSeconds,
  };
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const state = currentAttempt(key, now);
  const nextCount = state.count + 1;
  attempts.set(key, {
    count: nextCount,
    lockedUntil: nextCount >= maxFailures ? now + lockMs : 0,
  });
}

export function recordLoginSuccess(key: string): void {
  attempts.delete(key);
}

export function resetLoginAttemptsForTests(): void {
  attempts.clear();
}
