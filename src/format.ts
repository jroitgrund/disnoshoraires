import type { External, Movie, Screening, Theater } from "./data.ts";

// Dates are calendar days and times are French local times: format them in UTC to keep them as-is.
const dayLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const dayShort = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDayLong(date: string): string {
  return dayLong.format(new Date(`${date}T12:00:00Z`));
}

export function formatDayShort(date: string): string {
  return dayShort.format(new Date(`${date}T12:00:00Z`)).replace(".", "");
}

/** "Aujourd'hui" or "Demain" relative to the build date, else `null`. */
export function relativeDay(date: string, today: string): string | null {
  const offset = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );
  return offset === 0 ? "Aujourd'hui" : offset === 1 ? "Demain" : null;
}

/** French puts a space before ? ! : ; and the sign never starts a line. */
export function formatTitle(title: string): string {
  return title.replace(/ ([?!:;])/g, " $1");
}

export function formatTime(startsAt: string): string {
  return startsAt.slice(11, 16).replace(":", "h");
}

export interface Version {
  /** As printed on French cinema listings. */
  label: string;
  /** What a screen reader says in place of the label. */
  spoken: string;
}

/** French cinema labels. A French film in French needs no label. */
export function versionLabel(screening: Screening): Version | null {
  const base: Version | null =
    screening.language === "dubbed"
      ? { label: "VF", spoken: "version française" }
      : screening.language === "local"
        ? null
        : screening.subtitles === "none"
          ? { label: "VO", spoken: "version originale" }
          : { label: "VOST", spoken: "version originale sous-titrée" };
  if (screening.subtitles !== "deaf") {
    return base;
  }
  const deaf = "sous-titres pour sourds et malentendants";
  return base == null
    ? { label: "SME", spoken: deaf }
    : { label: `${base.label} SME`, spoken: `${base.spoken}, ${deaf}` };
}

export function mapsUrl(theater: Theater): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${theater.name} ${theater.address}`)}`;
}

export interface Score {
  site: string;
  /** The film's page, or a search on the site when the enrich pass found none. */
  url: string;
  search: boolean;
  /**
   * A `null` value has no rating yet. Empty for a search.
   * `scale` is "/5", "/10" or "%": the value means nothing without it.
   */
  values: { value: string | null; scale: string; label?: string }[];
}

const decimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Each site's rating in its own scale: the scales differ too much to merge. */
export function scores(movie: Movie, external: External | undefined): Score[] {
  const { letterboxd, sensCritique, rottenTomatoes, tmdb } = external ?? {};
  const title = encodeURIComponent(movie.originalTitle);
  const search = (site: string, url: string): Score => ({
    site,
    url,
    search: true,
    values: [],
  });
  const outOf = (
    site: string,
    page: { url: string; rating: number | null },
    scale: number,
  ): Score => ({
    site,
    url: page.url,
    search: false,
    values: [
      {
        value: page.rating == null ? null : decimal.format(page.rating),
        scale: `/${scale}`,
      },
    ],
  });
  return [
    letterboxd == null
      ? search(
          "Letterboxd",
          `https://letterboxd.com/search/films/${encodeURIComponent(
            [movie.originalTitle, movie.productionYear]
              .filter((part) => part != null)
              .join(" "),
          )}/`,
        )
      : outOf("Letterboxd", letterboxd, 5),
    sensCritique == null
      ? search(
          "SensCritique",
          `https://www.senscritique.com/search?query=${title}`,
        )
      : outOf("SensCritique", sensCritique, 10),
    rottenTomatoes == null
      ? search(
          "Rotten Tomatoes",
          `https://www.rottentomatoes.com/search?search=${title}`,
        )
      : {
          site: "Rotten Tomatoes",
          url: rottenTomatoes.url,
          search: false,
          // Both meters always show, so press and public never swap places.
          values: [
            { percent: rottenTomatoes.critics, label: "presse" },
            { percent: rottenTomatoes.audience, label: "public" },
          ].map(({ percent, label }) => ({
            value: percent == null ? null : String(percent),
            scale: "%",
            label,
          })),
        },
    tmdb == null
      ? search("TMDB", `https://www.themoviedb.org/search/movie?query=${title}`)
      : outOf("TMDB", tmdb, 10),
  ];
}

/** TMDB serves each image in fixed widths: a phone loads the small one. */
export function backdropSources(url: string): {
  src: string;
  srcset: string | undefined;
} {
  const match = /^(https:\/\/image\.tmdb\.org\/t\/p\/)original(\/.+)$/.exec(
    url,
  );
  if (match == null) {
    return { src: url, srcset: undefined };
  }
  const [, base, file] = match;
  return {
    src: `${base}w780${file}`,
    srcset: [300, 780, 1280]
      .map((width) => `${base}w${width}${file} ${width}w`)
      .join(", "),
  };
}
