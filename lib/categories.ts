export type CategoryGroup = "safety" | "livability" | "social" | "traffic";

export type CategoryCode =
  | "WASTE"
  | "VANDALISM"
  | "LIGHTING"
  | "ROAD_HAZARD"
  | "PUBLIC_NUISANCE"
  | "FEEL_UNSAFE"
  | "SUSPICIOUS_ACTIVITY"
  | "PUBLIC_DRUG_USE"
  | "HOMELESSNESS_SUPPORT"
  | "NOISE"
  | "ACCESSIBILITY"
  | "TRAFFIC_OBSTACLE"
  | "FIRE_HAZARD"
  | "ANIMAL_WELFARE"
  | "OTHER";

/**
 * public: zichtbaar op de openbare kaart met exacte locatie en toelichting.
 * public_fuzzy: zichtbaar met afgeronde locatie en een neutrale standaardtekst.
 * professional: alleen zichtbaar voor bevoegde professionals.
 */
export type Visibility = "public" | "public_fuzzy" | "professional";

export interface Category {
  code: CategoryCode;
  name: string;
  short: string;
  group: CategoryGroup;
  /** Neutrale tekst die publiek wordt getoond als de toelichting niet openbaar is. */
  publicText: string;
  /** Voorgestelde geldigheid in uren. null = blijft actueel tot het is opgelost (max 30 dagen zonder bevestiging). */
  defaultTtlHours: number | null;
  defaultVisibility: Visibility;
  /** Standaard verantwoordelijke organisatie (id). */
  defaultOrg: string;
  owner: string;
  /** Toon de 112-check voordat iemand verder gaat. */
  acuteCheck: boolean;
  /** Burgers kunnen deze melding niet samen als opgelost markeren. */
  professionalResolveOnly: boolean;
  icon: string;
}

export const GROUPS: Record<CategoryGroup, { name: string; description: string }> = {
  livability: { name: "Leefbaarheid", description: "Afval, verlichting, stoep en geluid" },
  safety: { name: "Veiligheid", description: "Onveilige plekken en overlast" },
  social: { name: "Hulp", description: "Iemand of iets heeft hulp nodig" },
  traffic: { name: "Verkeer", description: "Obstakels en gevaar op de weg" },
};

export const GROUP_ORDER: CategoryGroup[] = ["livability", "safety", "social", "traffic"];

