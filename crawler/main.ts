import { CITIES, cityBySlug } from "../shared/cities.ts";
import { crawlFile } from "../shared/data.ts";
import { parisDate } from "../shared/dates.ts";
import { CrawlSchema } from "../shared/schema.ts";
import { crawlCity } from "./crawl.ts";
import { mapSequential } from "./lists.ts";
import { writeJson } from "./output.ts";

const slugs = process.argv.slice(2);
const cities = slugs.length === 0 ? CITIES : slugs.map(cityBySlug);
await mapSequential(cities, async (city) => {
  // The site reads the file with the same schema: a crawl that does not match it is not written.
  await writeJson(
    crawlFile(city),
    CrawlSchema.parse(await crawlCity(city, parisDate(new Date()))),
  );
});
