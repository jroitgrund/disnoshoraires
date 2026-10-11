import { expect, test } from "vitest";
import {
  calendarRows,
  creditDirectors,
  filmEntries,
  lumiereRows,
  nextMonthLink,
  parseCalendar,
  parseFilm,
} from "./lumiere.ts";
import { fixture } from "./test/fixture.ts";

test("calendar", () => {
  expect(
    parseCalendar(fixture("lumiere/calendar-2026-09.html")),
  ).toMatchSnapshot();
});

test("calendar during the festival", () => {
  expect(
    parseCalendar(fixture("lumiere/calendar-2026-10.html")),
  ).toMatchSnapshot();
});

test("next month", () => {
  expect(nextMonthLink(fixture("lumiere/calendar-2026-10.html"))).toBeNull();
  expect(nextMonthLink(fixture("lumiere/calendar-2026-09.html"))).toBe(
    "https://www.institut-lumiere.org/calendrier",
  );
});

test("directors in the credits", () => {
  expect(
    [
      "(J. L. Mankiewicz, 2h17)",
      "(G. Bekers & M.Fenati, 52mn)",
      "(Costa-Gavras, 1h35)",
      " d'Ettore Scola (1h55)",
      "de Joel et Ethan Coen (1h34)",
      "(1h30)",
      "",
    ].map(creditDirectors),
  ).toMatchInlineSnapshot(`
    [
      [
        "J. L. Mankiewicz",
      ],
      [
        "G. Bekers",
        "M.Fenati",
      ],
      [
        "Costa-Gavras",
      ],
      [
        "Ettore Scola",
      ],
      [
        "Joel",
        "Ethan Coen",
      ],
      [],
      [],
    ]
  `);
});

test("film of a programme page", () => {
  expect(
    parseFilm(
      fixture("lumiere/programme-milos-forman.html"),
      "https://www.institut-lumiere.org/programme/milos-forman#amadeus",
      2026,
    ),
  ).toMatchSnapshot();
});

test("film of a programme page with its director", () => {
  expect(
    parseFilm(
      fixture("lumiere/cine-club.html"),
      "https://www.institut-lumiere.org/cine-club-septembre-octobre-2026#yojimbo",
      2026,
    ),
  ).toMatchSnapshot();
});

test("the links that lead to a film", () => {
  const line = (href: string) =>
    `<p><strong>16h45</strong> <a href="${href}">Film</a> (M. Forman, 2h40)</p>`;
  expect(
    filmEntries(
      [
        [
          "<title>Calendrier 2026</title>",
          '<div class="vc-block-calendar"><h2>Dimanche 4 octobre</h2>',
          '<div class="wysiwyg-content">',
          line("/programme/milos-forman#amadeus"),
          line("/programme/milos-forman"),
          line("https://www.festival-lumiere.org/film/jamais-le-dimanche"),
          line(
            "https://www.festival-lumiere.org/programme/invitation-a-agnes-jaoui",
          ),
          line("https://billetterie.seetickets.fr/amadeus"),
          "</div></div>",
        ].join(""),
      ],
      ["2026-10-04"],
    ).map((entry) => entry.link),
  ).toEqual([
    "https://www.institut-lumiere.org/programme/milos-forman#amadeus",
    "https://www.festival-lumiere.org/film/jamais-le-dimanche",
  ]);
});

test("film of the festival", () => {
  expect(
    parseFilm(
      fixture("lumiere/festival-jamais-le-dimanche.html"),
      "https://www.festival-lumiere.org/film/jamais-le-dimanche",
      2026,
    ),
  ).toMatchSnapshot();
});

test("rows", () => {
  const link =
    "https://www.institut-lumiere.org/programme/milos-forman#amadeus";
  const film = parseFilm(
    fixture("lumiere/programme-milos-forman.html"),
    link,
    2026,
  );
  if (film == null) {
    throw new Error("amadeus");
  }
  expect(
    lumiereRows(
      {
        date: "2026-10-04",
        times: ["16:45", "17:00"],
        link,
        directors: ["M. Forman"],
        deaf: false,
      },
      film,
      "P0050",
    ),
  ).toMatchSnapshot();
});

test("a link by its path leads to the site", () => {
  expect(
    parseCalendar(
      [
        "<title>Calendrier 2026</title>",
        '<div class="vc-block-calendar"><h2>Dimanche 4 octobre</h2>',
        '<div class="wysiwyg-content"><p><strong>16h45</strong> Rétrospective ',
        '<a href="/programme/milos-forman#amadeus">Amadeus</a> (M. Forman, 2h40)</p>',
        "</div></div>",
      ].join(""),
    ).map((entry) => entry.link),
  ).toEqual([
    "https://www.institut-lumiere.org/programme/milos-forman#amadeus",
  ]);
});

test("rows of the calendar, each with the film of its page", () => {
  const { rows, skipped } = calendarRows(
    filmEntries([fixture("lumiere/calendar-2026-10.html")], ["2026-10-04"]),
    new Map([
      [
        "https://www.institut-lumiere.org/programme/milos-forman",
        fixture("lumiere/programme-milos-forman.html"),
      ],
      [
        "https://www.institut-lumiere.org/cine-club-septembre-octobre-2026",
        fixture("lumiere/cine-club.html"),
      ],
      ["https://www.institut-lumiere.org/programme-cinematokid", null],
    ]),
    "P0050",
  );
  expect({
    rows: rows.map(
      ({ movie, screening }) =>
        `${screening.startsAt} ${movie.title}: ${String(screening.bookingUrl)}`,
    ),
    skipped,
  }).toMatchInlineSnapshot(`
    {
      "rows": [
        "2026-10-04T16:45:00 Amadeus: https://billetterie.seetickets.fr/amadeus-loisirs-cinema-css5-institutlumiere-pg51-ei1130351.html",
        "2026-10-04T17:00:00 Yojimbo: https://billetterie.seetickets.fr/yojimbo-loisirs-cinema-css5-institutlumiere-pg51-ei1130353.html",
      ],
      "skipped": [
        "https://www.institut-lumiere.org/programme-cinematokid#jack",
        "https://www.institut-lumiere.org/les-classiques-du-mois-septembre-2026#oiseaux",
      ],
    }
  `);
});
