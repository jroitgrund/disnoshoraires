# Dis nos horaires

A static site with all cinema showtimes of 20 French cities, one page per city, from today to the next Tuesday. The root page lets the visitor choose a city.

## Scripts

| Script               | Does                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run crawl`      | Crawls AlloCiné with [pantomime](../pantomime) and writes `data/showtimes/<city>.json`. `npm run crawl -- paris lyon` crawls only these cities. About 15 s per theater. |
| `npm run enrich`     | Finds each movie of all cities on TMDB, Letterboxd, Rotten Tomatoes and SensCritique and writes `data/external.json`. See [crawler/README.md](crawler/README.md).       |
| `npm run build`      | Builds the static site in `dist/` from `data/`. Each city needs its file.                                                                                               |
| `npm run build:full` | `crawl`, `enrich`, then `build`.                                                                                                                                        |
| `npm run preview`    | Serves `dist/`.                                                                                                                                                         |
| `npm run check`      | Type-checks the crawler and the site.                                                                                                                                   |

## Layout

- `shared/`: code that the crawler and the site both use.
  - `cities.ts`: the cities, with their AlloCiné ID and the path of their pages.
  - `schema.ts`: the zod schemas of `data/showtimes/<city>.json` and `data/external.json`. The site validates the files with them.
  - `dates.ts`: calendar days in French time, and the cinema week.
  - `sites.ts`: the external sites: name, rating scale, search page.
- `crawler/`: runs directly with Node (type stripping, no build step).
  - `allocine.ts`: the theater list from the city pages, and showtimes from the endpoint that the theater pages call.
  - `crawl.ts`: one atomic crawl of a city: all theaters, all days, grouped by movie.
  - `enrich.ts`: the enrich pass. It runs the lookups of `rules.ts` with `lookup.ts` against one module per site, and maps the results with `external.ts`.
  - `film.ts`: the identity of a film, and the AlloCiné movies to look up. `match.ts` compares two identities. `wikidata.ts` gives known IDs.
- `src/`: the Astro site. Preact components render at build time. The city pages ship no JavaScript; the root page has one script that filters the cities as the visitor types.
  - `load.ts` reads `data/`. `programme.ts` turns it into days, films and theaters. The components only render that.

## Deploy

The site is a Cloudflare Worker with static assets only (`wrangler.jsonc`). `.github/workflows/site.yml`:

- Every Tuesday at 07:00 UTC, and on manual run from `main`: one `crawl` job per city, in parallel. When all succeed: `enrich`, `build`, then `wrangler deploy`.
  Each run uploads `data/` as the `data` artifact and deletes the older ones. After a failed city, "Re-run failed jobs" crawls only the failed cities and deploys.
- Every day at 23:01 UTC: `build` with the latest `data` artifact, then `wrangler deploy`. This drops the past days and screenings.
- On a push to a branch other than `main`: `build` with the latest `data` artifact, then `wrangler versions upload` with the branch name as the preview alias.

The repository needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
