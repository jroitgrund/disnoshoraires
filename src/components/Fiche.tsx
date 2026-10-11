import type { External, Movie } from "../../shared/schema.ts";
import { CARD_PARTS } from "../card.ts";
import {
  backdropSources,
  formatTitle,
  scores,
  wikipediaLinks,
} from "../format.ts";
import type { Showing } from "../programme.ts";

interface Props {
  showing: Showing;
}

/** The page of a film. A day page loads its still, summary and foot into
 * the film's card when the card opens. */
export function Fiche({ showing }: Props) {
  const backdrop = showing.external.tmdb?.backdrop;

  return (
    <article class="fiche" aria-labelledby="fiche-titre">
      {backdrop != null && (
        <img
          class={CARD_PARTS.still}
          {...backdropSources(backdrop)}
          sizes="(min-width: 64rem) 36rem, 100vw"
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      <header class="card-head">
        <h2 class="card-title" id="fiche-titre">
          {formatTitle(showing.movie.title)}
        </h2>
      </header>
      <FicheSummary showing={showing} />
      <FicheFoot showing={showing} />
    </article>
  );
}

function FicheSummary({ showing }: Props) {
  const { movie, synopsis, genres } = showing;
  const meta = [
    movie.productionYear,
    movie.countries.join(", "),
    movie.directors.join(", "),
    // "1h 55min" stays on one line.
    movie.runtime?.replace(" ", "\u00a0"),
    genres.join(", "),
  ].filter((part) => part != null && part !== "");

  return (
    <div class={CARD_PARTS.summary}>
      {movie.originalTitle !== movie.title && (
        <p class="film-original">{movie.originalTitle}</p>
      )}
      <p class="film-meta">{meta.join(" / ")}</p>
      {synopsis != null && <p class="film-synopsis">{synopsis}</p>}
    </div>
  );
}

function FicheFoot({ showing }: Props) {
  const { movie, external } = showing;
  const wikipedia = wikipediaLinks(external);

  return (
    <div class={CARD_PARTS.foot}>
      <Scores movie={movie} external={external} />
      {wikipedia.length > 0 && (
        <ul class="film-links" aria-label="Encyclopédie">
          {wikipedia.map(({ label, url }) => (
            <li>
              <a class="film-link i i-external" href={url} target="_blank">
                {label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Each site's rating, or a search link when the enrich pass found no page. */
function Scores({ movie, external }: { movie: Movie; external: External }) {
  return (
    <ul class="scores" aria-label="Notes">
      {scores(movie, external).map((score) => (
        <li>
          <a class="score" href={score.url} target="_blank">
            <span class="sr-only">
              {score.search ? "Chercher " : ""}
              {movie.title} sur{" "}
            </span>
            <span class="score-site">{score.site}</span>
            {score.search && (
              <span class="score-search i i-external" aria-hidden="true">
                chercher
              </span>
            )}
            <span class="score-values">
              {score.values.map(({ value, scale, label }) => (
                <span class="score-value">
                  {value == null ? (
                    <span class="score-figure score-none">
                      <span aria-hidden="true">–</span>
                      <span class="sr-only">pas de note</span>
                    </span>
                  ) : (
                    <span class="score-figure">
                      <b>{value}</b>
                      {scale}
                    </span>
                  )}
                  {label != null && <span class="score-label">{label}</span>}
                </span>
              ))}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
