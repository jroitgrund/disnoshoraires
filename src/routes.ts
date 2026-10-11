import { CITIES, type City } from "../shared/cities.ts";
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
