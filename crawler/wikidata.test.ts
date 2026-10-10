import { expect, test } from "vitest";
import { fixture } from "./test/fixture.ts";
import {
  filmsQuery,
  parseWikidataFilms,
  parseWikidataSearch,
  searchQuery,
  searchResults,
} from "./wikidata.ts";

test("query by AlloCiné ID", () => {
  expect(filmsQuery({ allocineIds: [188280, 6429] })).toMatchSnapshot();
});

test("query by item", () => {
  expect(filmsQuery({ qids: ["Q137652478", "Q1304876"] })).toMatchSnapshot();
});

test("films by AlloCiné ID", () => {
  expect(
    parseWikidataFilms(
      JSON.parse(fixture("wikidata/films-by-allocine.json")) as unknown,
    ),
  ).toMatchSnapshot();
});

test("search", () => {
  expect(searchQuery("Fjord")).toMatchInlineSnapshot(
    `"Fjord haswbstatement:P57"`,
  );
  const qids = parseWikidataSearch(
    JSON.parse(fixture("wikidata/search-fjord.json")) as unknown,
  );
  const films = parseWikidataFilms(
    JSON.parse(fixture("wikidata/films-fjord.json")) as unknown,
  );
  expect(
    searchResults(qids, films).map(
      ({ id, year, film }) => `${id} ${String(year)} ${film?.titles[0] ?? ""}`,
    ),
  ).toMatchInlineSnapshot(`
    [
      "Q137652478 2026 Fjord",
      "Q1304876 2009 Ein Mann, ein Fjord!",
      "Q56490266 2017 Pierre Radisson: Fjord and Gulf",
      "Q10729081 2010 Kurt Josef Wagle og legenden om fjordheksa",
      "Q78824237 2012 Abschied von Hannah",
    ]
  `);
});
