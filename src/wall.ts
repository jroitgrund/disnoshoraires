/** Width of one character of the wall, its letter spacing included, in em. */
const ADVANCE = 0.5625;
/** Margin after each city, in em. */
const MARGIN = 0.35;
const LINE_HEIGHT = 1.05;
/** Share of the height the wall fills: room for fonts wider than ADVANCE, and for rounding. */
const SAFETY = 0.7;

const width = (run: readonly string[]): number =>
  run.join("").length * ADVANCE + run.length * MARGIN;

/** Lines of a wall `room` em wide: each line takes as many cities as it holds, at least one. */
const lineCount = (labels: readonly string[], room: number): number =>
  labels.length === 0
    ? 0
    : 1 +
      lineCount(
        labels.slice(
          Math.max(
            labels.filter((_, i) => width(labels.slice(0, i + 1)) <= room)
              .length,
            1,
          ),
        ),
        room,
      );

/**
 * A font size that fits a wall of `--wall-w` by `--wall-h`. Each term
 * sets the cities in a fixed number of lines: as large as the narrowest wall in em that holds
 * them in that many lines allows, and as that many lines in the height allow.
 */
export function wallFontSize(names: readonly string[]): string {
  // All but the last city end with their slash.
  const labels = names.map((name, i) =>
    i < names.length - 1 ? `${name} /` : name,
  );
  const widest = Math.max(...labels.map((label) => width([label])));
  const rooms = labels
    .flatMap((_, start) =>
      labels.map((_, end) => width(labels.slice(start, end + 1))),
    )
    .filter((room) => room >= widest);
  const narrowest = Map.groupBy(
    rooms.toSorted((a, b) => a - b),
    (room) => lineCount(labels, room),
  );
  const terms = [...narrowest].map(
    ([lines, [room = widest]]) =>
      `min(var(--wall-w) / ${room.toFixed(3)}, var(--wall-h) * ${String(SAFETY)} / ${(lines * LINE_HEIGHT).toFixed(2)})`,
  );
  return `max(var(--t-film), ${terms.join(", ")})`;
}
