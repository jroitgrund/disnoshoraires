import { chance, normal, pick, type Rng } from "./random.ts";

export type KeyboardLayout = "qwerty" | "azerty";

export type Keystroke =
  | { readonly kind: "char"; readonly char: string; readonly delayMs: number }
  | { readonly kind: "backspace"; readonly delayMs: number };

export interface TypingOptions {
  readonly wpm?: number;
  /** Probability per letter to hit a neighbouring key, then notice and correct it. */
  readonly typoProbability?: number;
  readonly layout?: KeyboardLayout;
}

const ROWS: Record<KeyboardLayout, readonly string[]> = {
  qwerty: ["`1234567890-=", "qwertyuiop[]\\", "asdfghjkl;'", "zxcvbnm,./"],
  azerty: ["²&é\"'(-è_çà)=", "azertyuiop^$", "qsdfghjklmù*", "<wxcvbn,;:!"],
};

const NEIGHBOUR_OFFSETS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

/**
 * Timed keystrokes that type `text`: per-session speed, faster on close keys,
 * slower on far keys and capitals, pauses between words, and corrected typos.
 * Applying the keystrokes in order always produces exactly `text`.
 */
export function planTyping(
  text: string,
  rng: Rng,
  options: TypingOptions = {},
): Keystroke[] {
  const layout = options.layout ?? "qwerty";
  const typoProbability = options.typoProbability ?? 0.03;
  const wpm = Math.max(20, normal(rng, options.wpm ?? 70, 10));
  const baseMs = 60_000 / (wpm * 5);
  const chars = Array.from(text);
  return chars.flatMap((char, i): Keystroke[] => {
    const delayMs = keyDelay(char, chars[i - 1] ?? null, baseMs, layout, rng);
    const typo = neighbourKey(char, layout, rng);
    if (typo != null && chance(rng, typoProbability)) {
      return [
        { kind: "char", char: typo, delayMs },
        { kind: "backspace", delayMs: Math.max(120, normal(rng, 350, 100)) },
        {
          kind: "char",
          char,
          delayMs: Math.max(30, normal(rng, baseMs, baseMs * 0.3)),
        },
      ];
    }
    return [{ kind: "char", char, delayMs }];
  });
}

function keyDelay(
  char: string,
  previous: string | null,
  baseMs: number,
  layout: KeyboardLayout,
  rng: Rng,
): number {
  const keyDistance =
    previous == null ? null : distance(previous, char, layout);
  const travel =
    keyDistance == null ? 1 : keyDistance < 2 ? 0.7 : keyDistance > 4 ? 1.2 : 1;
  const shift = char !== char.toLowerCase() ? normal(rng, 150, 40) : 0;
  const wordGap = char === " " ? normal(rng, 120, 40) : 0;
  const think =
    previous === " " && chance(rng, 0.08) ? normal(rng, 400, 150) : 0;
  const typed = normal(rng, baseMs * travel, baseMs * 0.3);
  return Math.max(
    25,
    typed + shift + Math.max(0, wordGap) + Math.max(0, think),
  );
}

function position(
  char: string,
  layout: KeyboardLayout,
): readonly [number, number] | null {
  const lower = char.toLowerCase();
  const row = ROWS[layout].findIndex((r) => r.includes(lower));
  return row === -1 ? null : [row, ROWS[layout][row]?.indexOf(lower) ?? 0];
}

function distance(a: string, b: string, layout: KeyboardLayout): number | null {
  const pa = position(a, layout);
  const pb = position(b, layout);
  return pa == null || pb == null
    ? null
    : Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
}

function neighbourKey(
  char: string,
  layout: KeyboardLayout,
  rng: Rng,
): string | null {
  if (!/\p{L}/u.test(char)) {
    return null;
  }
  const at = position(char, layout);
  if (at == null) {
    return null;
  }
  const rows = ROWS[layout];
  const neighbours = NEIGHBOUR_OFFSETS.map(
    ([dr, dc]) => rows[at[0] + dr]?.[at[1] + dc] ?? null,
  ).filter((k): k is string => k != null && /\p{L}/u.test(k));
  const [first, ...rest] = neighbours;
  if (first == null) {
    return null;
  }
  const key = pick(rng, [first, ...rest]);
  return char === char.toLowerCase() ? key : key.toUpperCase();
}
