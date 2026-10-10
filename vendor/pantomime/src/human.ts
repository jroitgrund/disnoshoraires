import type { Locator, Page } from "patchright";
import { forEachSequential, sleep } from "./async.ts";
import {
  type Box,
  buildPath,
  distance,
  type Point,
  pointInBox,
} from "./path.ts";
import {
  chance,
  clamp,
  normal,
  pick,
  type Range,
  type Rng,
  uniform,
  uniformIn,
  uniformInt,
} from "./random.ts";
import { planScroll } from "./scroll.ts";
import { type KeyboardLayout, planTyping } from "./typing.ts";

export type Target = Locator | string;

interface Viewport {
  readonly width: number;
  readonly height: number;
}

const PRINTABLE_US_KEY = /^[\x20-\x7e]$/;

/**
 * Human-like input on one page. Every event goes through `page.mouse` and
 * `page.keyboard`, so the page receives trusted CDP input events, never synthetic DOM events.
 */
export class Human {
  private position: Point | null = null;

  private readonly page: Page;
  private readonly rng: Rng;
  private readonly layout: KeyboardLayout;

  constructor(page: Page, rng: Rng, layout: KeyboardLayout) {
    this.page = page;
    this.rng = rng;
    this.layout = layout;
  }

  async moveTo(target: Point): Promise<void> {
    const from = this.position ?? (await this.enterViewport());
    const path = buildPath(from, target, this.rng);
    const start = performance.now();
    await forEachSequential(path, async (point) => {
      await sleep(start + point.t - performance.now());
      await this.page.mouse.move(point.x, point.y);
    });
    this.position = target;
  }

  /** Scrolls the target into view if needed and rests the cursor on it. */
  async hover(target: Target): Promise<Point> {
    const box = await this.visibleBox(target);
    const point = pointInBox(box, this.rng);
    await this.moveTo(point);
    return point;
  }

  async click(target: Target): Promise<void> {
    const start = this.position;
    const point = await this.hover(target);
    await this.press(start, point);
  }

  async clickAt(point: Point): Promise<void> {
    const start = this.position;
    await this.moveTo(point);
    await this.press(start, point);
  }

  /** Clicks the field, then types `text` with human timing and corrected typos. */
  async type(target: Target, text: string): Promise<void> {
    await this.click(target);
    await sleep(uniform(this.rng, 150, 400));
    await forEachSequential(
      planTyping(text, this.rng, { layout: this.layout }),
      async (keystroke) => {
        await sleep(keystroke.delayMs);
        await this.key(
          keystroke.kind === "char" ? keystroke.char : "Backspace",
        );
      },
    );
  }

  /** Scrolls by `deltaY` px with many small wheel ticks. */
  async scrollBy(deltaY: number): Promise<void> {
    if (this.position == null) {
      await this.enterViewport();
    }
    await forEachSequential(planScroll(deltaY, this.rng), async (tick) => {
      await this.page.mouse.wheel(0, tick.deltaY);
      await sleep(tick.delayMs);
    });
  }

  /** Scrolls until the centre of the target is in the middle band of the viewport. */
  async scrollIntoView(target: Target, attemptsLeft = 10): Promise<void> {
    const box = await this.locate(target).boundingBox();
    if (box == null) {
      throw new Error(`no bounding box: ${String(target)}`);
    }
    const viewport = await this.viewport();
    const centerY = box.y + box.height / 2;
    const inBand =
      centerY > viewport.height * 0.15 && centerY < viewport.height * 0.85;
    if (inBand || attemptsLeft === 0) {
      return;
    }
    const wanted = centerY - viewport.height / 2;
    const cap = viewport.height * 0.8;
    await this.scrollBy(
      Math.round(
        clamp(wanted + normal(this.rng, 0, viewport.height * 0.05), -cap, cap),
      ),
    );
    await sleep(uniform(this.rng, 120, 300));
    await this.scrollIntoView(target, attemptsLeft - 1);
  }

  /** Small hand drift at irregular intervals, for `ms`. Humans never hold a mouse still. */
  async idle(ms: number): Promise<void> {
    const deadline = performance.now() + ms;
    const drift = async (): Promise<void> => {
      const remaining = deadline - performance.now();
      if (remaining <= 0) {
        return;
      }
      await sleep(Math.min(remaining, uniform(this.rng, 600, 2000)));
      if (performance.now() >= deadline) {
        return;
      }
      const from = this.position ?? (await this.enterViewport());
      const viewport = await this.viewport();
      const next = {
        x: clamp(from.x + uniformInt(this.rng, -3, 3), 0, viewport.width - 1),
        y: clamp(from.y + uniformInt(this.rng, -3, 3), 0, viewport.height - 1),
      };
      await this.page.mouse.move(next.x, next.y);
      this.position = next;
      await drift();
    };
    await drift();
  }

