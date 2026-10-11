import { expect, test } from "vitest";
import {
  creditDirectors,
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

test("a link without a film block", () => {
  expect(
    parseFilm(
      fixture("lumiere/programme-milos-forman.html"),
      "https://www.institut-lumiere.org/programme/milos-forman",
      2026,
    ),
  ).toBeNull();
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
