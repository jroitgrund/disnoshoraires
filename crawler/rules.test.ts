import { expect, test } from "vitest";
import { keyIn, movieId } from "../shared/ids.ts";
import type { MovieInfo } from "../shared/schema.ts";
import { targets } from "./film.ts";
import { parseLetterboxdFilm } from "./letterboxd.ts";
import { parseRottenTomatoesFilm } from "./rottentomatoes.ts";
import { nextStep } from "./lookup.ts";
import {
  letterboxdLookup,
  type Linked,
  preloaded,
  rottenTomatoesLookups,
  sensCritiqueLookup,
  tmdbLookup,
  wikidataLookup,
} from "./rules.ts";
import { parseSensCritiqueSearch } from "./senscritique.ts";
import { fixture } from "./test/fixture.ts";
import { parseTmdbFilm } from "./tmdb.ts";
import { parseWikidataFilms, type WikidataFilm } from "./wikidata.ts";

const movie = (
  id: number,
  title: string,
  originalTitle: string,
  productionYear: number | null,
  directors: string[],
): MovieInfo => ({
  id: movieId("allocine", String(id)),
  title,
  originalTitle,
  synopsis: null,
  runtime: null,
  genres: [],
  productionYear,
  countries: [],
  directors,
  url: `https://www.allocine.fr/film/fichefilm_gen_cfilm=${String(id)}.html`,
});

const fjord = movie(188280, "Fjord", "Fjord", 2026, ["Cristian Mungiu"]);
const beloved = movie(325965, "L’Être Aimé", "El ser querido", 2026, [
  "Rodrigo Sorogoyen",
]);
const akira = movie(6429, "Akira", "Akira", 1988, ["Katsuhiro Otomo"]);

const byAllocineId = parseWikidataFilms(
  JSON.parse(fixture("wikidata/films-by-allocine.json")) as unknown,
);
const fjordCandidates = parseWikidataFilms(
  JSON.parse(fixture("wikidata/films-fjord.json")) as unknown,
);

const item = (items: readonly WikidataFilm[], qid: string): WikidataFilm => {
  const found = items.find((i) => i.id === qid);
  if (found == null) {
    throw new Error(qid);
  }
  return found;
};

const [fjordTarget, belovedTarget, akiraTarget] = targets([
  fjord,
  beloved,
  akira,
]).map((target): Linked => ({
  ...target,
  wikidata:
    byAllocineId.find((i) =>
      i.allocineIds.includes(keyIn(target.movie.id, "allocine") ?? ""),
    ) ?? null,
}));
if (fjordTarget == null || belovedTarget == null || akiraTarget == null) {
  throw new Error("targets");
}

test("Wikidata lookup", () => {
  const lookup = wikidataLookup(fjordTarget);
  const [other] = targets([{ ...fjord, id: "allocine:1" }]);
  if (other == null) {
    throw new Error("targets");
  }
  const mungiu = item(fjordCandidates, "Q137652478");
  const unlinked = { ...mungiu, allocineIds: [] };
  expect({
    titles: lookup.titles,
    accepted: fjordCandidates
      .filter((candidate) => lookup.accept(candidate))
      .map((candidate) => candidate.id),
    withoutAllocineId: lookup.accept(unlinked),
    otherAllocineId: wikidataLookup(other).accept(mungiu),
    otherAllocineIdWithoutIt: wikidataLookup(other).accept(unlinked),
    preloaded: nextStep(lookup, preloaded(fjordTarget, byAllocineId)),
    notPreloaded: nextStep(
      wikidataLookup(other),
      preloaded(other, byAllocineId),
    ),
  }).toMatchInlineSnapshot(`
    {
      "accepted": [
        "Q137652478",
      ],
      "notPreloaded": {
        "kind": "search",
        "title": "Fjord",
      },
      "otherAllocineId": false,
      "otherAllocineIdWithoutIt": true,
      "preloaded": {
        "film": {
          "allocineIds": [
            "188280",
          ],
          "directors": [
            "Cristian Mungiu",
          ],
          "id": "Q137652478",
          "known": {
            "rottenTomatoes": [
              "m/fjord",
            ],
            "sensCritique": [
              "112471227",
            ],
            "tmdb": [
              "1401459",
            ],
          },
          "titles": [
            "Fjord",
          ],
          "wikipedia": {
            "en": "https://en.wikipedia.org/wiki/Fjord_(film)",
            "fr": "https://fr.wikipedia.org/wiki/Fjord_(film)",
          },
          "year": 2026,
        },
        "kind": "done",
      },
      "titles": [
        "Fjord",
      ],
      "withoutAllocineId": true,
    }
  `);
});
const tmdbFjord = parseTmdbFilm(
  "1401459",
  fixture("tmdb/fjord-en.html"),
  fixture("tmdb/fjord-fr.html"),
);
const tmdbDoraemon = parseTmdbFilm(
  "1542261",
  fixture("tmdb/doraemon-en.html"),
  fixture("tmdb/doraemon-fr.html"),
);
const tmdbBeloved = parseTmdbFilm(
  "1074074",
  fixture("tmdb/el-ser-querido-en.html"),
  fixture("tmdb/el-ser-querido-fr.html"),
);

