import { chance, clamp, normal, type Rng, uniform } from "./random.ts";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A point reached `t` ms after the start of the move. */
export interface TimedPoint extends Point {
  readonly t: number;
}

export interface Box extends Point {
  readonly width: number;
  readonly height: number;
}

export interface PathOptions {
  /** Probability to overshoot the target and correct back. Only for moves over 80 px. */
  readonly overshootProbability?: number;
  /** Hand tremor amplitude in px. */
  readonly jitterPx?: number;
}

const DEFAULT_OVERSHOOT_PROBABILITY = 0.15;
const DEFAULT_JITTER_PX = 0.5;

/**
 * Curved, timed mouse path from `from` to `to`.
 * Cubic Bézier with control points offset to one side, a bell-shaped velocity profile
 * (minimum-jerk), sub-pixel tremor, a Fitts-like duration, and an occasional overshoot.
 * The last point is exactly `to`.
 */
export function buildPath(
  from: Point,
  to: Point,
  rng: Rng,
  options: PathOptions = {},
): TimedPoint[] {
  const dist = distance(from, to);
  if (dist < 1) {
    return [];
  }
  const jitterPx = options.jitterPx ?? DEFAULT_JITTER_PX;
  const overshoot =
    dist > 80 &&
    chance(rng, options.overshootProbability ?? DEFAULT_OVERSHOOT_PROBABILITY);
  const aim = overshoot ? overshootPoint(from, to, rng) : to;
  const durationMs = clamp(
    180 + 90 * Math.log2(dist + 4) + normal(rng, 0, 50),
    80,
    1400,
  );
  const steps = clamp(Math.round(dist / 6), 25, 120);
  const main = segment(from, aim, steps, 0, durationMs, jitterPx, rng);
  const correction = overshoot
    ? segment(aim, to, 8, durationMs, uniform(rng, 60, 140), jitterPx, rng)
    : [];
  return dedupe([...main, ...correction]);
}

/** Gaussian point around the box centre, clamped inside the box. */
export function pointInBox(box: Box, rng: Rng, spread = 0.15): Point {
  const insetX = Math.min(2, box.width / 4);
  const insetY = Math.min(2, box.height / 4);
  return {
    x: clamp(
      normal(rng, box.x + box.width / 2, box.width * spread),
      box.x + insetX,
      box.x + box.width - insetX,
    ),
    y: clamp(
      normal(rng, box.y + box.height / 2, box.height * spread),
      box.y + insetY,
      box.y + box.height - insetY,
    ),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function segment(
  from: Point,
  to: Point,
  steps: number,
  startMs: number,
  durationMs: number,
  jitterPx: number,
  rng: Rng,
): TimedPoint[] {
  const [c1, c2] = controlPoints(from, to, rng);
  return Array.from({ length: steps }, (_, i) => {
    const u = (i + 1) / steps;
    const p = cubicBezier(from, c1, c2, to, smoothstep(u));
    const last = i === steps - 1;
    return {
      x: last ? p.x : p.x + normal(rng, 0, jitterPx / 3),
      y: last ? p.y : p.y + normal(rng, 0, jitterPx / 3),
      t: startMs + u * durationMs,
    };
  });
}

function controlPoints(from: Point, to: Point, rng: Rng): [Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(Math.hypot(dx, dy), 1);
  const perpX = -dy / len;
  const perpY = dx / len;
  // Sub-linear in distance, so long moves do not loop across the screen.
  const magnitude = Math.min(len * 0.25, 200) + 20;
  const side = chance(rng, 0.5) ? -1 : 1;
  const control = (at: number): Point => {
    const offset = side * Math.abs(normal(rng, magnitude, magnitude * 0.4));
    const along = at + uniform(rng, -0.1, 0.1);
    return {
      x: from.x + dx * along + perpX * offset,
      y: from.y + dy * along + perpY * offset,
    };
  };
  return [control(1 / 3), control(2 / 3)];
}

function overshootPoint(from: Point, to: Point, rng: Rng): Point {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const by = uniform(rng, 8, 25);
  return { x: to.x + Math.cos(angle) * by, y: to.y + Math.sin(angle) * by };
}

function cubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const u = 1 - t;
  return {
    x:
      u ** 3 * p0.x +
      3 * u ** 2 * t * p1.x +
      3 * u * t ** 2 * p2.x +
      t ** 3 * p3.x,
    y:
      u ** 3 * p0.y +
      3 * u ** 2 * t * p1.y +
      3 * u * t ** 2 * p2.y +
      t ** 3 * p3.y,
  };
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function dedupe(path: readonly TimedPoint[]): TimedPoint[] {
  return path.filter((p, i) => {
    const prev = path[i - 1];
    return prev == null || prev.x !== p.x || prev.y !== p.y;
  });
}
