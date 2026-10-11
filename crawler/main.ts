import { join } from "node:path";
import { CITIES, cityBySlug } from "../shared/cities.ts";
import { CrawlSchema } from "../shared/schema.ts";
import { crawlCity } from "./crawl.ts";
import { mapSequential } from "./lists.ts";
import { writeJson } from "./output.ts";

const [dir, ...slugs] = process.argv.slice(2);
if (dir == null) {
  throw new Error("usage: node crawler/main.ts <dir> [city slug...]");
}

const cities = slugs.length === 0 ? CITIES : slugs.map(cityBySlug);
await mapSequential(cities, async (city) => {
  // The site reads the file with the same schema: a crawl that does not match it is not written.
  await writeJson(
    join(dir, `${city.slug}.json`),
    CrawlSchema.parse(await crawlCity(city)),
  );
});
