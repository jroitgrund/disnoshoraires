import { setTimeout } from "node:timers/promises";

export async function sleep(ms: number): Promise<void> {
  if (ms > 0) {
    await setTimeout(ms);
  }
}

/** Runs `fn` on each item, one after the other. */
export async function forEachSequential<T>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  for (const [index, item] of items.entries()) {
    await fn(item, index);
  }
}

/** Runs tasks one at a time, in call order. A failed task does not block later ones. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.catch(() => null);
    return result;
  }
}
