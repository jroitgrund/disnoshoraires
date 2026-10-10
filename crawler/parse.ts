/** A JSON-LD script. Some sites wrap it in a CDATA comment. */
export function parseJsonLd(script: string): unknown {
  return JSON.parse(
    script.replace("/* <![CDATA[ */", "").replace("/* ]]> */", ""),
  ) as unknown;
}

/** The first four-digit number in `text`. */
export function yearIn(text: string): number | null {
  const match = /\b(\d{4})\b/.exec(text);
  return match?.[1] == null ? null : Number(match[1]);
}
