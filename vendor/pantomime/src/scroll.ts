import {
  chance,
  clamp,
  normal,
  type Rng,
  uniform,
  uniformInt,
} from "./random.ts";

export interface WheelTick {
  readonly deltaY: number;
  /** Wait after this tick. */
  readonly delayMs: number;
}

/**
 * Wheel ticks that scroll `deltaY` px: many small ticks with a bell-shaped speed,
 * irregular gaps, an occasional pause, and an occasional overshoot with correction.
 * The ticks sum to exactly `deltaY`.
 */
export function planScroll(deltaY: number, rng: Rng): WheelTick[] {
  const total = Math.abs(deltaY);
  if (total < 1) {
    return [];
  }
  const count = clamp(Math.round(total / 80), 3, 40);
  // Jittered cut points on a smoothstep CDF: rounding telescopes, so the sum stays exact.
  const cuts = Array.from({ length: count + 1 }, (_, i) =>
    i === 0 || i === count ? i / count : (i + uniform(rng, -0.3, 0.3)) / count,
  ).map((u) => Math.round(deltaY * smoothstep(u)));
  const ticks = cuts
    .slice(1)
    .map((cut, i) => ({
      deltaY: cut - (cuts[i] ?? 0),
      delayMs:
        Math.max(8, normal(rng, 35, 12)) +
        (chance(rng, 0.08) ? Math.max(0, normal(rng, 250, 80)) : 0),
    }))
    .filter((tick) => tick.deltaY !== 0);
  if (total > 400 && chance(rng, 0.2)) {
    const overshoot = Math.sign(deltaY) * uniformInt(rng, 30, 80);
    return [
      ...ticks,
      { deltaY: overshoot, delayMs: uniform(rng, 150, 350) },
      { deltaY: -overshoot, delayMs: uniform(rng, 40, 90) },
    ];
  }
  return ticks;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
