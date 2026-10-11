import { CARD_PARTS } from "../card.ts";
import {
  formatDayLong,
  formatTime,
  formatTitle,
  formatWeekday,
  mapsUrl,
  versionLabel,
} from "../format.ts";
import { ficheHref } from "../paths.ts";
import type { Day, Showing, Venue } from "../programme.ts";

interface Props {
  day: Day;
}

/** One day: its films, each with its theaters and times. */
export function DaySection({ day }: Props) {
  return (
    <section class="day" aria-labelledby={`titre-${day.date}`}>
      <h2 class="day-head" id={`titre-${day.date}`}>
        <span class="day-name" aria-hidden="true">
          {formatWeekday(day.date)}
        </span>{" "}
        <span class="day-date">{formatDayLong(day.date)}</span>
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
  const { movie, slug, old, venues } = showing;
  // A film shows once per day: the date keeps the IDs unique on the page.
  const cardId = `fiche-${date}-${slug}`;
  const cardTitleId = `${cardId}-titre`;
  const title = formatTitle(movie.title);
  const fiche = ficheHref(slug);

  return (
    <article class="film">
      <h3 class="film-title">
        {/* Without JavaScript the card stays empty: the link opens the fiche. */}
        <a
          class="film-open"
          href={fiche}
          target="_blank"
          data-card={cardId}
          aria-haspopup="dialog"
        >
          <span>
            {title}
            {old && <span class="film-year"> ({movie.productionYear})</span>}
          </span>
          <span class="film-cue i i-info" aria-hidden="true" />
        </a>
      </h3>
      <section
        class="card"
        id={cardId}
        popover="auto"
        aria-labelledby={cardTitleId}
        data-fiche={fiche}
      >
        {/* Holds the still's place until the card loads it. */}
        {showing.external.tmdb?.backdrop != null && (
          <div class={CARD_PARTS.still} />
        )}
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
        <div class={CARD_PARTS.summary} />
        <div class={CARD_PARTS.foot} />
      </section>
      <Venues venues={venues} />
    </article>
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