export const CATEGORIES: Category[] = [
  {
    code: "WASTE",
    name: "Afval of dumping",
    short: "Afval",
    group: "livability",
    publicText: "Afval of grofvuil op straat.",
    defaultTtlHours: 72,
    defaultVisibility: "public",
    defaultOrg: "org-gemeente",
    owner: "Gemeente",
    acuteCheck: false,
    professionalResolveOnly: false,
    icon: "Trash2",
  },
  {
    code: "VANDALISM",
    name: "Graffiti of vandalisme",
    short: "Vandalisme",
    group: "livability",
    publicText: "Schade of graffiti aan de openbare ruimte.",
    defaultTtlHours: null,
    defaultVisibility: "public",
    defaultOrg: "org-gemeente",
    owner: "Gemeente / handhaving",
    acuteCheck: false,
    professionalResolveOnly: false,
    icon: "SprayCan",
  },
  {
    code: "LIGHTING",
    name: "Kapotte straatverlichting",
    short: "Verlichting",
    group: "livability",
    publicText: "Straatverlichting lijkt uitgevallen.",
    defaultTtlHours: null,
    defaultVisibility: "public",
    defaultOrg: "org-gemeente",
    owner: "Gemeente",
    acuteCheck: false,
    professionalResolveOnly: false,
    icon: "LampFloor",
  },
  {
    code: "ROAD_HAZARD",
    name: "Kapotte stoep of weg",
    short: "Wegdek",
    group: "livability",
    publicText: "Schade aan stoep, fietspad of weg.",
    defaultTtlHours: null,
    defaultVisibility: "public",
    defaultOrg: "org-gemeente",
    owner: "Gemeente / wegbeheerder",
    acuteCheck: false,
    professionalResolveOnly: false,
    icon: "Construction",
  },
  {
    code: "NOISE",
    name: "Geluidsoverlast",
    short: "Geluid",
    group: "livability",
    publicText: "Er wordt geluidsoverlast ervaren op deze plek.",
    defaultTtlHours: 3,
    defaultVisibility: "public_fuzzy",
    defaultOrg: "org-handhaving",
    owner: "Gemeente / handhaving",
    acuteCheck: false,
    professionalResolveOnly: false,
    icon: "Volume2",
  },
  {
    code: "FEEL_UNSAFE",
    name: "Onveilig gevoel",
    short: "Onveilig gevoel",
    group: "safety",
    publicText: "Iemand voelt zich hier onveilig.",
    defaultTtlHours: 6,
    defaultVisibility: "public_fuzzy",
    defaultOrg: "org-gemeente",
    owner: "Gemeente / veiligheidsdienst",
    acuteCheck: true,
    professionalResolveOnly: true,
    icon: "ShieldAlert",
  },
  {
    code: "PUBLIC_NUISANCE",
    name: "Overlast of intimidatie",
    short: "Overlast",
    group: "safety",
    publicText: "Er wordt overlast ervaren in dit gebied.",
    defaultTtlHours: 3,
    defaultVisibility: "public_fuzzy",
    defaultOrg: "org-handhaving",
    owner: "Handhaving",
    acuteCheck: true,
    professionalResolveOnly: true,
    icon: "Megaphone",
  },
  {
    code: "SUSPICIOUS_ACTIVITY",
    name: "Verdachte situatie",
    short: "Verdachte situatie",
    group: "safety",
    publicText: "Situatie gemeld voor beoordeling door een bevoegde dienst.",
    defaultTtlHours: 2,
    defaultVisibility: "professional",
    defaultOrg: "org-politie",
    owner: "Beoordeling door bevoegde dienst",
    acuteCheck: true,
    professionalResolveOnly: true,
    icon: "Eye",
  },
  {
    code: "FIRE_HAZARD",
    name: "Rook of brandgevaar",
    short: "Brandgevaar",
    group: "safety",
    publicText: "Mogelijk rook of brandgevaar in dit gebied.",
    defaultTtlHours: 2,
    defaultVisibility: "public_fuzzy",
    defaultOrg: "org-handhaving",
    owner: "Hulpdiensten bij acute dreiging",
    acuteCheck: true,
    professionalResolveOnly: true,
    icon: "Flame",
  },
  {
    code: "PUBLIC_DRUG_USE",
    name: "Openlijk drugsgebruik",
    short: "Drugsgebruik",
    group: "social",
    publicText: "Signaal van drugsgebruik in dit gebied.",
    defaultTtlHours: 3,
    defaultVisibility: "public_fuzzy",
    defaultOrg: "org-handhaving",
    owner: "Gemeente / hulpverlening / politie",
    acuteCheck: false,
    professionalResolveOnly: true,
    icon: "Pill",
  },
  {
    code: "HOMELESSNESS_SUPPORT",
    name: "Iemand slaapt buiten en kan hulp gebruiken",
    short: "Hulpvraag buiten",
    group: "social",
    publicText: "Hulpvraag doorgegeven aan het outreachteam.",
    defaultTtlHours: 12,
    defaultVisibility: "professional",
    defaultOrg: "org-outreach",
    owner: "Outreachend hulpteam",
    acuteCheck: false,
    professionalResolveOnly: true,
    icon: "HeartHandshake",
  },
  {
    code: "ANIMAL_WELFARE",
    name: "Dier in nood",
    short: "Dier in nood",
    group: "social",
    publicText: "Een dier lijkt hulp nodig te hebben.",
    defaultTtlHours: 6,
    defaultVisibility: "public",
    defaultOrg: "org-gemeente",
    owner: "Dierenhulpdienst",
    acuteCheck: false,
    professionalResolveOnly: false,
    icon: "PawPrint",
  },
  {
    code: "ACCESSIBILITY",
    name: "Stoep of doorgang geblokkeerd",
    short: "Toegankelijkheid",
    group: "traffic",
    publicText: "Doorgang is geblokkeerd voor voetgangers of rolstoelen.",
    defaultTtlHours: 48,
    defaultVisibility: "public",
    defaultOrg: "org-gemeente",
    owner: "Gemeente",
    acuteCheck: false,
    professionalResolveOnly: false,
    icon: "Accessibility",
  },
  {
    code: "TRAFFIC_OBSTACLE",
    name: "Obstakel of gevaar op de weg",
    short: "Verkeersobstakel",
    group: "traffic",
    publicText: "Obstakel of gevaarlijke situatie voor verkeer.",
    defaultTtlHours: 6,
    defaultVisibility: "public",
    defaultOrg: "org-gemeente",
    owner: "Wegbeheerder",
    acuteCheck: false,
    professionalResolveOnly: false,
    icon: "TriangleAlert",
  },
  {
    code: "OTHER",
    name: "Iets anders",
    short: "Overig",
    group: "livability",
    publicText: "Overige situatie in de openbare ruimte.",
    defaultTtlHours: 24,
    defaultVisibility: "public",
    defaultOrg: "org-gemeente",
    owner: "Handmatige beoordeling",
    acuteCheck: false,
    professionalResolveOnly: false,
    icon: "CircleHelp",
  },
];

export const CATEGORY_BY_CODE: Record<CategoryCode, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.code, c]),
) as Record<CategoryCode, Category>;

export function getCategory(code: string): Category | undefined {
  return CATEGORY_BY_CODE[code as CategoryCode];
}

export const VISIBILITY_LABEL: Record<Visibility, { title: string; text: string }> = {
  public: {
    title: "Zichtbaar voor iedereen",
    text: "Buren zien je melding op de kaart. Je naam wordt nooit getoond.",
  },
  public_fuzzy: {
    title: "Zichtbaar met globale locatie",
    text: "Buren zien alleen het gebied en een neutrale tekst. Je toelichting gaat alleen naar de beoordelaar.",
  },
  professional: {
    title: "Alleen voor de bevoegde dienst",
    text: "Deze melding staat niet op de openbare kaart. Alleen de verantwoordelijke dienst ziet hem.",
  },
};
