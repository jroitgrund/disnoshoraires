/**
 * Plain HTTP for the sites that serve a script as they serve a browser: TMDB, SensCritique, Wikidata.
 * Letterboxd and Rotten Tomatoes go through the pantomime session instead.
 */
const USER_AGENT = "disnoshoraires/0.1 (showtimes in Marseille)";
const GAP_MS = 600;
const RETRIES = 4;

export interface Response {
  /** The URL after redirects. */
  readonly url: string;
  readonly text: string;
}

/** The time the next request to each host may start. */
const nextSlot = new Map<string, number>();

/**
 * A GET, or a POST of `json`. One request per host per gap, so sites run in parallel
 * and each sees a slow, steady client. Retries rate limits and server errors with a longer gap.
 * `null` for a 404: the page does not exist.
 */
export function request(
  url: string,
  init: { json?: unknown } = {},
): Promise<Response | null> {
  return attempt(url, init, 0);
}

async function attempt(
  url: string,
  init: { json?: unknown },
  tries: number,
): Promise<Response | null> {
  await waitForSlot(new URL(url).host, GAP_MS * 2 ** tries);
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      ...(init.json === undefined
        ? {}
        : { "content-type": "application/json" }),
    },
    ...(init.json === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(init.json) }),
  });
  if (response.status === 404) {
    return null;
  }
  if (response.status === 429 || response.status >= 500) {
    if (tries + 1 >= RETRIES) {
      throw new Error(`${url}: HTTP ${String(response.status)}`);
    }
    return attempt(url, init, tries + 1);
  }
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${String(response.status)}`);
  }
  return { url: response.url, text: await response.text() };
}

async function waitForSlot(host: string, gap: number): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(host) ?? now);
  nextSlot.set(host, slot + gap);
  await new Promise((resolve) => setTimeout(resolve, slot - now));
}
