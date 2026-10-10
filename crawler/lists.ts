/** One at a time, in order. */
export async function mapSequential<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (const item of items) {
    results.push(await fn(item));
  }
  return results;
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** Consecutive slices of at most `size` items. */
export function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}