test("TMDB lookup", () => {
  const lookup = tmdbLookup(fjordTarget);
  expect({
    known: lookup.known,
    titles: lookup.titles,
    consider: [2023, 2024].map((year) => lookup.consider({ id: "1", year })),
    fjord: lookup.accept(tmdbFjord),
    doraemon: lookup.accept(tmdbDoraemon),
  }).toMatchInlineSnapshot(`
    {
      "consider": [
        false,
        true,
      ],
      "doraemon": false,
      "fjord": true,
      "known": [
        "1401459",
      ],
      "titles": [
        "Fjord",
      ],
    }
  `);
});

test("Letterboxd lookup", () => {
  const lookup = letterboxdLookup(fjordTarget, tmdbFjord);
  const letterboxd = parseLetterboxdFilm(fixture("letterboxd/fjord.html"));
  if (letterboxd == null) {
    throw new Error("letterboxd/fjord.html");
  }
  expect({
    known: lookup.known,
    titles: lookup.titles,
    fjord: lookup.accept(letterboxd),
    otherTmdbId: lookup.accept({ ...letterboxd, tmdbId: "1" }),
  }).toMatchInlineSnapshot(`
    {
      "fjord": true,
      "known": [
        "1401459",
      ],
      "otherTmdbId": false,
      "titles": [],
    }
  `);
});

test("Rotten Tomatoes lookups", () => {
  const [withCritics, any] = rottenTomatoesLookups(belovedTarget, tmdbBeloved);
  const pages = ["the_beloved_2026", "the_beloved_2"].map((slug) => {
    const page = parseRottenTomatoesFilm(
      `https://www.rottentomatoes.com/m/${slug}`,
      fixture(`rottentomatoes/${slug}.html`),
    );
    if (page == null) {
      throw new Error(slug);
    }
    return page;
  });
  expect({
    known: any.known,
    titles: any.titles,
    withCritics: pages.map((page) => [page.url, withCritics.accept(page)]),
    any: pages.map((page) => [page.url, any.accept(page)]),
  }).toMatchInlineSnapshot(`
    {
      "any": [
        [
          "https://www.rottentomatoes.com/m/the_beloved_2026",
          true,
        ],
        [
          "https://www.rottentomatoes.com/m/the_beloved_2",
          true,
        ],
      ],
      "known": [
        "m/the_beloved_2026",
      ],
      "titles": [
        "The Beloved",
        "El ser querido",
        "L’Être Aimé",
      ],
      "withCritics": [
        [
          "https://www.rottentomatoes.com/m/the_beloved_2026",
          true,
        ],
        [
          "https://www.rottentomatoes.com/m/the_beloved_2",
          false,
        ],
      ],
    }
  `);
});

test("SensCritique lookup", () => {
  const lookup = sensCritiqueLookup(akiraTarget);
  expect({
    known: lookup.known,
    titles: lookup.titles,
    accepted: parseSensCritiqueSearch(
      JSON.parse(fixture("senscritique/search-akira.json")) as unknown,
    )
      .filter((result) => result.film != null && lookup.accept(result.film))
      .map((result) => result.film?.url),
  }).toMatchInlineSnapshot(`
    {
      "accepted": [
        "https://www.senscritique.com/film/akira/418144",
      ],
      "known": [],
      "titles": [
        "Akira",
      ],
    }
  `);
});
