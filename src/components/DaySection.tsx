import type { External, Movie } from "../../shared/schema.ts";
import {
  backdropSources,
  formatDayLong,
  formatTime,
  formatTitle,
  mapsUrl,
  scores,
  versionLabel,
  wikipediaLinks,
} from "../format.ts";
import type { Day, Showing, Venue } from "../programme.ts";

interface Props {
  day: Day;
}

/** One day: its films, each with its theaters and times. */
export function DaySection({ day }: Props) {
  const long = formatDayLong(day.date);

  return (
    <section
      class="day"
      id={`jour-${day.date}`}
      aria-labelledby={`titre-${day.date}`}
    >
      <h2 class="day-head" id={`titre-${day.date}`}>
        <span class="day-name" aria-hidden="true">
          {long.split(" ")[0]}
        </span>{" "}
        <span class="day-date">{long}</span>
      </h2>
      {day.showings.length === 0 ? (
        <p class="empty">Plus de séance ce jour.</p>
      ) : (
        day.showings.map((showing) => (
          <FilmEntry date={day.date} showing={showing} />
        ))
      )}
    </section>
  );
}

function FilmEntry({ date, showing }: { date: string; showing: Showing }) {
  const { movie, external, synopsis, old, venues } = showing;
  const wikipedia = wikipediaLinks(external);
  const meta = [
    movie.productionYear,
    movie.countries.join(", "),
    movie.directors.join(", "),
    // "1h 55min" stays on one line.
    movie.runtime?.replace(" ", "\u00a0"),
    movie.genres.join(", "),
  ].filter((part) => part != null && part !== "");
  const backdrop = external?.tmdb?.backdrop;
  // A film shows once per day: the date keeps the IDs unique on the page.
  const cardId = `fiche-${date}-${movie.id}`;
  const cardTitleId = `${cardId}-titre`;
  const title = formatTitle(movie.title);

  return (
    <article class="film">
      <h3 class="film-title">
        <button class="film-open" type="button" popovertarget={cardId}>
          <span>
            {title}
            {old && <span class="film-year"> ({movie.productionYear})</span>}
          </span>
          <span class="film-cue i i-info" aria-hidden="true" />
        </button>
      </h3>
      <section
        class="card"
        id={cardId}
        popover="auto"
        aria-labelledby={cardTitleId}
      >
        {backdrop != null && (
          <img
            class="card-still"
            {...backdropSources(backdrop)}
            sizes="(min-width: 64rem) 36rem, 100vw"
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
        <div class="card-body">
          <header class="card-head">
            <h4 class="card-title" id={cardTitleId}>
              {title}
            </h4>
            <button
              class="card-close i i-close"
              type="button"
              popovertarget={cardId}
              popovertargetaction="hide"
              aria-label={`Fermer la fiche de ${movie.title}`}
            />
          </header>
          {movie.originalTitle !== movie.title && (
            <p class="film-original">{movie.originalTitle}</p>
          )}
          <p class="film-meta">{meta.join(" / ")}</p>
          {synopsis != null && <p class="film-synopsis">{synopsis}</p>}
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
      </section>
      <Venues venues={venues} />
    </article>
  );
}

/** Each site's rating, or a search link when the enrich pass found no page. */
function Scores({
  movie,
  external,
}: {
  movie: Movie;
  external: External | undefined;
}) {
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

function Venues({ venues }: { venues: readonly Venue[] }) {
  return (
    <ul class="venues">
      {venues.map(({ theater, screenings }) => (
        <li class="venue">
          <a class="venue-name i i-map" href={mapsUrl(theater)} target="_blank">
            <TheaterName name={theater.name} />
            <span class="sr-only">, sur Google Maps</span>
          </a>
          <div class="times">
            <ul class="times-row">
              {screenings.map((screening) => {
                const version = versionLabel(screening);
                return (
                  <li class="time">
                    {formatTime(screening.startsAt)}
                    {version != null && (
                      <>
                        <small class="ver" aria-hidden="true">
                          {version.label}
                        </small>
                        <span class="sr-only">, {version.spoken}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A name breaks after its dash, so the line keeps the cinema and the next
 * one its room: "Pathé La Joliette -" over "Dolby Cinema". */
function TheaterName({ name }: { name: string }) {
  const dash = name.indexOf(" - ");
  return dash === -1 ? (
    <>{name}</>
  ) : (
    <>
      {name.slice(0, dash)}
      {"\u00a0- "}
      <span class="nowrap">{name.slice(dash + 3)}</span>
    </>
  );
}
