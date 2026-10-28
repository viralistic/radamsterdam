import type { DB } from "./store";
import type { Assignment, Confirmation, Organization, ProUser, Report, ReportEvent, ResolutionCode } from "../types";
import { CATEGORY_BY_CODE, type CategoryCode } from "../categories";
import { AREAS, fuzzLocation, nearestArea } from "../areas";
import { computeExpiry, formatReportNumber } from "../rules";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ORGANIZATIONS: Organization[] = [
  {
    id: "org-gemeente",
    name: "Gemeente, Stadsbeheer",
    type: "municipality",
    categories: [
      "WASTE",
      "VANDALISM",
      "LIGHTING",
      "ROAD_HAZARD",
      "FEEL_UNSAFE",
      "ANIMAL_WELFARE",
      "ACCESSIBILITY",
      "TRAFFIC_OBSTACLE",
      "OTHER",
    ],
    areas: [],
    responseHours: 72,
  },
  {
    id: "org-handhaving",
    name: "Handhaving",
    type: "enforcement",
    categories: ["NOISE", "PUBLIC_NUISANCE", "VANDALISM", "FIRE_HAZARD", "PUBLIC_DRUG_USE", "ACCESSIBILITY"],
    areas: [],
    responseHours: 24,
  },
  {
    id: "org-politie",
    name: "Politie, basisteam (pilot)",
    type: "police",
    categories: ["SUSPICIOUS_ACTIVITY", "PUBLIC_NUISANCE", "FEEL_UNSAFE", "FIRE_HAZARD"],
    areas: [],
    responseHours: 4,
  },
  {
    id: "org-outreach",
    name: "Outreachteam dakloosheid",
    type: "care",
    categories: ["HOMELESSNESS_SUPPORT", "PUBLIC_DRUG_USE"],
    areas: [],
    responseHours: 12,
  },
  { id: "org-platform", name: "StraatRadar platform", type: "platform", categories: [], areas: [], responseHours: 0 },
];

export const PRO_USERS: ProUser[] = [
  { id: "u-sanne", name: "Sanne Bakker", email: "sanne@gemeente.demo", orgId: "org-gemeente", role: "MUNICIPAL_OPERATOR", active: true, lastLoginAt: null },
  { id: "u-joris", name: "Joris Visser", email: "joris@gemeente.demo", orgId: "org-gemeente", role: "TEAM_MANAGER", active: true, lastLoginAt: null },
  { id: "u-mila", name: "Mila Jansen", email: "mila@handhaving.demo", orgId: "org-handhaving", role: "MUNICIPAL_OPERATOR", active: true, lastLoginAt: null },
  { id: "u-kees", name: "Kees de Boer", email: "kees@politie.demo", orgId: "org-politie", role: "POLICE_OPERATOR", active: true, lastLoginAt: null },
  { id: "u-noor", name: "Noor Hendriks", email: "noor@outreach.demo", orgId: "org-outreach", role: "MUNICIPAL_OPERATOR", active: true, lastLoginAt: null },
  { id: "u-fatima", name: "Fatima El Amrani", email: "fatima@gemeente.demo", orgId: "org-gemeente", role: "ANALYST", active: true, lastLoginAt: null },
  { id: "u-ruben", name: "Ruben Smit", email: "ruben@straatradar.demo", orgId: "org-platform", role: "MODERATOR", active: true, lastLoginAt: null },
  { id: "u-lotte", name: "Lotte Mulder", email: "lotte@gemeente.demo", orgId: "org-gemeente", role: "ORG_ADMIN", active: true, lastLoginAt: null },
  { id: "u-admin", name: "Platformbeheer", email: "admin@straatradar.demo", orgId: "org-platform", role: "PLATFORM_ADMIN", active: true, lastLoginAt: null },
];

