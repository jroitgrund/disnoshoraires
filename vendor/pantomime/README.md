# pantomime

A browser session that acts like a person, on top of [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright).
It has no options.

```ts
import { Session } from "pantomime";

await using session = await Session.launch();
const html = await session.visit("https://example.com/search");
await session.type("#query", "appartement marseille");
await session.click("button[type=submit]");
const res = await session.fetch("https://example.com/api/search", {
  json: { page: 1 },
});
const data: unknown = JSON.parse(res.text);
```

## Public API

| Export                            | Use                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Session.launch()`                | Opens Chrome on the persistent profile.                                                                 |
| `session.visit(url, extract?)`    | Loads a page, passes a challenge, looks around, then returns the HTML or the result of `extract(page)`. |
| `session.fetch(url, init?)`       | HTTP call from inside the tab. `init`: `method`, `headers`, `body`, `json`, `referrer`.                 |
| `session.click(target)`           | Human click on a selector or Patchright `Locator`.                                                      |
| `session.type(target, text)`      | Human click on a field, then human typing.                                                              |
| `session.hover(target)`           | Human move onto an element.                                                                             |
| `session.scroll(deltaY)`          | Human wheel scroll by a distance.                                                                       |
| `session.scrollTo(target)`        | Human wheel scroll until an element is near the middle of the viewport.                                 |
| `session.read(target?)`           | Pause for the time a reader needs for the text of an element or of the page.                            |
| `session.page`, `session.context` | The raw Patchright `Page` and `BrowserContext`.                                                         |
| `session.close()`                 | Closes Chrome. `await using` calls it for you.                                                          |
| `BlockedError`                    | Thrown when retries cannot pass a block. `failure` gives the cause.                                     |
| `HttpError`                       | Thrown for a non-2xx response that no retry can fix, such as a 404.                                     |

`visit` and `fetch` run one at a time, in call order.
Do not call the interactions while a `visit` or `fetch` runs. Inside `extract`, use them freely.
Set `NODE_DEBUG=pantomime` to log launches, navigations, challenges, and retries.

## What it adds to Patchright

### Browser

- **Real Chrome, as Patchright recommends.** Installed Google Chrome, headful, no viewport override, no custom user agent or headers.
  Chrome reports its true user agent, platform, locale, timezone, fonts, and screen, so all signals agree.
- **Persistent profile.** The profile is in `~/.cache/pantomime/profile` (or `$XDG_CACHE_HOME/pantomime/profile`).
  Cookies, storage, and cache stay across runs, so a solved `cf_clearance` is used again. A profile that resets on every run looks like a short-lived bot environment.
  Only one session at a time can use the profile.
- **Crash recovery.** If the tab crashes or closes, the next request relaunches Chrome on the same profile.

### Human input

All input goes through Patchright's mouse and keyboard. The page gets trusted input events, and no script runs in the page's own world.

- **Mouse paths.** Curved Bézier paths with a bell-shaped speed, a duration that grows with distance (Fitts's law), sub-pixel hand tremor, and an occasional overshoot with a correction.
- **Clicks.** Gaussian aim around the centre of the element, a short pause after a long move, and a random time between press and release.
- **Typing.** A different speed for each session. Close keys are faster, far keys and capitals are slower, and there are pauses between words.
  Typos hit a neighbouring key and are corrected with Backspace. Capitals use Shift. The key layout (QWERTY or AZERTY) follows the OS locale.
- **Scrolling.** Many small wheel ticks with a bell-shaped speed, irregular gaps, short pauses, and an occasional overshoot that scrolls back.
  Elements outside the viewport are scrolled into view with the wheel before an interaction.
- **Idle hand.** Between actions the cursor drifts by a few pixels at irregular intervals.
- **Reading.** A pause sized to the word count, at about 230 words per minute.

### Pacing

- **Gap between requests.** 1–3 s, random, between the starts of two requests.
- **Look around after each load.** After each load: 2–5 s of scrolling, pointing at visible links, and resting.
- **Adaptive slowdown.** Each rate limit doubles the gap (up to 8×). Each success brings it back by 20 %.

### Calls from inside the tab

`fetch` runs in the tab, in Patchright's isolated world.
The call carries the cookies, TLS fingerprint, origin, and referrer of the real page, and page scripts cannot see it.
Before the call, the tab loads the `referrer` page (default: the origin of the URL) if it is not already there.

### Challenges

- **Detection.** The `cf-mitigated: challenge` header, challenge page titles and elements, and challenge markers in an error body.
- **Passing.** Real Chrome usually solves a managed challenge without help, so the session waits up to 20 s with an idle hand.
  If a Turnstile checkbox shows, the session moves to it and clicks it once.

### Retries

Each failure is classified. A retry clears only the state that the failure points to.

| Failure        | Signal                          | Retry                                                                                                                                               |
| -------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `challenge`    | Challenge header, page, or body | Load the page again after 2–5 s, on the same profile and IP, so the clearance is solved again. If the challenge comes back, handle it as `flagged`. |
| `rate-limited` | 429 or Cloudflare 1015          | Keep all state. Wait for `Retry-After`, or 30 s doubled on each attempt (max 5 min). Slow down later requests.                                      |
| `flagged`      | Other 403                       | Delete the full profile (cookies, storage, cache), then relaunch after 30–120 s. Once per call.                                                     |
| `ip-banned`    | Cloudflare 1006, 1007, 1008     | No retry. No browser state can fix an IP ban.                                                                                                       |
| `unavailable`  | 5xx                             | Keep all state. Wait 5 s, doubled on each attempt. Max 2 retries.                                                                                   |

All delays have jitter. A call stops after 4 retries.

## Development

```sh
npm install
npx patchright install chrome   # only if Google Chrome is not installed
npm run check                   # lint, format, typecheck, build, publint
```
