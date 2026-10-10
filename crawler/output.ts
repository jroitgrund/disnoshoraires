import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Write then rename, so a reader never sees a half-written file. */
export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}
