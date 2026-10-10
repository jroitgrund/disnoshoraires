import { expect, test } from "vitest";
import { fixture } from "./fixture.ts";
import { parseKnownIds, sparqlQuery } from "./wikidata.ts";

test("query", () => {
  expect(sparqlQuery([188280, 6429])).toMatchSnapshot();
});

test("known IDs", () => {
  const known = parseKnownIds(
    JSON.parse(fixture("wikidata/known-ids.json")) as unknown,
  );
  expect(
    [188280, 325965, 6429, 1000036867, 35275].map((id) => [id, known(id)]),
  ).toMatchSnapshot();
});
