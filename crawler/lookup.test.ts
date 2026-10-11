import { expect, test } from "vitest";
import { closeYear } from "../shared/match.ts";
import {
  type Event,
  type Lookup,
  nextStep,
  type SearchResult,
} from "./lookup.ts";

interface Film {
  readonly id: string;
  readonly ok: boolean;
}

/** Runs `nextStep` against a site given as data: the requests in order, then the film. */
function simulate(
  lookup: Lookup<Film>,
  pages: Readonly<Record<string, Film>>,
  searches: Readonly<Record<string, readonly SearchResult<Film>[]>>,
  history: readonly Event<Film>[] = [],
): string[] {
  const step = nextStep(lookup, history);
  switch (step.kind) {
    case "done":
      return [`done ${step.film?.id ?? "none"}`];
    case "load":
      return [
        `load ${step.id}`,
        ...simulate(lookup, pages, searches, [
          ...history,
          { kind: "loaded", id: step.id, film: pages[step.id] ?? null },
        ]),
      ];
    case "search":
      return [
        `search ${step.title}`,
        ...simulate(lookup, pages, searches, [
          ...history,
          {
            kind: "searched",
            title: step.title,
            results: searches[step.title] ?? [],
          },
        ]),
      ];
  }
}

const lookup = (known: string[], titles: string[]): Lookup<Film> => ({
  known,
  titles,
  consider: (result) => closeYear(2026, result.year),
  accept: (film) => film.ok,
});

const page = (id: string, ok: boolean): Film => ({ id, ok });

const result = (id: string, year: number | null): SearchResult<Film> => ({
  id,
  year,
});

test("a Wikidata ID that passes needs no search", () => {
  expect(
    simulate(
      lookup(["1", "2"], ["Fjord"]),
      { "1": page("1", false), "2": page("2", true) },
      {},
    ),
  ).toMatchInlineSnapshot(`
    [
      "load 1",
      "load 2",
      "done 2",
    ]
  `);
});

test("the next title only when the first gives no match, and no ID loaded twice", () => {
  expect(
    simulate(
      lookup(["1"], ["Fjord", "Fjord (FR)"]),
      { "1": page("1", false), "2": page("2", false), "4": page("4", true) },
      {
        Fjord: [result("1", 2026), result("2", 2026)],
        "Fjord (FR)": [result("2", 2026), result("4", 2027)],
      },
    ),
  ).toMatchInlineSnapshot(`
    [
      "load 1",
      "search Fjord",
      "load 2",
      "search Fjord (FR)",
      "load 4",
      "done 4",
    ]
  `);
});

test("at most 5 results per title, close in year, without duplicates", () => {
  expect(
    simulate(
      lookup([], ["Fjord"]),
      {},
      {
        Fjord: [
          result("1", 2026),
          result("1", 2026),
          result("2", 2010),
          result("3", null),
          result("4", 2028),
          result("5", 2025),
          result("6", 2026),
          result("7", 2026),
          result("8", 2026),
        ],
      },
    ),
  ).toMatchInlineSnapshot(`
    [
      "search Fjord",
      "load 1",
      "load 4",
      "load 5",
      "load 6",
      "load 7",
      "done none",
    ]
  `);
});

test("results that carry the film need no load", () => {
  expect(
    simulate(
      lookup(["1"], ["Akira"]),
      { "1": page("1", false) },
      {
        Akira: [
          { ...result("2", 1988), film: page("2", false) },
          { ...result("3", 2026), film: page("3", true) },
        ],
      },
    ),
  ).toMatchInlineSnapshot(`
    [
      "load 1",
      "search Akira",
      "done 3",
    ]
  `);
});

test("no match", () => {
  expect(
    simulate(
      lookup(["1"], ["Fjord", "Fjord (FR)"]),
      { "1": page("1", false) },
      {
        Fjord: [result("2", 2026)],
      },
    ),
  ).toMatchInlineSnapshot(`
    [
      "load 1",
      "search Fjord",
      "load 2",
      "search Fjord (FR)",
      "done none",
    ]
  `);
});

test("a lookup with the history of an earlier one sends no request", () => {
  const history: Event<Film>[] = [
    { kind: "loaded", id: "1", film: page("1", false) },
    { kind: "searched", title: "Fjord", results: [result("2", 2026)] },
    { kind: "loaded", id: "2", film: page("2", false) },
  ];
  expect(
    nextStep(
      { ...lookup(["1"], ["Fjord"]), accept: (film) => film.id === "2" },
      history,
    ),
  ).toMatchInlineSnapshot(`
    {
      "film": {
        "id": "2",
        "ok": false,
      },
      "kind": "done",
    }
  `);
});
