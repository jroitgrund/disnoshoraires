import { expect, test } from "vitest";
import { fixture } from "./test/fixture.ts";
import {
  type Backdrop,
  parseTmdbBackdrops,
  parseTmdbFilm,
  parseTmdbSearch,
  pickBackdrop,
} from "./tmdb.ts";

test("search", () => {
  expect(parseTmdbSearch(fixture("tmdb/search-fjord.html"))).toMatchSnapshot();
});

test("film page", () => {
  expect(
    parseTmdbFilm(
      "1401459",
      fixture("tmdb/fjord-en.html"),
      fixture("tmdb/fjord-fr.html"),
    ),
  ).toMatchSnapshot();
});

test("film page that shares only the French title with AlloCiné", () => {
  expect(
    parseTmdbFilm(
      "1542261",
      fixture("tmdb/doraemon-en.html"),
      fixture("tmdb/doraemon-fr.html"),
    ),
  ).toMatchSnapshot();
});

test("film page without a French overview", () => {
  expect(
    parseTmdbFilm(
      "16336",
      fixture("tmdb/ein-mann-ein-fjord-en.html"),
      fixture("tmdb/ein-mann-ein-fjord-fr.html"),
    ).synopsis,
  ).toBeNull();
});

test("film page without a French page", () => {
  expect(
    parseTmdbFilm("1542261", fixture("tmdb/doraemon-en.html"), null).titles,
  ).toMatchSnapshot();
});

test("backdrops", () => {
  expect(
    parseTmdbBackdrops(fixture("tmdb/fjord-backdrops.html")),
  ).toMatchSnapshot();
});

test.each(["fjord", "the-odyssey"])("backdrop of %s", (film) => {
  expect(
    pickBackdrop(parseTmdbBackdrops(fixture(`tmdb/${film}-backdrops.html`))),
  ).toMatchSnapshot();
});

const backdrop = (
  url: string,
  uploader: string,
  language = "xx",
): Backdrop => ({
  url,
  uploader,
  language,
});

test("backdrop from the largest series", () => {
  expect(
    pickBackdrop([
      backdrop("a1", "a"),
      backdrop("b1", "b"),
      backdrop("b2", "b"),
      backdrop("b3", "b"),
      backdrop("c1", "c"),
      backdrop("c2", "c"),
      backdrop("c3", "c"),
      backdrop("c4", "c"),
    ]),
  ).toMatchInlineSnapshot(`"c1"`);
});

test("backdrop without a series of 3", () => {
  expect(
    pickBackdrop([
      backdrop("a1", "a"),
      backdrop("b1", "b"),
      backdrop("b2", "b"),
    ]),
  ).toMatchInlineSnapshot(`"a1"`);
});

test("backdrop of the import account is not a series", () => {
  expect(
    pickBackdrop([
      backdrop("a1", "a"),
      backdrop("t1", "tmdb01tmdb01"),
      backdrop("t2", "tmdb01tmdb01"),
      backdrop("t3", "tmdb01tmdb01"),
    ]),
  ).toMatchInlineSnapshot(`"a1"`);
});

test("backdrop with a language is never picked", () => {
  expect(
    pickBackdrop([backdrop("a1", "a", "en"), backdrop("b1", "b")]),
  ).toMatchInlineSnapshot(`"b1"`);
  expect(pickBackdrop([backdrop("a1", "a", "en")])).toMatchInlineSnapshot(
    `null`,
  );
});
