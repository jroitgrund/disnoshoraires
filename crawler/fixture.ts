import { readFileSync } from "node:fs";

/** A response saved from the site, under `fixtures/`. */
export function fixture(path: string): string {
  return readFileSync(new URL(`fixtures/${path}`, import.meta.url), "utf8");
}