/** Terugkerende plekken, zodat het logboek en de hotspotanalyse iets laten zien. */
const HOTSPOTS: { name: string; lat: number; lng: number; category: CategoryCode; perWeek: number; hours?: [number, number]; text: string }[] = [
  { name: "Fietstunnel Museumplein", lat: 52.3597, lng: 4.8848, category: "LIGHTING", perWeek: 2, text: "Lampen in de fietstunnel doen het niet." },
  { name: "Mercatorplein", lat: 52.3681, lng: 4.8513, category: "NOISE", perWeek: 2, hours: [22, 2], text: "Harde muziek op het plein." },
  { name: "Javastraat containers", lat: 52.3631, lng: 4.9395, category: "WASTE", perWeek: 3, text: "Containers lopen over, zakken ernaast." },
  { name: "Buikslotermeerplein", lat: 52.4008, lng: 4.9325, category: "FEEL_UNSAFE", perWeek: 2, hours: [22, 3], text: "Na sluitingstijd voelt het hier onveilig." },
  { name: "Oosterpark", lat: 52.3601, lng: 4.9203, category: "HOMELESSNESS_SUPPORT", perWeek: 1, hours: [5, 9], text: "Iemand slaapt op een bankje en heeft het koud." },
  { name: "Albert Cuypstraat", lat: 52.3557, lng: 4.8945, category: "WASTE", perWeek: 2, text: "Marktafval blijft liggen na sluiting." },
  { name: "Arena Boulevard", lat: 52.3127, lng: 4.944, category: "VANDALISM", perWeek: 1, text: "Nieuwe graffiti op de geluidswand." },
  { name: "Sloterdijk onderdoorgang", lat: 52.3889, lng: 4.8376, category: "LIGHTING", perWeek: 1, text: "Verlichting in de onderdoorgang flikkert." },
];

const RANDOM_TEXT: Partial<Record<CategoryCode, string[]>> = {
  WASTE: ["Grof afval naast een openbare afvalbak.", "Matras en kartonnen dozen op de stoep.", "Zwerfafval in het plantsoen."],
  VANDALISM: ["Bushokje ingeslagen.", "Graffiti op de brugleuning.", "Bankje in het park vernield."],
  LIGHTING: ["Straatverlichting lijkt uitgevallen.", "Twee lantaarnpalen achter elkaar uit.", "Lamp brandt overdag en 's avonds niet."],
  ROAD_HAZARD: ["Losliggende stoeptegels.", "Diep gat in het fietspad.", "Putdeksel steekt uit."],
  NOISE: ["Bouwlawaai buiten de toegestane tijden.", "Harde muziek uit een boot."],
  FEEL_UNSAFE: ["Donkere hoek bij de ingang van het park.", "Onoverzichtelijke plek bij de halte."],
  PUBLIC_NUISANCE: ["Groep met harde scooters rond het plein.", "Overlast bij de ingang van de supermarkt."],
  SUSPICIOUS_ACTIVITY: ["Iemand probeert fietsen in de stalling open te maken."],
  FIRE_HAZARD: ["Rook uit een afvalcontainer."],
  PUBLIC_DRUG_USE: ["Spuiten liggen bij de speeltuin."],
  ANIMAL_WELFARE: ["Zwaan met vislijn om de poot.", "Kat zit al uren vast in een boom."],
  ACCESSIBILITY: ["Deelscooters blokkeren de stoep.", "Bouwhek staat midden op het trottoir."],
  TRAFFIC_OBSTACLE: ["Omgevallen boom op het fietspad.", "Verkeerslicht staat op knipperen."],
  OTHER: ["Kapotte watertappunt in het park."],
};

const WEIGHTED: CategoryCode[] = [
  "WASTE", "WASTE", "WASTE", "WASTE", "LIGHTING", "LIGHTING", "LIGHTING", "VANDALISM", "VANDALISM",
  "ROAD_HAZARD", "ROAD_HAZARD", "NOISE", "NOISE", "FEEL_UNSAFE", "PUBLIC_NUISANCE", "ACCESSIBILITY",
  "ACCESSIBILITY", "TRAFFIC_OBSTACLE", "ANIMAL_WELFARE", "SUSPICIOUS_ACTIVITY", "FIRE_HAZARD",
  "PUBLIC_DRUG_USE", "OTHER",
];

const STREETS: Record<string, string[]> = {
  Centrum: ["Damrak", "Nieuwmarkt", "Rokin", "Kloveniersburgwal"],
  Jordaan: ["Westerstraat", "Lindengracht", "Rozengracht"],
  "De Pijp": ["Ferdinand Bolstraat", "Sarphatipark", "Van Woustraat"],
  Oost: ["Linnaeusstraat", "Dapperstraat", "Wibautstraat"],
  "Indische Buurt": ["Javastraat", "Javaplein", "Sumatrastraat"],
  Noord: ["Buikslotermeerplein", "Van der Pekstraat", "Mosplein"],
  West: ["Kinkerstraat", "Jan Evertsenstraat", "Mercatorplein"],
  "Bos en Lommer": ["Bos en Lommerweg", "Bos en Lommerplein"],
  "Oud-Zuid": ["Museumplein", "Cornelis Schuytstraat", "Vondelpark"],
  Rivierenbuurt: ["Rijnstraat", "Maasstraat", "Victorieplein"],
  "Nieuw-West": ["Osdorpplein", "Plein '40-'45", "Slotervaart"],
  Zuidoost: ["Arena Boulevard", "Bijlmerplein", "Ganzenhoef"],
  Watergraafsmeer: ["Middenweg", "Linnaeusparkweg"],
  "Oostelijk Havengebied": ["Cruquiusweg", "KNSM-laan", "Borneokade"],
};

