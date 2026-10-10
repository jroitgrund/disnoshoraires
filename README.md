# Dis nos horaires

A static, single-page site with all cinema showtimes in Marseille, from today to the end of the cinema week (Tuesday).

## Scripts

| Script               | Does                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run crawl`      | Crawls AlloCiné with [pantomime](../pantomime) and writes `data/showtimes.json`. Takes about 5 min.                                                 |
| `npm run enrich`     | Finds each movie on TMDB, Letterboxd, Rotten Tomatoes and SensCritique and writes `data/external.json`. See [crawler/README.md](crawler/README.md). |
| `npm run build`      | Builds the static site in `dist/` from `data/showtimes.json`.                                                                                       |
| `npm run build:full` | `crawl`, `enrich`, then `build`.                                                                                                                    |
| `npm run preview`    | Serves `dist/`.                                                                                                                                     |
| `npm run check`      | Type-checks the crawler and the site.                                                                                                               |

## Layout

- `crawler/`: runs directly with Node (type stripping, no build step).
  - `schema.ts`: the zod schemas of `data/showtimes.json` and `data/external.json`. The site validates `data/showtimes.json` with its schema.
  - `allocine.ts`: the theater list from the city page, and showtimes from the endpoint that the theater pages call.
  - `crawl.ts`: one atomic crawl: all theaters, all days, grouped by movie.
  - `enrich.ts`: the enrich pass, with one module per site, `match.ts` for the identity check, and `wikidata.ts` for known IDs.
- `src/`: the Astro site. Preact components render at build time; the page ships no JavaScript.
