import { expect, test } from "vitest";
import {
  letterboxdLookup,
  lookupFilms,
  mergeEnrichment,
  report,
  rottenTomatoesLookups,
  sensCritiqueLookup,
  tmdbLookup,
  toEnrich,
  toExternal,
} from "./enrich.ts";
import { fixture } from "./fixture.ts";
import { parseLetterboxdFilm } from "./letterboxd.ts";
import { parseRottenTomatoesFilm } from "./rottentomatoes.ts";
import type { Crawl, External, MovieInfo } from "./schema.ts";
import {
  parseSensCritiqueProduct,
  parseSensCritiqueSearch,
} from "./senscritique.ts";
import { parseTmdbFilm } from "./tmdb.ts";
import { parseKnownIds } from "./wikidata.ts";

const movie = (
  id: number,
  title: string,
  originalTitle: string,
  productionYear: number | null,
  directors: string[],
): MovieInfo => ({
  id,
  title,
  originalTitle,
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
const surprise = movie(35275, "Film surprise", "Film surprise", 2026, []);

const known = parseKnownIds(
  JSON.parse(fixture("wikidata/known-ids.json")) as unknown,
);

const external: External = {
  tmdb: null,
  letterboxd: null,
  rottenTomatoes: null,
  sensCritique: {
    url: "https://www.senscritique.com/film/fjord/112471227",
    rating: 7,
    ratingCount: 10,
  },
};

test("films to look up", () => {
  expect(lookupFilms([fjord, beloved, surprise], known)).toMatchSnapshot();
});

test("external", () => {
  expect(
    toExternal({
      tmdb: parseTmdbFilm("1401459", fixture("tmdb/fjord-en.html"), null),
      backdrop: "https://image.tmdb.org/t/p/original/fjord.jpg",
      letterboxd: parseLetterboxdFilm(fixture("letterboxd/fjord.html")),
      rottenTomatoes: parseRottenTomatoesFilm(
        "https://www.rottentomatoes.com/m/the_beloved_2026",
        fixture("rottentomatoes/the_beloved_2026.html"),
      ),
      sensCritique: parseSensCritiqueProduct(
        JSON.parse(fixture("senscritique/product-akira.json")) as unknown,
      ),
    }),
  ).toMatchSnapshot();
});

test("external without matches", () => {
  expect(
    toExternal({
      tmdb: null,
      backdrop: null,
      letterboxd: null,
      rottenTomatoes: null,
      sensCritique: null,
    }),
  ).toMatchSnapshot();
});

test("report", () => {
  expect(report(fjord, external)).toMatchInlineSnapshot(
    `"-tmdb -lb -rt +sc Fjord (2026)"`,
  );
});

const crawl: Crawl = {
  from: "2026-10-10",
  to: "2026-10-13",
  crawledAt: "2026-10-10T08:00:00.000Z",
  theaters: [],
  movies: [fjord, beloved].map((m) => ({ ...m, screenings: [] })),
};

test("only movies without previous output are enriched", () => {
  expect(
    toEnrich(crawl.movies, { [String(fjord.id)]: external }).map((m) => m.id),
  ).toMatchInlineSnapshot(`
    [
      325965,
    ]
  `);
});

test("merge keeps the previous output", () => {
  expect(
    mergeEnrichment(
      crawl,
      { [String(fjord.id)]: external },
      new Map([[beloved.id, { ...external, sensCritique: null }]]),
      "2026-10-10T09:00:00.000Z",
    ),
  ).toMatchSnapshot();
});

test("merge fails on a movie not enriched", () => {
  expect(() =>
    mergeEnrichment(crawl, {}, new Map(), "2026-10-10T09:00:00.000Z"),
  ).toThrowErrorMatchingInlineSnapshot(`[Error: movie 188280 is not enriched]`);
});

const [fjordFilm, belovedFilm, akiraFilm] = lookupFilms(
  [fjord, beloved, akira],
  known,
);
if (fjordFilm == null || belovedFilm == null || akiraFilm == null) {
  throw new Error("films to look up");
}
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
  const lookup = tmdbLookup(fjordFilm);
  expect({
    known: lookup.known,
    titles: lookup.titles,
    year: lookup.year,
    fjord: lookup.accept(tmdbFjord),
    doraemon: lookup.accept(tmdbDoraemon),
  }).toMatchInlineSnapshot(`
    {
      "doraemon": false,
      "fjord": true,
      "known": [
        "1401459",
      ],
      "titles": [
        "Fjord",
      ],
      "year": 2026,
    }
  `);
});

test("Letterboxd lookup", () => {
  const lookup = letterboxdLookup(fjordFilm, tmdbFjord);
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
  const [withCritics, any] = rottenTomatoesLookups(belovedFilm, tmdbBeloved);
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
  const lookup = sensCritiqueLookup(akiraFilm);
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
