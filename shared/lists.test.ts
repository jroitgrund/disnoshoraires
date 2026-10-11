import { expect, test } from "vitest";
import { chunks } from "./lists.ts";

test("chunks", () => {
  expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunks([], 2)).toEqual([]);
});
