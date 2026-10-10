import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { debuglog } from "node:util";
import {
  type BrowserContext,
  chromium,
  type Page,
  type Response,
} from "patchright";
import { SerialQueue, sleep } from "./async.ts";
import {
  BlockedError,
  classifyResponse,
  HttpError,
  isChallengePage,
  retryAfterMs,
} from "./block.ts";
import { Human, type Target } from "./human.ts";
import { normal, type Range, uniform, uniformIn } from "./random.ts";
import { type RetryPlan, type RetryState, withRetry } from "./retry.ts";
import type { KeyboardLayout } from "./typing.ts";

export interface FetchInit {
  /** Default: `"GET"`, or `"POST"` when `json` or `body` is set. */
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  /** Sent as a JSON body with a JSON content type. */
  readonly json?: unknown;
  /**
   * Page to load before the call, when the tab is not already on it.
   * It becomes the `Referer` and the origin of the call.
   * Default: the origin of `url`.
   */
  readonly referrer?: string;
}

export interface FetchResponse {
  readonly url: string;
  readonly status: number;
  /** Keys are lower case. */
  readonly headers: Readonly<Record<string, string>>;
  readonly text: string;
}

const GAP_MS: Range = [1_000, 3_000];
const DWELL_MS: Range = [2_000, 5_000];
const CHALLENGE_TIMEOUT_MS = 20_000;
const MAX_PACE = 8;

const log = debuglog("pantomime");

/**
 * One headful Chrome, driven by Patchright, that acts like a person.
 *
 * - Real Chrome with its own fingerprint, user agent, locale, and timezone. Nothing is spoofed.
 * - A persistent profile in `~/.cache/pantomime/profile`, so cookies such as `cf_clearance`
 *   survive across runs. One session at a time can use it.
 * - Human input for every interaction, a pause between requests, and a look around each page.
 * - Retries that clear only the state the failure points at. See `planRetry`.
 *
 * `visit` and `fetch` run one at a time, in call order.
 * Set `NODE_DEBUG=pantomime` to log launches, navigations, challenges, and retries.
 */
export class Session implements AsyncDisposable {
  private browser: {
    context: BrowserContext;
    page: Page;
    human: Human;
  } | null = null;
  private crashed = false;
  private mustResolve = false;
  private pace = 1;
  private lastRequestAt = Number.NEGATIVE_INFINITY;
  private readonly queue = new SerialQueue();
  private readonly rng = Math.random;
  private readonly profileDir = join(
    process.env["XDG_CACHE_HOME"] ?? join(homedir(), ".cache"),
    "pantomime",
    "profile",
  );

  private constructor() {}

  static async launch(): Promise<Session> {
    const session = new Session();
    await session.open();
    return session;
  }

  /** The raw Patchright context. It changes when the session relaunches. */
  get context(): BrowserContext {
    return this.current().context;
  }

  /** The raw Patchright tab. It changes when the session relaunches. */
  get page(): Page {
    return this.current().page;
  }

  /** Loads `url`, looks around like a reader, and returns the HTML. */
  visit(url: string): Promise<string>;
  /** Loads `url`, looks around like a reader, and returns what `extract` returns. */
  visit<T>(url: string, extract: (page: Page) => Promise<T>): Promise<T>;
  visit<T>(
    url: string,
    extract?: (page: Page) => Promise<T>,
  ): Promise<T | string> {
    return this.queue.run(() =>
      this.retrying(async () => {
        await this.beforeRequest();
        await this.navigate(url);
        this.mustResolve = false;
        const page = this.current().page;
        return extract == null ? page.content() : extract(page);
      }),
    );
  }

