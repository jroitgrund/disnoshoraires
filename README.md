# Dis nos horaires

A static, single-page site with all cinema showtimes in Marseille, from today to the end of the cinema week (Tuesday).

## Scripts

| Script               | Does                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run crawl`      | Crawls AlloCiné with [pantomime](../pantomime) and writes `data/showtimes.json`. Takes about 5 min.                                                                                                         |
| `npm run enrich`     | Finds each movie on TMDB, Letterboxd, Rotten Tomatoes and SensCritique and writes `data/external.json`. Skips the movies that `data/external.json` already has. See [crawler/README.md](crawler/README.md). |
| `npm run build`      | Builds the static site in `dist/` from `data/showtimes.json`.                                                                                                                                               |
| `npm run build:full` | `crawl`, `enrich`, then `build`.                                                                                                                                                                            |
| `npm run preview`    | Serves `dist/`.                                                                                                                                                                                             |
| `npm run check`      | Type-checks the crawler and the site.                                                                                                                                                                       |

## Layout

- `crawler/`: runs directly with Node (type stripping, no build step).
  - `schema.ts`: the zod schemas of `data/showtimes.json` and `data/external.json`. The site validates `data/showtimes.json` with its schema.
  - `allocine.ts`: the theater list from the city page, and showtimes from the endpoint that the theater pages call.
  - `crawl.ts`: one atomic crawl: all theaters, all days, grouped by movie.
  - `enrich.ts`: the enrich pass, with one module per site, `match.ts` for the identity check, and `wikidata.ts` for known IDs.
- `src/`: the Astro site. Preact components render at build time; the page ships no JavaScript.

## Deploy

The site is a Cloudflare Worker with static assets only (`wrangler.jsonc`). `.github/workflows/site.yml`:

- Every Tuesday at 07:00 UTC, and on manual run: `crawl`, `enrich`, `build`, then `wrangler deploy`.
  `data/` is the `data` artifact of the workflow. Each run downloads the latest one, so `enrich` skips the movies it already has, then uploads the new one and deletes the older ones.
- On a push to a branch other than `main`: `build` with the latest `data` artifact, then `wrangler versions upload` with the branch name as the preview alias.

The repository needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
