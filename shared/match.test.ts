import { expect, test } from "vitest";
import type { Identity } from "./identity.ts";
import { sameFilm, samePerson, sameTitle } from "./match.ts";

const pairs = (
  same: (a: string, b: string) => boolean,
  list: readonly (readonly [string, string])[],
): string[] => list.map(([a, b]) => `${a} | ${b}: ${String(same(a, b))}`);

test("titles", () => {
  expect(
    pairs(sameTitle, [
      ["The Kid in the Photo : Carlos Saura", "Carlos Saura"],
      ["AzulOscuroCasiNegro", "Azul Oscuro Casi Negro"],
      ["Toy Story 5", "Toy Story 4"],
      ["La Bataille de Gaulle 1", "La Bataille de Gaulle 2"],
      ["The Beloved (2026)", "The Beloved"],
      ["Avengers Endgame: Encore", "Avengers: Secret Wars"],
      ["Avengers Endgame: Encore", "Avengers: Doomsday"],
      ["Fjord", "Fjord"],
      ["L’Être Aimé", "L'Être aimé"],
      ["Fjord", "Akira"],
      ["", "Fjord"],
    ]),
  ).toMatchInlineSnapshot(`
    [
      "The Kid in the Photo : Carlos Saura | Carlos Saura: true",
      "AzulOscuroCasiNegro | Azul Oscuro Casi Negro: true",
      "Toy Story 5 | Toy Story 4: false",
      "La Bataille de Gaulle 1 | La Bataille de Gaulle 2: false",
      "The Beloved (2026) | The Beloved: true",
      "Avengers Endgame: Encore | Avengers: Secret Wars: false",
      "Avengers Endgame: Encore | Avengers: Doomsday: false",
      "Fjord | Fjord: true",
      "L’Être Aimé | L'Être aimé: true",
      "Fjord | Akira: false",
      " | Fjord: false",
    ]
  `);
});

test("people", () => {
  expect(
    pairs(samePerson, [
      ["Bong Joon Ho", "Joon-ho Bong"],
      ["Andreï Zviaguintsev", "Andrey Zvyagintsev"],
      ["Alberto Rodriguez", "Alberto Rodríguez Librero"],
      ["Kantemir Balagov", "Kantemir Bagalov"],
      ["Christophe Honoré (II)", "Christophe Honoré"],
      ["Joe Russo", "Anthony Russo"],
      ["Cristian Mungiu", "Rodrigo Sorogoyen"],
      ["M. Forman", "Miloš Forman"],
      ["H-G. Clouzot", "Henri-Georges Clouzot"],
      ["J. L. Mankiewicz", "Joseph L. Mankiewicz"],
      ["A. Hitchock", "Alfred Hitchcock"],
      ["J. Coen", "Ethan Coen"],
      ["M. Forman", "Marc Forster"],
    ]),
  ).toMatchInlineSnapshot(`
    [
      "Bong Joon Ho | Joon-ho Bong: true",
      "Andreï Zviaguintsev | Andrey Zvyagintsev: true",
      "Alberto Rodriguez | Alberto Rodríguez Librero: true",
      "Kantemir Balagov | Kantemir Bagalov: true",
      "Christophe Honoré (II) | Christophe Honoré: true",
      "Joe Russo | Anthony Russo: false",
      "Cristian Mungiu | Rodrigo Sorogoyen: false",
      "M. Forman | Miloš Forman: true",
      "H-G. Clouzot | Henri-Georges Clouzot: true",
      "J. L. Mankiewicz | Joseph L. Mankiewicz: true",
      "A. Hitchock | Alfred Hitchcock: true",
      "J. Coen | Ethan Coen: false",
      "M. Forman | Marc Forster: false",
    ]
  `);
});

const fjord: Identity = {
  titles: ["Fjord"],
  year: 2026,
  directors: ["Cristian Mungiu"],
};

test("films", () => {
  expect(
    Object.entries({
      same: fjord,
      "year off by 1": { ...fjord, year: 2025 },
      "year off by 2": { ...fjord, year: 2024 },
      "no year": { ...fjord, year: null },
      "other director": { ...fjord, directors: ["Rodrigo Sorogoyen"] },
      "no director": { ...fjord, directors: [] },
      "other title": { ...fjord, titles: ["Akira"] },
      "one title of several": { ...fjord, titles: ["Akira", "Fjord"] },
    }).map(([name, other]) => `${name}: ${String(sameFilm(fjord, other))}`),
  ).toMatchInlineSnapshot(`
    [
      "same: true",
      "year off by 1: true",
      "year off by 2: false",
      "no year: false",
      "other director: false",
      "no director: false",
      "other title: false",
      "one title of several: true",
    ]
  `);
});
