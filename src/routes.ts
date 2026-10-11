import { CITIES } from "../shared/cities.ts";
import { readCrawl, readEnrichment } from "../shared/data.ts";
import { ficheId } from "./paths.ts";
import { programme } from "./programme.ts";

// Read once per build. One `now` for all pages: a day page and its film pages show the same screenings.
const NOW = new Date();
const ENRICHMENT = readEnrichment();
const CRAWLS = CITIES.map((city) => ({ city, crawl: readCrawl(city) }));

function cityProgrammes(oldOnly: boolean) {
  return CRAWLS.map(({ city, crawl }) => {
    const days = programme(crawl, ENRICHMENT, { oldOnly, now: NOW });
    return { city, days, dates: days.map(({ date }) => date) };
  });
}

/** The first day of each city. */
export function cityPaths(oldOnly: boolean) {
  return cityProgrammes(oldOnly).map(({ city, days, dates }) => ({
    params: { city: city.slug },
    props: { city, dates, day: days[0] },
  }));
}

/** The days after the first. */
export function dayPaths(oldOnly: boolean) {
  return cityProgrammes(oldOnly).flatMap(({ city, days, dates }) =>
    days.slice(1).map((day) => ({
      params: { city: city.slug, date: day.date },
      props: { city, dates, day },
    })),
  );
}

/** Each film on the programme of any city. */
export function fichePaths() {
  const showings = cityProgrammes(false).flatMap(({ days }) =>
    days.flatMap((day) => day.showings),
  );
  return [
    ...new Map(showings.map((showing) => [showing.movie.id, showing])).values(),
  ].map((showing) => ({
    params: { id: ficheId(showing.movie) },
    props: { showing },
  }));
}
