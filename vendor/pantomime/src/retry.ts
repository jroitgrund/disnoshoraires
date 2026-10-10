import { sleep } from "./async.ts";
import { BlockedError } from "./block.ts";
import { type Rng, uniform } from "./random.ts";

/**
 * What to clear before the next attempt.
 * - `none`: keep everything.
 * - `resolve`: keep the profile; load the page again so the browser solves the challenge.
 * - `profile`: delete the whole profile (cookies, storage, cache) and relaunch.
 */
export type Reset = "none" | "resolve" | "profile";

export interface RetryPlan {
  readonly delayMs: number;
  readonly reset: Reset;
}

export interface RetryState {
  readonly attempt: number;
  readonly challenges: number;
  readonly profileResets: number;
}

const MAX_ATTEMPTS = 4;

/** Next step after `error`, or `null` to give up. */
export function planRetry(
  error: BlockedError,
  state: RetryState,
  rng: Rng,
): RetryPlan | null {
  if (state.attempt >= MAX_ATTEMPTS) {
    return null;
  }
  switch (error.failure) {
    case "ip-banned":
      return null;
    case "rate-limited":
      return {
        delayMs: Math.max(
          error.retryAfterMs ?? 0,
          backoff(state.attempt, 30_000, 300_000, rng),
        ),
        reset: "none",
      };
    case "unavailable":
      return state.attempt >= 2
        ? null
        : {
            delayMs: backoff(state.attempt, 5_000, 60_000, rng),
            reset: "none",
          };
    case "challenge":
      if (state.challenges === 0) {
        return { delayMs: uniform(rng, 2_000, 5_000), reset: "resolve" };
      }
      // A challenge that comes back after a fresh solve means the session is flagged.
      return flagged(state, rng);
    case "flagged":
      return flagged(state, rng);
  }
}

/** Retries `fn` on `BlockedError` as `planRetry` decides. `onRetry` applies the reset. */
export async function withRetry<T>(
  fn: (state: RetryState) => Promise<T>,
  rng: Rng,
  onRetry: (
    error: BlockedError,
    plan: RetryPlan,
    state: RetryState,
  ) => Promise<void>,
  state: RetryState = { attempt: 0, challenges: 0, profileResets: 0 },
): Promise<T> {
  try {
    return await fn(state);
  } catch (error) {
    const plan =
      error instanceof BlockedError ? planRetry(error, state, rng) : null;
    if (plan == null || !(error instanceof BlockedError)) {
      throw error;
    }
    const next = {
      attempt: state.attempt + 1,
      challenges: state.challenges + (error.failure === "challenge" ? 1 : 0),
      profileResets: state.profileResets + (plan.reset === "profile" ? 1 : 0),
    };
    await onRetry(error, plan, next);
    await sleep(plan.delayMs);
    return withRetry(fn, rng, onRetry, next);
  }
}

/** One new profile per call: a second block on a clean profile will not clear with a third. */
function flagged(state: RetryState, rng: Rng): RetryPlan | null {
  return state.profileResets >= 1
    ? null
    : {
        delayMs: backoff(state.attempt, 30_000, 120_000, rng),
        reset: "profile",
      };
}

/** Exponential backoff with equal jitter: half fixed, half random. */
function backoff(
  attempt: number,
  baseMs: number,
  maxMs: number,
  rng: Rng,
): number {
  const ceiling = Math.min(maxMs, baseMs * 2 ** attempt);
  return ceiling / 2 + uniform(rng, 0, ceiling / 2);
}
