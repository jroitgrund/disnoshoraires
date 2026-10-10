/**
 * Plain HTTP for the sites that serve a script as they serve a browser: TMDB, SensCritique, Wikidata.
 * Letterboxd and Rotten Tomatoes go through the pantomime session instead.
 */
const USER_AGENT = "disnoshoraires/0.1 (showtimes in Marseille)";
const GAP_MS = 600;
const RETRIES = 4;

export type Decision = "ok" | "notFound" | "retry" | "fail";

export interface Slot {
  /** Milliseconds to wait before the request starts. */
  readonly wait: number;
  /** The time the next request to the host may start. */
  readonly next: number;
}

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
  await waitForSlot(new URL(url).host, gap(tries));
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
  switch (decide(response.status, tries)) {
    case "notFound":
      return null;
    case "retry":
      return attempt(url, init, tries + 1);
    case "fail":
      throw new Error(`${url}: HTTP ${String(response.status)}`);
    case "ok":
      return { url: response.url, text: await response.text() };
  }
}

/** Rate limits and server errors are retried. The other statuses are final. */
export function decide(status: number, tries: number): Decision {
  if (status === 404) {
    return "notFound";
  }
  if (status === 429 || status >= 500) {
    return tries + 1 >= RETRIES ? "fail" : "retry";
  }
  return status >= 200 && status < 300 ? "ok" : "fail";
}

/** The gap doubles with each retry. */
export function gap(tries: number): number {
  return GAP_MS * 2 ** tries;
}

/** The request starts at the host's next slot, or now when the slot is past. */
export function reserve(
  nextSlot: number | undefined,
  now: number,
  gap: number,
): Slot {
  const slot = Math.max(now, nextSlot ?? now);
  return { wait: slot - now, next: slot + gap };
}

async function waitForSlot(host: string, gap: number): Promise<void> {
  const slot = reserve(nextSlot.get(host), Date.now(), gap);
  nextSlot.set(host, slot.next);
  await new Promise((resolve) => setTimeout(resolve, slot.wait));
}
