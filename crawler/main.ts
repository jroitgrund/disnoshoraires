import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { crawlCity, MARSEILLE } from "./crawl.ts";
import { CrawlSchema } from "./schema.ts";

const [output] = process.argv.slice(2);
if (output == null) {
  throw new Error("usage: node crawler/main.ts <output.json>");
}

// The site reads the file with the same schema: a crawl that does not match it is not written.
const crawl = CrawlSchema.parse(await crawlCity(MARSEILLE));
const json = `${JSON.stringify(crawl, null, 2)}\n`;
await mkdir(dirname(output), { recursive: true });
// Write then rename, so a reader never sees a half-written file.
await writeFile(`${output}.tmp`, json);
await rename(`${output}.tmp`, output);
