import { expect, test } from "vitest";
import { CITIES } from "../shared/cities.ts";
import { wallFontSize } from "./wall.ts";

test("one term per line count the cities can take", () => {
  expect(wallFontSize(CITIES.map((city) => city.name))).toMatchSnapshot();
});

test("one city takes one line", () => {
  expect(wallFontSize(["Lyon"])).toBe(
    "max(var(--t-film), min(var(--wall-w) / 2.600, var(--wall-h) * 0.7 / 1.05))",
  );
});
