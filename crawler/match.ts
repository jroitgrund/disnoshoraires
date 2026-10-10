/** What a site tells about a film, to compare with AlloCiné. */
export interface Identity {
  /** Every title the site gives: translated and original. */
  readonly titles: readonly string[];
  readonly year: number | null;
  readonly directors: readonly string[];
}

/** The production year on AlloCiné and the release year on another site often differ by one. */
const YEAR_TOLERANCE = 1;
/** Search results show a release date, which can be a year later than the year on the film page. */
const SEARCH_YEAR_TOLERANCE = 2;
/** Bigram similarity of two parts of a name written in different transliterations: "Andreï Zviaguintsev", "Andrey Zvyagintsev". */
const NAME_PART_SIMILARITY = 0.6;
/** Bigram similarity of two whole names with a typo on one site: "Kantemir Balagov", "Kantemir Bagalov". */
const NAME_SIMILARITY = 0.8;
/**
 * Two titles of the same film need both: bigram similarity, and the share of words in common (Dice).
 * A franchise name alone gives enough bigrams: "Avengers Endgame: Encore" and "Avengers: Secret Wars",
 * by the same directors in the same year, score 0.53 on bigrams but 0.33 on words.
 */
const TITLE_SIMILARITY = 0.5;
const TITLE_WORDS = 0.5;
/** Bigram similarity alone for the same title written another way: "AzulOscuroCasiNegro", "Azul Oscuro Casi Negro". */
const TITLE_SPELLING = 0.8;

/**
 * Same film: years within tolerance, at least one director in common, and two titles alike.
 * A film without a year or without directors on either side cannot be told apart from a namesake: no match.
 */
export function sameFilm(allocine: Identity, other: Identity): boolean {
  return (
    allocine.year != null &&
    other.year != null &&
    Math.abs(allocine.year - other.year) <= YEAR_TOLERANCE &&
    allocine.directors.some((a) =>
      other.directors.some((b) => samePerson(a, b)),
    ) &&
    allocine.titles.some((a) => other.titles.some((b) => sameTitle(a, b)))
  );
}

/**
 * Alike, or one holds the other: "The Kid in the Photo : Carlos Saura", "Carlos Saura".
 * Never with different sequel numbers: "Toy Story 5" and "Toy Story 4" score 0.86, and the two parts of
 * "La Bataille de Gaulle" have the same director and years one apart.
 */
export function sameTitle(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  const na = ` ${wa.join(" ")} `;
  const nb = ` ${wb.join(" ")} `;
  const sa = new Set(wa);
  const sb = new Set(wb);
  const similar = similarity(a, b);
  return (
    !differentNumbers(wa, wb) &&
    wa.length > 0 &&
    wb.length > 0 &&
    (na.includes(nb) ||
      nb.includes(na) ||
      similar >= TITLE_SPELLING ||
      (similar >= TITLE_SIMILARITY &&
        (2 * sa.intersection(sb).size) / (sa.size + sb.size) >= TITLE_WORDS))
  );
}

/** Both titles carry a number and the numbers differ. A year, as in "The Beloved (2026)", is not a sequel number. */
function differentNumbers(a: readonly string[], b: readonly string[]): boolean {
  const numbers = (list: readonly string[]): Set<string> =>
    new Set(list.filter((w) => /^\d+$/.test(w) && !/^(19|20)\d\d$/.test(w)));
  const na = numbers(a);
  const nb = numbers(b);
  return na.size > 0 && nb.size > 0 && na.symmetricDifference(nb).size > 0;
}

function words(title: string): string[] {
  return normalize(title)
    .split(" ")
    .filter((w) => w.length > 0);
}

/** Year within tolerance, to drop search results before loading their page. */
export function closeYear(
  allocine: number | null,
  other: number | null,
): boolean {
  return (
    allocine != null &&
    other != null &&
    Math.abs(allocine - other) <= SEARCH_YEAR_TOLERANCE
  );
}

export function samePerson(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return (
    // Word order differs between sites for East Asian names: "Bong Joon Ho", "Joon-ho Bong".
    sorted(ta) === sorted(tb) ||
    // Each part of the shorter name is in the longer one. One site can add a second family name:
    // "Alberto Rodriguez", "Alberto Rodríguez Librero".
    (shorter.length >= 2 &&
      shorter.every((t) =>
        longer.some((u) => similarity(t, u) >= NAME_PART_SIMILARITY),
      )) ||
    similarity(sorted(ta), sorted(tb)) >= NAME_SIMILARITY
  );
}

/** Lower case, no accents, no punctuation, no AlloCiné homonym marks such as "(II)". */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\((?:i|ii|iii|iv|v|vi)\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Dice coefficient of the sets of character bigrams, from 0 to 1. */
export function similarity(a: string, b: string): number {
  const ba = new Set(bigrams(normalize(a)));
  const bb = new Set(bigrams(normalize(b)));
  if (ba.size === 0 || bb.size === 0) {
    return normalize(a) === normalize(b) ? 1 : 0;
  }
  return (2 * ba.intersection(bb).size) / (ba.size + bb.size);
}

/** The best title similarity of a candidate to any title of the AlloCiné film. */
export function titleScore(
  titles: readonly string[],
  candidate: readonly string[],
): number {
  return Math.max(
    0,
    ...titles.flatMap((a) => candidate.map((b) => similarity(a, b))),
  );
}

function tokens(name: string): string[] {
  return normalize(name)
    .split(" ")
    .filter((t) => t.length > 0);
}

function sorted(list: readonly string[]): string {
  return list.toSorted().join(" ");
}

function bigrams(text: string): string[] {
  const compact = text.replace(/ /g, "");
  return Array.from({ length: Math.max(0, compact.length - 1) }, (_, i) =>
    compact.slice(i, i + 2),
  );
}