export function createSeed(now: Date): Omit<DB, "schemaVersion"> {
  const rand = rng(20261028);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const nowMs = now.getTime();
  const year = now.getFullYear();

  const reports: Report[] = [];
  const confirmations: Confirmation[] = [];
  const events: ReportEvent[] = [];
  const assignments: Assignment[] = [];
  let counter = 1000;

  const orgFor = (c: CategoryCode) => CATEGORY_BY_CODE[c].defaultOrg;
  const staff = (orgId: string) => PRO_USERS.find((u) => u.orgId === orgId && ["MUNICIPAL_OPERATOR", "POLICE_OPERATOR"].includes(u.role));

  function add(category: CategoryCode, lat: number, lng: number, createdMs: number, text: string, streetHint?: string) {
    const cat = CATEGORY_BY_CODE[category];
    const id = crypto.randomUUID();
    const createdAt = new Date(createdMs).toISOString();
    const area = nearestArea({ lat, lng });
    const street = streetHint ?? pick(STREETS[area] ?? ["Onbekende straat"]);
    const ageH = (nowMs - createdMs) / 3600_000;
    const ttl = cat.defaultTtlHours;
    const orgId = orgFor(category);
    const handler = staff(orgId);

    const report: Report = {
      id,
      number: formatReportNumber(++counter, year),
      category,
      reporterId: `seed-citizen-${Math.floor(rand() * 400)}`,
      location: { lat, lng },
      publicLocation: cat.defaultVisibility === "public" ? { lat, lng } : fuzzLocation({ lat, lng }),
      area,
      street,
      description: text,
      reviewerNote: "",
      visibility: cat.defaultVisibility,
      status: "new",
      createdAt,
      updatedAt: createdAt,
      lastConfirmedAt: createdAt,
      expiresAt: computeExpiry(createdAt, ttl),
      mediaIds: [],
      orgId,
      duplicateOf: null,
      priority: cat.acuteCheck ? "high" : "normal",
      resolvedAt: null,
      resolutionCode: null,
      firstReviewedAt: null,
    };
    events.push({ id: crypto.randomUUID(), reportId: id, type: "created", actorId: null, actorLabel: "Inwoner", createdAt, internal: false, message: "Melding ontvangen." });

    // Bevestigingen door buren.
    const nConf = Math.floor(rand() * 5);
    let last = createdMs;
    for (let i = 0; i < nConf; i++) {
      const at = createdMs + rand() * Math.min(ageH, ttl ?? 72) * 3600_000 * 0.8;
      if (at > nowMs) continue;
      last = Math.max(last, at);
      confirmations.push({ id: crypto.randomUUID(), reportId: id, userId: `seed-neighbor-${Math.floor(rand() * 900)}`, type: "present", createdAt: new Date(at).toISOString() });
    }
    report.lastConfirmedAt = new Date(last).toISOString();
    report.expiresAt = computeExpiry(report.lastConfirmedAt, ttl);
    if (nConf >= 2) report.status = "confirmed";

    const live = new Date(report.expiresAt!).getTime() > nowMs;
    const roll = rand();
    const reviewMs = createdMs + (0.5 + rand() * 20) * 3600_000;

    const assign = (closed: boolean, code: ResolutionCode | null, closedMs: number | null) => {
      const a: Assignment = {
        id: crypto.randomUUID(),
        reportId: id,
        orgId,
        assignedTo: handler?.id ?? null,
        team: pick(["Team Noord", "Team Zuid", "Team Oost", "Team West", "Team Centrum"]),
        status: closed ? "closed" : "in_progress",
        dueAt: new Date(reviewMs + (ORGANIZATIONS.find((o) => o.id === orgId)?.responseHours ?? 72) * 3600_000).toISOString(),
        createdAt: new Date(reviewMs).toISOString(),
        closedAt: closedMs ? new Date(closedMs).toISOString() : null,
        resolutionCode: code,
      };
      assignments.push(a);
      report.firstReviewedAt = a.createdAt;
      events.push({ id: crypto.randomUUID(), reportId: id, type: "assigned", actorId: handler?.id ?? null, actorLabel: ORGANIZATIONS.find((o) => o.id === orgId)!.name, createdAt: a.createdAt, internal: false, message: "Opgepakt door de verantwoordelijke dienst." });
    };

    if (reviewMs < nowMs && (!live || roll < 0.45)) {
      if (!live && roll < 0.72) {
        const closedMs = Math.min(nowMs - 3600_000, reviewMs + (2 + rand() * 70) * 3600_000);
        const code: ResolutionCode =
          category === "WASTE" ? "CLEANED" : category === "HOMELESSNESS_SUPPORT" ? "REFERRED_CARE" : category === "SUSPICIOUS_ACTIVITY" ? "NOT_CONFIRMED" : "REPAIRED";
        assign(true, code, closedMs);
        report.status = "resolved";
        report.resolvedAt = new Date(closedMs).toISOString();
        report.resolutionCode = code;
        report.updatedAt = report.resolvedAt;
        events.push({ id: crypto.randomUUID(), reportId: id, type: "status_changed", actorId: handler?.id ?? null, actorLabel: ORGANIZATIONS.find((o) => o.id === orgId)!.name, createdAt: report.resolvedAt, internal: false, message: `Afgehandeld: ${code === "CLEANED" ? "opgeruimd" : code === "REFERRED_CARE" ? "doorgezet naar hulpverlening" : code === "NOT_CONFIRMED" ? "niet bevestigd" : "gerepareerd"}.` });
      } else if (live) {
        assign(false, null, null);
        report.status = "in_progress";
        report.updatedAt = new Date(reviewMs).toISOString();
      }
    }
    reports.push(report);
  }

  // Terugkerende hotspots over de afgelopen 8 weken.
  for (const h of HOTSPOTS) {
    const total = Math.round(h.perWeek * 8);
    for (let i = 0; i < total; i++) {
      const daysAgo = rand() * 56;
      const d = new Date(nowMs - daysAgo * 86400_000);
      if (h.hours) {
        const [from, to] = h.hours;
        const span = (to - from + 24) % 24;
        d.setHours((from + Math.floor(rand() * span)) % 24, Math.floor(rand() * 60));
      }
      const ms = Math.min(d.getTime(), nowMs - 10 * 60_000);
      add(h.category, h.lat + (rand() - 0.5) * 0.0008, h.lng + (rand() - 0.5) * 0.0012, ms, h.text, h.name);
    }
  }

  // Willekeurige historische meldingen.
  for (let i = 0; i < 150; i++) {
    const area = pick(AREAS);
    const category = pick(WEIGHTED);
    const ms = nowMs - rand() * 60 * 86400_000;
    add(category, area.lat + (rand() - 0.5) * 0.018, area.lng + (rand() - 0.5) * 0.03, ms, pick(RANDOM_TEXT[category] ?? ["Situatie in de openbare ruimte."]));
  }

  // Actuele meldingen in de afgelopen uren, zodat de live kaart gevuld is.
  for (let i = 0; i < 36; i++) {
    const area = pick(AREAS.slice(0, 10));
    const category = pick(WEIGHTED);
    const ttl = CATEGORY_BY_CODE[category].defaultTtlHours ?? 72;
    const ms = nowMs - rand() * Math.min(ttl * 0.7, 20) * 3600_000 - 2 * 60_000;
    add(category, area.lat + (rand() - 0.5) * 0.014, area.lng + (rand() - 0.5) * 0.022, ms, pick(RANDOM_TEXT[category] ?? ["Situatie in de openbare ruimte."]));
  }

  reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  events.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    version: 1,
    reportCounter: counter,
    reports,
    confirmations,
    flags: [],
    media: [],
    assignments,
    events,
    organizations: ORGANIZATIONS,
    proUsers: PRO_USERS,
    audit: [
      { id: crypto.randomUUID(), actorId: "u-admin", actorName: "Platformbeheer", orgId: "org-platform", action: "platform.initialized", target: null, createdAt: now.toISOString(), metadata: { note: "Demo-omgeving aangemaakt met fictieve meldingen." } },
    ],
    categoryConfig: {},
    prefs: {},
    lastRetentionAt: null,
  };
}
