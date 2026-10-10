import { expect, test } from "vitest";
import { fixture } from "./test/fixture.ts";
import {
  parseSensCritiqueProduct,
  parseSensCritiqueSearch,
} from "./senscritique.ts";

const json = (path: string): unknown => JSON.parse(fixture(path)) as unknown;

test("search", () => {
  expect(
    parseSensCritiqueSearch(json("senscritique/search-akira.json")),
  ).toMatchSnapshot();
});

test("product", () => {
  expect(
    parseSensCritiqueProduct(json("senscritique/product-akira.json")),
  ).toMatchSnapshot();
});

test("missing product", () => {
  expect(
    parseSensCritiqueProduct(json("senscritique/product-missing.json")),
  ).toBeNull();
});
