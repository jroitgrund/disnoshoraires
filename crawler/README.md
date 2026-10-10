# crawler

Two passes. Each pass writes its own file with its own schema (`shared/schema.ts`), and parses its output with that schema before it writes the file.

| Pass             | Reads             | Writes                       | Schema             |
| ---------------- | ----------------- | ---------------------------- | ------------------ |
| `npm run crawl`  | AlloCiné          | `data/showtimes/<city>.json` | `CrawlSchema`      |
| `npm run enrich` | `data/showtimes/` | `data/external.json`         | `EnrichmentSchema` |

## Enrich pass

For each movie of all cities, `data/external.json` has, by AlloCiné ID (a movie on in several cities is looked up once). The pass looks up only the movies that the earlier `data/external.json` does not have (`reuse.ts`), and keeps the earlier results of the others:

| Site            | Data                                                                                |
| --------------- | ----------------------------------------------------------------------------------- |
| TMDB            | URL, rating /10, rating count, one backdrop, French synopsis                        |
| Letterboxd      | URL, rating /5, rating count                                                        |
| Rotten Tomatoes | URL, Tomatometer % (critics), Popcornmeter % (audience), each `null` when not shown |
| SensCritique    | URL, rating /10, rating count                                                       |
| Wikipedia       | English and French article, from the Wikidata item                                  |

A site is `null` when no film on it passes the identity check. A wrong film is worse than none.

The French synopsis comes from AlloCiné, in `data/showtimes/<city>.json`. TMDB's French overview is the fallback. On a page in French, TMDB shows the English overview when it has no French one: an overview that is the same on both pages is not French.

### Transport

| Site                        | How                               | Why                                                                         |
| --------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| Wikidata, TMDB              | Plain HTTP (`http.ts`)            | They serve a script as they serve a browser.                                |
| SensCritique                | Plain HTTP to its GraphQL API     | `apollo.senscritique.com`, the API that the site calls. No key, no cookies. |
| Letterboxd, Rotten Tomatoes | The pantomime session (`http.ts`) | Cloudflare (Letterboxd) and rate limits are likely at crawl volume.         |

`pacedHttp` (`http.ts`) sends one request per host every 600 ms, and doubles the gap on a 429 or 5xx. The plain HTTP sites run in parallel with the session.
The session sites run one site after the other (all Letterboxd, then all Rotten Tomatoes): the session loads a page of the site each time the site changes.

### Where the IDs come from

1. **Wikidata.** The item gives the TMDB (P4947), Rotten Tomatoes (P1258) and SensCritique (P10100) IDs, and the Wikipedia articles.
   - SPARQL queries find the items with the AlloCiné ID (P1265) of every film, 100 IDs per query: Wikimedia refuses a longer URL. This finds most films, also recent ones.
   - For a film without such an item: a search by title, original title first, for items with a director (P57). One SPARQL query loads the results. The first one that passes the identity check is the item. An item with another AlloCiné ID is another film.

   Wikidata can be wrong, so its IDs go through the same check as search results.

2. **Search**, only when Wikidata has no ID, or none that passes the check:
   - TMDB: the search page. TMDB searches all translated titles.
   - Rotten Tomatoes: the search page, films only. The English title from TMDB goes first: Rotten Tomatoes knows most foreign films by it.
   - SensCritique: GraphQL `searchProductExplorer` (the search page), films only (`universe` 1). The results carry titles, year and directors, so no page load is needed.
     The autocomplete (`searchAutocomplete`) is not used: it favours popular films over the exact title.

   Titles are searched one at a time: original title first, then the French title only when the first gives no match.
   Results more than two years away are dropped before any page loads: a search result shows a release date, which can be a year later than the year on the film page.
   At most 5 results per title are loaded.

3. **Letterboxd** takes its catalogue from TMDB: `letterboxd.com/tmdb/<id>/` redirects to the film. Its page must give back the same TMDB ID (`data-tmdb-id`).
4. **Rotten Tomatoes** can have several pages for one film. El ser querido has `m/the_beloved_2026` (Tomatometer 83 %) and `m/the_beloved_2` (no reviews, wrong runtime).
   The first pass takes only a page with a Tomatometer. If none passes the check, a second pass takes any page that passes. Pages and searches are cached per film, so the second pass loads nothing new.

