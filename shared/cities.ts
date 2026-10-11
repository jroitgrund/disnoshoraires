export interface City {
  /** The path of the city's pages: `/<slug>/`. */
  readonly slug: string;
  readonly name: string;
  /** "à Marseille", "au Mans". */
  readonly at: string;
  /** The `ville-<id>` of AlloCiné's city page. */
  readonly allocineId: number;
  /** About how long the crawl takes in CI. CI starts the longest crawls first. */
  readonly crawlSeconds: number;
  /** The AlloCiné theater ID of the Institut Lumière: AlloCiné lists it without showtimes. */
  readonly institutLumiere?: string;
}

export const CITIES: readonly City[] = [
  {
    slug: "aix-en-provence",
    name: "Aix-en-Provence",
    at: "à Aix-en-Provence",
    allocineId: 87860,
    crawlSeconds: 54,
  },
  {
    slug: "amiens",
    name: "Amiens",
    at: "à Amiens",
    allocineId: 117737,
    crawlSeconds: 76,
  },
  {
    slug: "angers",
    name: "Angers",
    at: "à Angers",
    allocineId: 102559,
    crawlSeconds: 64,
  },
  {
    slug: "annecy",
    name: "Annecy",
    at: "à Annecy",
    allocineId: 115435,
    crawlSeconds: 112,
  },
  {
    slug: "besancon",
    name: "Besançon",
    at: "à Besançon",
    allocineId: 93056,
    crawlSeconds: 100,
  },
  {
    slug: "bordeaux",
    name: "Bordeaux",
    at: "à Bordeaux",
    allocineId: 96943,
    crawlSeconds: 85,
  },
  {
    slug: "brest",
    name: "Brest",
    at: "à Brest",
    allocineId: 95171,
    crawlSeconds: 88,
  },
  {
    slug: "caen",
    name: "Caen",
    at: "à Caen",
    allocineId: 88168,
    crawlSeconds: 76,
  },
  {
    slug: "cannes",
    name: "Cannes",
    at: "à Cannes",
    allocineId: 85268,
    crawlSeconds: 75,
  },
  {
    slug: "clermont-ferrand",
    name: "Clermont-Ferrand",
    at: "à Clermont-Ferrand",
    allocineId: 110514,
    crawlSeconds: 83,
  },
  {
    slug: "dijon",
    name: "Dijon",
    at: "à Dijon",
    allocineId: 91241,
    crawlSeconds: 73,
  },
  {
    slug: "grenoble",
    name: "Grenoble",
    at: "à Grenoble",
    allocineId: 98857,
    crawlSeconds: 71,
  },
  {
    slug: "le-havre",
    name: "Le Havre",
    at: "au Havre",
    allocineId: 116123,
    crawlSeconds: 76,
  },
  {
    slug: "le-mans",
    name: "Le Mans",
    at: "au Mans",
    allocineId: 114889,
    crawlSeconds: 57,
  },
  {
    slug: "lille",
    name: "Lille",
    at: "à Lille",
    allocineId: 107951,
    crawlSeconds: 72,
  },
  {
    slug: "limoges",
    name: "Limoges",
    at: "à Limoges",
    allocineId: 120079,
    crawlSeconds: 76,
  },
  {
    slug: "lyon",
    name: "Lyon",
    at: "à Lyon",
    allocineId: 113315,
    crawlSeconds: 252,
    institutLumiere: "P0050",
  },
  {
    slug: "marseille",
    name: "Marseille",
    at: "à Marseille",
    allocineId: 87914,
    crawlSeconds: 227,
  },
  {
    slug: "metz",
    name: "Metz",
    at: "à Metz",
    allocineId: 106969,
    crawlSeconds: 76,
  },
  {
    slug: "monaco",
    name: "Monaco",
    at: "à Monaco",
    allocineId: 124868,
    crawlSeconds: 41,
  },
  {
    slug: "montpellier",
    name: "Montpellier",
    at: "à Montpellier",
    allocineId: 97612,
    crawlSeconds: 94,
  },
  {
    slug: "mulhouse",
    name: "Mulhouse",
    at: "à Mulhouse",
    allocineId: 113016,
    crawlSeconds: 76,
  },
  {
    slug: "nancy",
    name: "Nancy",
    at: "à Nancy",
    allocineId: 105434,
    crawlSeconds: 88,
  },
  {
    slug: "nantes",
    name: "Nantes",
    at: "à Nantes",
    allocineId: 101187,
    crawlSeconds: 70,
  },
  {
    slug: "nice",
    name: "Nice",
    at: "à Nice",
    allocineId: 85327,
    crawlSeconds: 146,
  },
  {
    slug: "nimes",
    name: "Nîmes",
    at: "à Nîmes",
    allocineId: 95640,
    crawlSeconds: 46,
  },
  {
    slug: "orleans",
    name: "Orléans",
    at: "à Orléans",
    allocineId: 101569,
    crawlSeconds: 64,
  },
  {
    slug: "paris",
    name: "Paris",
    at: "à Paris",
    allocineId: 115755,
    crawlSeconds: 1376,
  },
  {
    slug: "perpignan",
    name: "Perpignan",
    at: "à Perpignan",
    allocineId: 112079,
    crawlSeconds: 76,
  },
  {
    slug: "rennes",
    name: "Rennes",
    at: "à Rennes",
    allocineId: 98024,
    crawlSeconds: 52,
  },
  {
    slug: "rouen",
    name: "Rouen",
    at: "à Rouen",
    allocineId: 116312,
    crawlSeconds: 76,
  },
  {
    slug: "saint-etienne",
    name: "Saint-Étienne",
    at: "à Saint-Étienne",
    allocineId: 100691,
    crawlSeconds: 88,
  },
  {
    slug: "strasbourg",
    name: "Strasbourg",
    at: "à Strasbourg",
    allocineId: 112664,
    crawlSeconds: 87,
  },
  {
    slug: "toulon",
    name: "Toulon",
    at: "à Toulon",
    allocineId: 119194,
    crawlSeconds: 64,
  },
  {
    slug: "toulouse",
    name: "Toulouse",
    at: "à Toulouse",
    allocineId: 96373,
    crawlSeconds: 131,
  },
  {
    slug: "tours",
    name: "Tours",
    at: "à Tours",
    allocineId: 98662,
    crawlSeconds: 75,
  },
];

export function cityBySlug(slug: string): City {
  const city = CITIES.find((c) => c.slug === slug);
  if (city == null) {
    throw new Error(`unknown city ${slug}`);
  }
  return city;
}
