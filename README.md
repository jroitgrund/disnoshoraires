# Dis nos horaires

A static site with all cinema showtimes of 20 French cities, one page per city and day, for seven days from today. The root page lets the visitor choose a city.

## Scripts

| Script               | Does                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run crawl`      | Crawls AlloCiné with [pantomime](../pantomime), and the Institut Lumière's site for Lyon, and writes `data/showtimes/<city>.json`. `npm run crawl -- paris lyon` crawls only these cities. About 15 s per theater.         |
| `npm run enrich`     | Finds each movie of all cities on TMDB, Letterboxd, Rotten Tomatoes and SensCritique and writes `data/external.json`. `npm run enrich -- --refresh` looks up all movies again. See [crawler/README.md](crawler/README.md). |
| `npm run build`      | Builds the static site in `dist/` from `data/`. Each city needs its file.                                                                                                                                                  |
| `npm run build:full` | `crawl`, `enrich`, then `build`.                                                                                                                                                                                           |
| `npm run preview`    | Serves `dist/`.                                                                                                                                                                                                            |
| `npm run check`      | Type-checks the crawler and the site.                                                                                                                                                                                      |

## Layout

- `shared/`: code that the crawler and the site both use.
  - `cities.ts`: the cities, with their AlloCiné ID and the path of their pages.
  - `schema.ts`: the zod schemas of `data/showtimes/<city>.json` and `data/external.json`. The site validates the files with them.
  - `data.ts`: the paths of the files in `data/`, and their reads. The crawls come merged: each film once in all cities.
  - `ids.ts`: the movie IDs: the source and the source's own key.
  - `identity.ts`, `match.ts`: the identity of a film, and the check that two identities are the same film.
  - `rows.ts`: the screenings of each movie, and the merge of the movies of different sources.
  - `dates.ts`: calendar days and screening times in French time.
  - `sites.ts`: the external sites: name, rating scale, search page.
- `crawler/`: runs directly with Node (type stripping, no build step).
  - `allocine.ts`: the theater list from the city pages, and showtimes from the endpoint that the theater pages call.
  - `lumiere.ts`: the Institut Lumière's showtimes, from its calendar. AlloCiné lists the theater without showtimes.
  - `crawl.ts`: one atomic crawl of a city: all theaters, all days, grouped by movie.
  - `enrich.ts`: the enrich pass. It runs the lookups of `rules.ts` with `lookup.ts` against one module per site, and maps the results with `external.ts`.
  - `film.ts`: the movies to look up, with their pages in the earlier enrichment (`reuse.ts`). `wikidata.ts` gives known IDs.
- `src/`: the Astro site. Preact components render at build time. The root page has one script that filters the cities as the visitor types.
  - `routes.ts` reads `data/` once per build. `programme.ts` turns it into days, films and theaters. `paths.ts` gives the path of each page. The components only render that.
  - Each film has its page, `/fiche/<title>-<year>/`, such as `/fiche/fjord-2026/`. Films with the same title and year take a number: `/fiche/fjord-2026--2/`. A day page has only the title of each film card: its script loads the rest from the film's page when the card opens. Without JavaScript, the card links to that page.

## Deploy

The site is a Cloudflare Worker with static assets only (`wrangler.jsonc`). `.github/workflows/site.yml`:

- Every day at 23:01 UTC (after midnight in Paris), and on manual run from `main`: one `crawl` job per city, in parallel. When all are done: `enrich`, `build`, then `wrangler deploy`.
  A city whose crawl failed keeps the latest data. The build drops the past days and screenings.
  `enrich` starts from the `external.json` of the latest `data` artifact and looks up only the new movies. On Monday in Paris, and on a manual run with `refresh`, it looks up all movies again (`--refresh`).
  Each run uploads `data/` as the `data` artifact and deletes the older ones. After a failed city, "Re-run failed jobs" crawls only the failed cities and deploys.
  A manual run with `crawl_run` set to the ID of an earlier run skips the crawl and uses that run's crawl, for one day.
- On a push to a branch other than `main`: `build` with the latest `data` artifact, then `wrangler versions upload` with the branch name as the preview alias.

The repository needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