  /** Dwells for the time a reader at `wpm` needs for the target's text, capped at `maxMs`. */
  async read(
    target: Target = "body",
    wpm = 230,
    maxMs = 20_000,
  ): Promise<void> {
    const text = await this.locate(target).innerText();
    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    const ms = (words / wpm) * 60_000 * uniform(this.rng, 0.8, 1.2);
    await this.idle(Math.min(ms, maxMs));
  }

  /** Looks around the page for `ms`: scrolls, points at links, and rests. */
  async browse(ms: Range): Promise<void> {
    const deadline = performance.now() + uniformIn(this.rng, ms);
    const step = async (): Promise<void> => {
      const remaining = deadline - performance.now();
      if (remaining <= 0) {
        return;
      }
      const action = pick(this.rng, ["scroll", "point", "rest"] as const);
      if (action === "scroll") {
        await this.scrollBy(
          uniformInt(this.rng, 120, 600) * (chance(this.rng, 0.8) ? 1 : -1),
        );
      } else if (action === "point") {
        await this.pointAtRandomLink();
      }
      await this.idle(
        Math.min(deadline - performance.now(), uniform(this.rng, 300, 1500)),
      );
      await step();
    };
    await step();
  }

  private async pointAtRandomLink(): Promise<void> {
    const viewport = await this.viewport();
    const boxes = await this.page
      .locator("a[href]:visible")
      .evaluateAll((links) =>
        links.map((link) => {
          const r = link.getBoundingClientRect();
          return { x: r.left, y: r.top, width: r.width, height: r.height };
        }),
      );
    const inView = boxes.filter(
      (b) =>
        b.width > 20 &&
        b.height > 10 &&
        b.y >= 0 &&
        b.x >= 0 &&
        b.y + b.height <= viewport.height &&
        b.x + b.width <= viewport.width,
    );
    const [first, ...rest] = inView;
    if (first != null) {
      await this.moveTo(pointInBox(pick(this.rng, [first, ...rest]), this.rng));
    }
  }

  private async press(start: Point | null, point: Point): Promise<void> {
    if (start == null || distance(start, point) > 150) {
      await sleep(uniform(this.rng, 120, 350));
    }
    await this.page.mouse.down();
    await sleep(uniform(this.rng, 60, 160));
    await this.page.mouse.up();
    await sleep(uniform(this.rng, 60, 150));
  }

  private async key(key: string): Promise<void> {
    const hold = clamp(normal(this.rng, 85, 25), 40, 200);
    if (key !== "Backspace" && !PRINTABLE_US_KEY.test(key)) {
      // Playwright has no key definition for this character: it sends only an input event.
      await this.page.keyboard.type(key);
      return;
    }
    const shifted = /^[A-Z]$/.test(key);
    if (shifted) {
      await this.page.keyboard.down("Shift");
      await sleep(uniform(this.rng, 30, 80));
    }
    await this.page.keyboard.down(key);
    await sleep(hold);
    await this.page.keyboard.up(key);
    if (shifted) {
      await sleep(uniform(this.rng, 10, 40));
      await this.page.keyboard.up("Shift");
    }
  }

  private async visibleBox(target: Target): Promise<Box> {
    await this.scrollIntoView(target);
    const box = await this.locate(target).boundingBox();
    if (box == null) {
      throw new Error(`no bounding box: ${String(target)}`);
    }
    return box;
  }

  /** The cursor enters at a random point: the first mousemove of a real session. */
  private async enterViewport(): Promise<Point> {
    const viewport = await this.viewport();
    const point = {
      x: uniform(this.rng, viewport.width * 0.2, viewport.width * 0.8),
      y: uniform(this.rng, viewport.height * 0.2, viewport.height * 0.8),
    };
    await this.page.mouse.move(point.x, point.y);
    this.position = point;
    return point;
  }

  /** `viewport: null` leaves the window size to Chrome, so read it from the page. */
  private async viewport(): Promise<Viewport> {
    return (
      this.page.viewportSize() ??
      (await this.page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      })))
    );
  }

  private locate(target: Target): Locator {
    return typeof target === "string"
      ? this.page.locator(target).first()
      : target;
  }
}
