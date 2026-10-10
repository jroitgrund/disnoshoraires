export interface City {
  /** The path of the city's pages: `/<slug>/`. */
  readonly slug: string;
  readonly name: string;
  /** "à Marseille", "au Mans". */
  readonly at: string;
  /** The `ville-<id>` of AlloCiné's city page. */
  readonly allocineId: number;
}

export const CITIES: readonly City[] = [
  {
    slug: "aix-en-provence",
    name: "Aix-en-Provence",
    at: "à Aix-en-Provence",
    allocineId: 87860,
  },
  { slug: "bordeaux", name: "Bordeaux", at: "à Bordeaux", allocineId: 96943 },
  { slug: "cannes", name: "Cannes", at: "à Cannes", allocineId: 85268 },
  {
    slug: "clermont-ferrand",
    name: "Clermont-Ferrand",
    at: "à Clermont-Ferrand",
    allocineId: 110514,
  },
  { slug: "dijon", name: "Dijon", at: "à Dijon", allocineId: 91241 },
  { slug: "grenoble", name: "Grenoble", at: "à Grenoble", allocineId: 98857 },
  { slug: "le-mans", name: "Le Mans", at: "au Mans", allocineId: 114889 },
  { slug: "lille", name: "Lille", at: "à Lille", allocineId: 107951 },
  { slug: "lyon", name: "Lyon", at: "à Lyon", allocineId: 113315 },
  {
    slug: "marseille",
    name: "Marseille",
    at: "à Marseille",
    allocineId: 87914,
  },
  { slug: "monaco", name: "Monaco", at: "à Monaco", allocineId: 124868 },
  {
    slug: "montpellier",
    name: "Montpellier",
    at: "à Montpellier",
    allocineId: 97612,
  },
  { slug: "nantes", name: "Nantes", at: "à Nantes", allocineId: 101187 },
  { slug: "nice", name: "Nice", at: "à Nice", allocineId: 85327 },
  { slug: "nimes", name: "Nîmes", at: "à Nîmes", allocineId: 95640 },
  { slug: "paris", name: "Paris", at: "à Paris", allocineId: 115755 },
  { slug: "rennes", name: "Rennes", at: "à Rennes", allocineId: 98024 },
  {
    slug: "strasbourg",
    name: "Strasbourg",
    at: "à Strasbourg",
    allocineId: 112664,
  },
  { slug: "toulouse", name: "Toulouse", at: "à Toulouse", allocineId: 96373 },
  { slug: "tours", name: "Tours", at: "à Tours", allocineId: 98662 },
];

export function cityBySlug(slug: string): City {
  const city = CITIES.find((c) => c.slug === slug);
  if (city == null) {
    throw new Error(`unknown city ${slug}`);
  }
  return city;
}
