import type { City } from "../shared/cities.ts";
import type { Movie } from "../shared/schema.ts";

/** The first day of the city's programme. */
export function cityHref(city: City, oldOnly: boolean): string {
  return `/${city.slug}/${oldOnly ? "fossiles/" : ""}`;
}

/** The first day is the city page itself: it has no date in its path. */
export function dayHref(
  city: City,
  oldOnly: boolean,
  dates: readonly string[],
  date: string | undefined,
): string {
  const base = cityHref(city, oldOnly);
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