### Identity check

A film on another site is the AlloCiné film when all three are true (`match.ts`):

- **Year** within 1. AlloCiné gives the production year, other sites often the release year.
- **At least one director in common.** Names are compared after normalisation: lower case, no accents, no punctuation, no AlloCiné homonym marks such as "(II)". Two names are the same person when:
  - they have the same words in any order (`Bong Joon Ho`, `Joon-ho Bong`), or
  - each word of the shorter name (2+ words) is close to a word of the longer one: bigram similarity ≥ 0.6. This covers transliterations (`Andreï Zviaguintsev`, `Andrey Zvyagintsev`) and a second family name (`Alberto Rodriguez`, `Alberto Rodríguez Librero`), or
  - the whole names have a bigram similarity ≥ 0.8 (typos).
- **Two titles alike.** Every title on one side against every title on the other. Two titles are alike when:
  - they carry no different sequel numbers (a year such as "(2026)" does not count), and
  - one holds the other (`The Kid in the Photo : Carlos Saura`, `Carlos Saura`), or
  - bigram similarity ≥ 0.5 and share of words in common (Dice) ≥ 0.5, or
  - bigram similarity ≥ 0.8 alone: the same title written another way (`AzulOscuroCasiNegro`, `Azul Oscuro Casi Negro`).

  Titles on each side:
  - AlloCiné: the French and the original title. For Letterboxd and Rotten Tomatoes, also the titles of the TMDB match: these sites often give only the English title.
  - TMDB: the English, French and original titles. TMDB and AlloCiné can share only the French title ("Doraemon et le Château sous-marin").
  - Others: the title and, where the site has one, the original title.

  Why each part:
  - Year and directors alone are not enough. The Russo brothers made "Avengers : Endgame Extended", "Avengers: Doomsday" and "Avengers: Secret Wars" in 2026. All passed year and directors, and Secret Wars passed bigrams (0.53). On words it scores 0.33.
  - Sequels: "Toy Story 5" and "Toy Story 4" score 0.86. The two parts of "La Bataille de Gaulle" have the same director and years one apart.

A film without a year or without directors on AlloCiné (such as "Film surprise") gets no match: it cannot be told apart from a namesake.
A re-release with a new year on AlloCiné (such as "Avengers : Endgame Extended", 2026) does not match the original film.

### Where each site gives year and directors

| Site            | Year                                                                                                                | Directors                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| TMDB            | Film page header (`en-US`; the `fr-FR` page gives the French title)                                                 | Main crew with the "Director" job |
| Letterboxd      | `og:title`, "Fjord (2026)"                                                                                          | JSON-LD                           |
| Rotten Tomatoes | First year of: hero `metadataProps` ("Now Playing" while in theaters), JSON-LD `dateCreated`, `where-to-watch-json` | JSON-LD                           |
| SensCritique    | First of: `displayedYear`, `dateReleaseOriginal`, `dateRelease`, `yearOfProduction`                                 | `directors`                       |

- Rotten Tomatoes has `where-to-watch-json` only for films with streaming or ticket offers.
- SensCritique's `yearOfProduction` is often the year of the French release: 1991 for Akira (1988), 2026 for La reconquista (2016).

### Backdrop

TMDB has no "still" tag. The pass picks the backdrop most likely to be a frame of the film, not key art or a posed photo (`pickBackdrop`):

1. Only backdrops without language (`image_language=xx`). Key art carries the title, so it gets a language.
2. The largest series from one contributor, of 3 or more. Frame grabs from a copy of the film or its trailer come in series. Key art comes alone.
   TMDB's import account `tmdb01tmdb01` does not count: it imports distributor press kits, which mix key art, posed cast photos and stills.
3. In that series, or else among all backdrops without language, the one TMDB ranks first.

This was checked by eye on Fjord, Toy Story 5 and The Odyssey. Letterboxd's backdrop is not a source: it is often an upload of its own, not a TMDB image.

## Tests

`npm test`. The parsers and the domain rules are pure functions. The site modules only fetch and call them.
Tests give them real responses, saved in `fixtures/`, and compare the output with snapshots (`vitest -u` to update).
