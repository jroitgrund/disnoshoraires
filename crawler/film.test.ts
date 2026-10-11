import { expect, test } from "vitest";
import { movieId } from "../shared/ids.ts";
import type { MovieInfo } from "../shared/schema.ts";
import { targets } from "./film.ts";

const movie = (
  id: number,
  title: string,
  originalTitle: string,
  productionYear: number | null,
  directors: string[],
): MovieInfo => ({
  id: movieId("allocine", String(id)),
  title,
  originalTitle,
  synopsis: null,
  runtime: null,
  genres: [],
  productionYear,
  countries: [],
  directors,
  url: `https://www.allocine.fr/film/fichefilm_gen_cfilm=${String(id)}.html`,
});

const fjord = movie(188280, "Fjord", "Fjord", 2026, ["Cristian Mungiu"]);
const beloved = movie(325965, "L’Être Aimé", "El ser querido", 2026, [
  "Rodrigo Sorogoyen",
]);
const surprise = movie(35275, "Film surprise", "Film surprise", 2026, []);

test("targets", () => {
  expect(targets([fjord, beloved, surprise])).toMatchSnapshot();
});
