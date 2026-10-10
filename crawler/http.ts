/**
 * `Http` is plain HTTP, for the sites that serve a script as they serve a browser: TMDB, SensCritique, Wikidata.
 * `sessionRequest` goes through the pantomime session, for Letterboxd and Rotten Tomatoes.
 * Both give `null` for a 404: the page does not exist.
 */
import {
  type FetchInit,
  type FetchResponse,
  HttpError,
  type Session,
} from "pantomime";

// Wikimedia allows 10 requests per minute without contact details in the User-Agent, 200 with them.
const USER_AGENT =
  "disnoshoraires/0.1 (https://github.com/jroitgrund/disnoshoraires)";
const GAP_MS = 600;
const RETRIES = 4;

export type Decision = "ok" | "notFound" | "retry" | "fail";

export interface Slot {
  /** Milliseconds to wait before the request starts. */
  readonly wait: number;
  /** The time the next request to the host may start. */
  readonly next: number;
}

export interface HttpResponse {
  /** The URL after redirects. */
  readonly url: string;
  readonly text: string;
}

export interface Http {
  /** A GET, or a POST of `json`. */
  readonly request: (
    url: string,
    init?: { json?: unknown },
  ) => Promise<HttpResponse | null>;
}

/**
 * One request per host per gap, so sites run in parallel and each sees a slow, steady client.
 * Retries rate limits and server errors with a longer gap.
 */
export function pacedHttp(): Http {
  /** The time the next request to each host may start. */
  const nextSlot = new Map<string, number>();

  async function waitForSlot(host: string, gap: number): Promise<void> {
    const slot = reserve(nextSlot.get(host), Date.now(), gap);
    nextSlot.set(host, slot.next);
    await new Promise((resolve) => setTimeout(resolve, slot.wait));
  }

  async function attempt(
    url: string,
    init: { json?: unknown },
    tries: number,
  ): Promise<HttpResponse | null> {
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

  return { request: (url, init = {}) => attempt(url, init, 0) };
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

export async function sessionRequest(
  session: Session,
  url: string,
  init?: FetchInit,
): Promise<FetchResponse | null> {
  try {
    return await session.fetch(url, init);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
