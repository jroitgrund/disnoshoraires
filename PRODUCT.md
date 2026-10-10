# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone in Marseille who looks for a film to see, from today to the end of the cinema week. Most visitors use a phone.

## Product Purpose

One page shows every cinema screening in Marseille, from today to the next Tuesday (French cinemas change their programme on Wednesdays). The visitor finds a film, a time and a theater, and how to get there.

## Positioning

- All theaters of the city on one fast page, with no ads and no navigation between theaters.
- Organized by day, then by film: one section per day, films in alphabetical order.
- Each theater name links to a Google Maps search for the theater.
- Each film shows its ratings on Letterboxd, SensCritique, Rotten Tomatoes and TMDB, each a link to the film's page there, and a frame of the film from TMDB.
- Times are plain text, not links.

## Operating Context

- `npm run crawl` collects the data from AlloCiné into `data/showtimes.json`. `npm run build` makes the static site from that file. The site is only as current as the last crawl.
- The footer shows the name and icon links to GitHub, Instagram and an e-mail address. The name opens the page, above the day bar. At its end, a switch leads to the "vieux films" page. That page is identical but leaves out films of the current and the previous year.

## Capabilities and Constraints

- Data per film: title, original title, year, countries, directors, runtime, genres.
- Data per screening: theater, start time, language (dubbed, original, French), subtitles (none, standard, deaf and hard of hearing), formats (4DX, Dolby Cinema, Atmos, ScreenX). The crawl also collects a booking URL, which the site does not show.
- Data per theater: name, address, AlloCiné page. Maps links are Google Maps searches.
- All text for visitors is in French.
- The page is fully static and ships no JavaScript to the browser.
- Mobile first.

## Brand Commitments

- Name: Dis nos horaires, a play on "dinosaure" and "horaires". The name does not tie the site to one city.
- Logo: a pixel dinosaur (sauropod), black on loggia yellow in the favicon, in the text color before the name on the page.
- Visual inspiration: https://www.brutalistwebsites.com/. This is binding.
- No serif typeface.
- No mention of or link to AlloCiné.

## Evidence on Hand

- Real data: `data/showtimes.json` after a crawl.
- No logos, photos or posters are in the repository. The crawl does not collect posters.

## Product Principles

- Time to a decision: the visitor goes from "what is on tonight" to a film, a time and a theater in as few steps as possible.
- Everything at once: one page, no filters that hide screenings, nothing on the page that does not help choose.
- Honest data: show what the crawl found and when, never invent or estimate.
- Fast on a weak mobile connection: static HTML and CSS only.
