import type { City } from "../shared/cities.ts";
import type { MovieId } from "../shared/ids.ts";
import type { MovieInfo } from "../shared/schema.ts";
import { slugify } from "../shared/slug.ts";

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
export function ficheHref(slug: string): string {
  return `/fiche/${slug}/`;
}

/**
 * The path name of each film's page: its title and year, `fjord-2026`. Of the films with the same title and year,
 * the first by ID has the name alone, the others a number: `fjord-2026--2`. A title never gives two dashes in a row.
 */
export function ficheSlugs(
  movies: readonly MovieInfo[],
): ReadonlyMap<MovieId, string> {
  const films = [...new Map(movies.map((movie) => [movie.id, movie])).values()];
  return new Map(
    [...Map.groupBy(films, ficheSlug)].flatMap(([slug, group]) =>
      group
        .toSorted((a, b) => a.id.localeCompare(b.id))
        .map(
          (movie, i) =>
            [movie.id, i === 0 ? slug : `${slug}--${String(i + 1)}`] as const,
        ),
    ),
  );
}

/** A title without a letter or digit to keep, such as one in Japanese, is a "film". */
function ficheSlug(movie: MovieInfo): string {
  return [slugify(movie.title) || "film", movie.productionYear]
    .filter((part) => part != null)
    .join("-");
}
