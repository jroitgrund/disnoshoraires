import { z } from "zod";
import type { City } from "./cities.ts";
import { cinemaDay } from "./dates.ts";
import programme from "./festival-lumiere-2026.json" with { type: "json" };
import { type Crawl, MovieSchema } from "./schema.ts";

/**
 * The Festival Lumière 2026 (10 to 18 October), from its printed programme: AlloCiné lists few of its screenings,
 * and the Institut Lumière's calendar only its own. Only the theaters of the city's AlloCiné list are kept:
 * the Halle Tony Garnier, the Auditorium and the cinemas of the suburbs are left out.
 */
const FESTIVAL = {
  city: "lyon",
  movies: z.array(MovieSchema).parse(programme),
};

/** The crawl with the festival's screenings on its dates. */
export function withFestival(city: City, crawl: Crawl): Crawl {
  if (city.slug !== FESTIVAL.city) {
    return crawl;
  }
  const festival = FESTIVAL.movies
    .map((movie) => ({
      ...movie,
      screenings: movie.screenings.filter((screening) => {
        const day = cinemaDay(screening.startsAt);
        return day >= crawl.from && day <= crawl.to;
      }),
    }))
    .filter((movie) => movie.screenings.length > 0);
  return { ...crawl, movies: [...crawl.movies, ...festival] };
}
