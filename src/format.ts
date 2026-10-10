import type { External, Movie, Screening, Theater } from "../shared/schema.ts";
import { SITES, type SiteInfo } from "../shared/sites.ts";

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

const DEAF = "sous-titres pour sourds et malentendants";

/** French cinema labels. A French film in French needs no label. */
export function versionLabel(screening: Screening): Version | null {
  const base = baseVersion(screening);
  if (screening.subtitles !== "deaf") {
    return base;
  }
  if (base == null) {
    return { label: "SME", spoken: DEAF };
  }
  return { label: `${base.label} SME`, spoken: `${base.spoken}, ${DEAF}` };
}

function baseVersion(screening: Screening): Version | null {
  if (screening.language === "dubbed") {
    return { label: "VF", spoken: "version française" };
  }
  if (screening.language === "local") {
    return null;
  }
  if (screening.subtitles === "none") {
    return { label: "VO", spoken: "version originale" };
  }
  return { label: "VOST", spoken: "version originale sous-titrée" };
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
  const search = (site: SiteInfo, query: string): Score => ({
    site: site.name,
    url: site.search(query),
    search: true,
    values: [],
  });
  const outOf = (
    site: SiteInfo,
    page: { url: string; rating: number | null },
  ): Score => ({
    site: site.name,
    url: page.url,
    search: false,
    values: [
      {
        value: page.rating == null ? null : decimal.format(page.rating),
        scale: site.scale,
      },
    ],
  });
  return [
    letterboxd == null
      ? search(
          SITES.letterboxd,
          [movie.originalTitle, movie.productionYear]
            .filter((part) => part != null)
            .join(" "),
        )
      : outOf(SITES.letterboxd, letterboxd),
    sensCritique == null
      ? search(SITES.sensCritique, movie.originalTitle)
      : outOf(SITES.sensCritique, sensCritique),
    rottenTomatoes == null
      ? search(SITES.rottenTomatoes, movie.originalTitle)
      : {
          site: SITES.rottenTomatoes.name,
          url: rottenTomatoes.url,
          search: false,
          // Both meters always show, so press and public never swap places.
          values: [
            { percent: rottenTomatoes.critics, label: "presse" },
            { percent: rottenTomatoes.audience, label: "public" },
          ].map(({ percent, label }) => ({
            value: percent == null ? null : String(percent),
            scale: SITES.rottenTomatoes.scale,
            label,
          })),
        },
    tmdb == null
      ? search(SITES.tmdb, movie.originalTitle)
      : outOf(SITES.tmdb, tmdb),
  ];
}

/** The French article first: the site is in French. */
export function wikipediaLinks(
  external: External | undefined,
): { label: string; url: string }[] {
  const wikipedia = external?.wikipedia;
  return [
    { label: "Wikipédia", url: wikipedia?.fr ?? null },
    { label: "Wikipedia (en)", url: wikipedia?.en ?? null },
  ].flatMap(({ label, url }) => (url == null ? [] : [{ label, url }]));
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
