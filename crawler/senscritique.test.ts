import { expect, test } from "vitest";
import { fixture } from "./test/fixture.ts";
import {
  parseSensCritiqueProduct,
  parseSensCritiqueSearch,
  sensCritiqueIdOf,
} from "./senscritique.ts";

const json = (path: string): unknown => JSON.parse(fixture(path)) as unknown;

test("search", () => {
  expect(
    parseSensCritiqueSearch(json("senscritique/search-akira.json")),
  ).toMatchSnapshot();
});

test("ID of a film page", () => {
  const results = parseSensCritiqueSearch(
    json("senscritique/search-akira.json"),
  );
  expect(
    results.map((result) => sensCritiqueIdOf(result.film?.url ?? "")),
  ).toEqual(results.map((result) => result.id));
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
