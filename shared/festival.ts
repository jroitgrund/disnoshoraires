import { z } from "zod";
import { cinemaDay } from "./dates.ts";
import programme from "./festival-lumiere-2026.json" with { type: "json" };
import { keyIn } from "./ids.ts";
import { type Crawl, type Movie, MovieSchema } from "./schema.ts";

/** AlloCiné lists few of its screenings, and the Institut Lumière's calendar only its own. */
export const FESTIVAL_LUMIERE_2026: readonly Movie[] = z
  .array(
    MovieSchema.refine((movie) => keyIn(movie.id, "festival") != null, {
      message: "not a festival movie ID",
    }),
  )
  .parse(programme);

/** The crawl with the festival's screenings on its dates, in its theaters. */
export function withFestival(crawl: Crawl, festival: readonly Movie[]): Crawl {
  const theaters = new Set(crawl.theaters.map((theater) => theater.id));
  const movies = festival
    .map((movie) => ({
      ...movie,
      screenings: movie.screenings.filter((screening) => {
        const day = cinemaDay(screening.startsAt);
        return (
          day >= crawl.from &&
          day <= crawl.to &&
          theaters.has(screening.theaterId)
        );
      }),
    }))
    .filter((movie) => movie.screenings.length > 0);
  return { ...crawl, movies: [...crawl.movies, ...movies] };
}