  /**
   * `fetch` from inside the tab: the call carries the cookies, TLS fingerprint,
   * origin, and referrer of a real Chrome page. A request from Node would carry none of them.
   */
  fetch(url: string, init: FetchInit = {}): Promise<FetchResponse> {
    return this.queue.run(() =>
      this.retrying(async () => {
        await this.beforeRequest();
        const referrer = init.referrer ?? `${new URL(url).origin}/`;
        if (
          this.mustResolve ||
          !this.current().page.url().startsWith(referrer)
        ) {
          await this.navigate(referrer);
          this.mustResolve = false;
        }
        const response = await this.fetchInPage(url, init, referrer);
        const verdict = classifyResponse(
          response.status,
          response.headers,
          response.text,
        );
        if (verdict === "error") {
          throw new HttpError(url, response.status, response.text);
        }
        if (verdict !== "ok") {
          throw new BlockedError(
            url,
            verdict,
            response.status,
            retryAfterMs(response.headers),
          );
        }
        return response;
      }),
    );
  }

  /** Scrolls the target into view, moves to it on a curved path, and clicks. */
  click(target: Target): Promise<void> {
    return this.current().human.click(target);
  }

  /** Clicks the field, then types with human timing and corrected typos. */
  type(target: Target, text: string): Promise<void> {
    return this.current().human.type(target, text);
  }

  /** Scrolls the target into view and rests the cursor on it. */
  async hover(target: Target): Promise<void> {
    await this.current().human.hover(target);
  }

  /** Scrolls by `deltaY` px with many small wheel ticks. */
  scroll(deltaY: number): Promise<void> {
    return this.current().human.scrollBy(deltaY);
  }

  /** Scrolls with the wheel until the target is near the middle of the viewport. */
  scrollTo(target: Target): Promise<void> {
    return this.current().human.scrollIntoView(target);
  }

  /** Dwells for the time a reader needs for the target's text. Default: the whole page. */
  read(target?: Target): Promise<void> {
    return this.current().human.read(target);
  }

  async close(): Promise<void> {
    await this.queue.run(() => this.shutdown());
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  private async open(): Promise<void> {
    // Patchright best practice: real Chrome, headful, no viewport, no custom user agent or headers.
    const context = await chromium.launchPersistentContext(this.profileDir, {
      channel: "chrome",
      headless: false,
      viewport: null,
    });
    const page = context.pages()[0] ?? (await context.newPage());
    const markCrashed = (): void => {
      this.crashed = true;
    };
    page.on("crash", markCrashed);
    page.on("close", markCrashed);
    this.browser = {
      context,
      page,
      human: new Human(page, this.rng, keyboardLayout()),
    };
    this.crashed = false;
    log("launch %s", this.profileDir);
  }

  private async shutdown(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    await browser?.context.close().catch(() => null);
  }

  private retrying<T>(fn: () => Promise<T>): Promise<T> {
    return withRetry(
      async () => {
        const result = await fn();
        this.pace = Math.max(1, this.pace * 0.8);
        return result;
      },
      this.rng,
      (error, plan, state) => this.prepareRetry(error, plan, state),
    );
  }

  private async prepareRetry(
    error: BlockedError,
    plan: RetryPlan,
    state: RetryState,
  ): Promise<void> {
    log(
      "retry %d after %s: %s in %ds",
      state.attempt,
      error.message,
      plan.reset,
      Math.round(plan.delayMs / 1000),
    );
    if (error.failure === "rate-limited") {
      this.pace = Math.min(MAX_PACE, this.pace * 2);
    }
    if (plan.reset === "resolve") {
      this.mustResolve = true;
    }
    if (plan.reset === "profile") {
      await this.shutdown();
      await rm(this.profileDir, { recursive: true, force: true });
      await this.open();
    }
  }

  private async beforeRequest(): Promise<void> {
    if (this.crashed) {
      // A crash says nothing about the identity: relaunch on the same profile.
      log("relaunch after crash");
      await this.shutdown();
      await this.open();
    }
    const gap = uniformIn(this.rng, GAP_MS) * this.pace;
    await sleep(this.lastRequestAt + gap - performance.now());
    this.lastRequestAt = performance.now();
  }

  private async navigate(url: string): Promise<void> {
    const { page, human } = this.current();
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page);
    log("navigate %s %s", url, String(response?.status() ?? null));
    await this.passChallenge(url, response);
    await human.browse(DWELL_MS);
  }

