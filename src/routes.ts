import { CITIES, type City } from "../shared/cities.ts";
import type { Movie } from "../shared/schema.ts";
import { loadCrawl, loadExternal } from "./load.ts";
import { programme } from "./programme.ts";

/** The first day is the city page itself: it has no date in its path. */
export function dayHref(
  city: City,
  oldOnly: boolean,
  dates: readonly string[],
  date: string | undefined,
): string {
  const base = `/${city.slug}/${oldOnly ? "fossiles/" : ""}`;
  return date == null || date === dates[0] ? base : `${base}${date}/`;
}

/** One page per film, for all cities and days. */
export function ficheHref(movie: Movie): string {
  return `/fiche/${ficheId(movie)}/`;
}

/** `allocine:123` → `allocine-123`: a colon in a path reads as a URL scheme. */
export function ficheId(movie: Movie): string {
  return movie.id.replace(":", "-");
}

function cityProgrammes(oldOnly: boolean) {
  const external = loadExternal();
  return CITIES.map((city) => {
    const days = programme(loadCrawl(city.slug), external, { oldOnly });
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
