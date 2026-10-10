/** Returns a float in [0, 1). */
export type Rng = () => number;

export type Range = readonly [min: number, max: number];

/** Mulberry32: small, fast, seedable. Not for cryptography. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function uniform(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function uniformIn(rng: Rng, [min, max]: Range): number {
  return uniform(rng, min, max);
}

export function uniformInt(rng: Rng, min: number, max: number): number {
  return Math.floor(uniform(rng, min, max + 1));
}

/** Box–Muller transform. */
export function normal(rng: Rng, mean: number, stdDev: number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  return (
    mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  );
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

export function pick<T>(rng: Rng, items: readonly [T, ...T[]]): T {
  return items[Math.floor(rng() * items.length)] ?? items[0];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