  private async passChallenge(
    url: string,
    response: Response | null,
  ): Promise<void> {
    const { page } = this.current();
    const status = response?.status() ?? 200;
    const headers = response == null ? {} : await response.allHeaders();
    const body = status >= 400 ? await page.content() : "";
    const verdict = classifyResponse(status, headers, body);
    const challenged = verdict === "challenge" || (await isChallengePage(page));
    if (!challenged) {
      if (verdict === "error") {
        throw new HttpError(url, status, body);
      }
      if (verdict !== "ok") {
        throw new BlockedError(url, verdict, status, retryAfterMs(headers));
      }
      return;
    }
    const cleared = await this.awaitChallenge(
      performance.now() + CHALLENGE_TIMEOUT_MS,
      false,
    );
    log("challenge %s %s", url, cleared ? "cleared" : "not cleared");
    if (!cleared) {
      throw new BlockedError(url, "challenge", status, null);
    }
    await settle(page);
  }

  /** Real Chrome usually clears a managed challenge alone; a Turnstile checkbox gets one click. */
  private async awaitChallenge(
    deadline: number,
    clicked: boolean,
  ): Promise<boolean> {
    const { page, human } = this.current();
    if (!(await isChallengePage(page))) {
      return true;
    }
    if (performance.now() >= deadline) {
      return false;
    }
    const turnstile = clicked
      ? null
      : await page
          .locator('iframe[src*="challenges.cloudflare.com"]')
          .first()
          .boundingBox()
          .catch(() => null);
    if (turnstile != null) {
      await duringReload(human.idle(uniform(this.rng, 800, 2000)));
      // The checkbox sits at the left of the widget, vertically centred.
      await duringReload(
        human.clickAt({
          x: turnstile.x + uniform(this.rng, 20, 34),
          y: turnstile.y + turnstile.height / 2 + normal(this.rng, 0, 3),
        }),
      );
    }
    await duringReload(human.idle(1000));
    return this.awaitChallenge(deadline, clicked || turnstile != null);
  }

  private async fetchInPage(
    url: string,
    init: FetchInit,
    referrer: string,
  ): Promise<FetchResponse> {
    const body =
      init.json === undefined ? (init.body ?? null) : JSON.stringify(init.json);
    const headers = {
      ...(init.json === undefined
        ? {}
        : { "content-type": "application/json;charset=utf-8" }),
      ...init.headers,
    };
    const method = init.method ?? (body == null ? "GET" : "POST");
    // Runs in Patchright's isolated world: page scripts cannot see or wrap this fetch.
    return this.current().page.evaluate(
      async (request) => {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          referrer: request.referrer,
          credentials: "include",
        });
        return {
          url: response.url,
          status: response.status,
          headers: Object.fromEntries(response.headers),
          text: await response.text(),
        };
      },
      { url, method, headers, body, referrer },
    );
  }

  private current(): { context: BrowserContext; page: Page; human: Human } {
    if (this.browser == null) {
      throw new Error("session is closed");
    }
    return this.browser;
  }
}

/** Waits for `load`, then for the network to calm down, within bounds. */
/**
 * A challenge that clears reloads the page: an action on the old page fails. The next
 * check of the challenge sees the new page.
 */
async function duringReload(action: Promise<void>): Promise<void> {
  try {
    await action;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("Execution context was destroyed")
    ) {
      throw error;
    }
  }
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => null);
  await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .catch(() => null);
}

/** French and Belgian users type on AZERTY; the typo model follows the OS locale. */
function keyboardLayout(): KeyboardLayout {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return /^(fr-FR|fr-BE|nl-BE)\b/.test(locale) ? "azerty" : "qwerty";
}
