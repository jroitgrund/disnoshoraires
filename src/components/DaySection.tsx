import { isOld } from "../data.ts";
import type { External, Movie, Screening, Theater } from "../data.ts";
import {
  backdropSources,
  formatDayLong,
  formatTime,
  formatTitle,
  mapsUrl,
  relativeDay,
  scores,
  versionLabel,
} from "../format.ts";

interface Props {
  date: string;
  today: string;
  movies: readonly Movie[];
  theaters: ReadonlyMap<string, Theater>;
  external: ReadonlyMap<number, External>;
  /** Shown when the day has no film left. */
  empty: string;
}

/** One day: its films in alphabetical order, each with its theaters and times. */
export function DaySection({
  date,
  today,
  movies,
  theaters,
  external,
  empty,
}: Props) {
  const showing = movies
    .flatMap((movie) => {
      const screenings = movie.screenings.filter((screening) =>
        screening.startsAt.startsWith(date),
      );
      return screenings.length === 0 ? [] : [{ movie, screenings }];
    })
    .toSorted((a, b) => a.movie.title.localeCompare(b.movie.title, "fr"));
  const relative = relativeDay(date, today);
  const long = formatDayLong(date);

  return (
    <section class="day" id={`jour-${date}`} aria-labelledby={`titre-${date}`}>
      <h2 class="day-head" id={`titre-${date}`}>
        <span
          class="day-name"
          aria-hidden={relative == null ? "true" : undefined}
        >
          {relative ?? long.split(" ")[0]}
        </span>{" "}
        <span class="day-date">{long}</span>
      </h2>
      {showing.length === 0 ? (
        <p class="empty">{empty}</p>
      ) : (
        showing.map(({ movie, screenings }) => (
          <FilmEntry
            date={date}
            today={today}
            movie={movie}
            screenings={screenings}
            theaters={theaters}
            external={external.get(movie.id)}
          />
        ))
      )}
    </section>
  );
}

function FilmEntry({
  date,
  today,
  movie,
  screenings,
  theaters,
  external,
}: {
  date: string;
  today: string;
  movie: Movie;
  screenings: readonly Screening[];
  theaters: ReadonlyMap<string, Theater>;
  external: External | undefined;
}) {
  const meta = [
    movie.productionYear,
    movie.countries.join(", "),
    movie.directors.join(", "),
    // "1h 55min" stays on one line.
    movie.runtime?.replace(" ", "\u00a0"),
    movie.genres.join(", "),
  ].filter((part) => part != null && part !== "");
  const backdrop = external?.tmdb?.backdrop;
  const ratings = scores(movie, external);
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
            {isOld(movie, today) && (
              <span class="film-year"> ({movie.productionYear})</span>
            )}
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
          <ul class="scores" aria-label="Notes">
            {ratings.map((score) => (
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
                        {label != null && (
                          <span class="score-label">{label}</span>
                        )}
                      </span>
                    ))}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <ul class="venues">
        {byTheater(screenings, theaters).map(({ theater, list }) => (
          <li class="venue">
            <a
              class="venue-name i i-map"
              href={mapsUrl(theater)}
              target="_blank"
            >
              <TheaterName name={theater.name} />
              <span class="sr-only">, sur Google Maps</span>
            </a>
            <div class="times">
              <ul class="times-row">
                {list.map((screening) => {
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
    </article>
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

/** Theaters in alphabetical order. */
function byTheater(
  screenings: readonly Screening[],
  theaters: ReadonlyMap<string, Theater>,
): { theater: Theater; list: Screening[] }[] {
  return [...Map.groupBy(screenings, (screening) => screening.theaterId)]
    .flatMap(([theaterId, list]) => {
      const theater = theaters.get(theaterId);
      return theater == null ? [] : [{ theater, list }];
    })
    .toSorted((a, b) => a.theater.name.localeCompare(b.theater.name, "fr"));
}
