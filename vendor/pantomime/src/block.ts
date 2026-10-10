import type { Page } from "patchright";

/**
 * Why a response failed, and so what a retry must change.
 * - `challenge`: the clearance is missing or dead. Solve it again with the same IP and browser.
 * - `rate-limited`: too fast. Slow down; keep the identity.
 * - `flagged`: the session is blocked. Start a new profile.
 * - `ip-banned`: Cloudflare 1006–1008. No browser state helps.
 * - `unavailable`: transient server failure.
 */
export type Failure =
  "challenge" | "rate-limited" | "flagged" | "ip-banned" | "unavailable";

export type Verdict = Failure | "ok" | "error";

/** A response that bot protection, rate limiting, or a server outage stopped. */
export class BlockedError extends Error {
  override readonly name = "BlockedError";

  readonly url: string;
  readonly failure: Failure;
  readonly status: number | null;
  readonly retryAfterMs: number | null;

  constructor(
    url: string,
    failure: Failure,
    status: number | null,
    retryAfterMs: number | null,
  ) {
    super(`${failure} (HTTP ${String(status)}): ${url}`);
    this.url = url;
    this.failure = failure;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** A non-2xx response that no retry can fix. */
export class HttpError extends Error {
  override readonly name = "HttpError";

  readonly url: string;
  readonly status: number;
  readonly body: string;

  constructor(url: string, status: number, body: string) {
    super(`HTTP ${String(status)}: ${url}`);
    this.url = url;
    this.status = status;
    this.body = body;
  }
}

const CHALLENGE_TITLE =
  /just a moment|un instant|attention required|checking your browser|vérification|verifying you are human/i;

const CHALLENGE_SELECTOR =
  "#challenge-form, #challenge-running, #challenge-stage, #cf-challenge-running";

const CHALLENGE_BODY = /challenge-platform|cf-chl-|just a moment/i;

const CLOUDFLARE_ERROR_CODE =
  /cf-error-code[^>]*>\s*(\d{4})|error code:?\s*(\d{4})/i;

/** `headers` keys must be lower case. */
export function classifyResponse(
  status: number,
  headers: Readonly<Record<string, string>>,
  body: string,
): Verdict {
  if (status < 400) {
    return headers["cf-mitigated"] === "challenge" ? "challenge" : "ok";
  }
  const code = cloudflareErrorCode(body);
  if (code === 1006 || code === 1007 || code === 1008) {
    return "ip-banned";
  }
  if (status === 429 || code === 1015) {
    return "rate-limited";
  }
  if (headers["cf-mitigated"] === "challenge" || CHALLENGE_BODY.test(body)) {
    return "challenge";
  }
  if (status === 403) {
    return "flagged";
  }
  if (status >= 500) {
    return "unavailable";
  }
  return "error";
}

export async function isChallengePage(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  if (CHALLENGE_TITLE.test(title)) {
    return true;
  }
  return (
    (await page
      .locator(CHALLENGE_SELECTOR)
      .count()
      .catch(() => 0)) > 0
  );
}

/** Delay from a `Retry-After` header, in seconds or as an HTTP date. */
export function retryAfterMs(
  headers: Readonly<Record<string, string>>,
): number | null {
  const value = headers["retry-after"];
  if (value == null) {
    return null;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function cloudflareErrorCode(body: string): number | null {
  const match = CLOUDFLARE_ERROR_CODE.exec(body);
  const code = match?.[1] ?? match?.[2];
  return code == null ? null : Number(code);
}
