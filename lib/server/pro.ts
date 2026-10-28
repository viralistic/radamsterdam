import { CATEGORY_BY_CODE, type CategoryCode } from "../categories";
import { distanceMeters } from "../areas";
import { effectiveStatus, evaluateConfirmations, latestPerUser, reliability, scrubText } from "../rules";
import { can } from "../roles";
import type { Report, ReportStatus } from "../types";
import type { DB } from "./store";
import { signedMediaUrl, type ProContext } from "./auth";
import { proCanSee } from "./reports";

export interface QueueRow {
  id: string;
  number: string;
  category: CategoryCode;
  area: string;
  street: string | null;
  location: { lat: number; lng: number };
  createdAt: string;
  priority: Report["priority"];
  status: ReportStatus;
  orgName: string;
  assignee: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  overdue: boolean;
  confirmations: number;
  flags: number;
  sensitive: boolean;
}

export function openAssignment(db: DB, reportId: string) {
  return db.assignments.filter((a) => a.reportId === reportId && a.status !== "closed").at(-1) ?? null;
}

export function isSensitive(r: Report): boolean {
  const cat = CATEGORY_BY_CODE[r.category];
  return r.visibility === "professional" || cat.group === "safety";
}

export function toQueueRow(db: DB, r: Report, now = new Date()): QueueRow {
  const a = openAssignment(db, r.id);
  const outcome = evaluateConfirmations(r, db.confirmations.filter((c) => c.reportId === r.id), now);
  return {
    id: r.id,
    number: r.number,
    category: r.category,
    area: r.area,
    street: r.street,
    location: r.location,
    createdAt: r.createdAt,
    priority: r.priority,
    status: effectiveStatus(r, now),
    orgName: db.organizations.find((o) => o.id === r.orgId)?.name ?? "Onbekend",
    assignee: a?.assignedTo ? (db.proUsers.find((u) => u.id === a.assignedTo)?.name ?? null) : null,
    assigneeId: a?.assignedTo ?? null,
    dueAt: a?.dueAt ?? null,
    overdue: !!a?.dueAt && new Date(a.dueAt) < now,
    confirmations: outcome.present,
    flags: db.flags.filter((f) => f.reportId === r.id && f.status === "open").length,
    sensitive: isSensitive(r),
  };
}

export function toDossier(db: DB, ctx: ProContext, r: Report, now = new Date()) {
  const confs = db.confirmations.filter((c) => c.reportId === r.id);
  const votes = latestPerUser(confs);
  const outcome = evaluateConfirmations(r, confs, now);
  const flags = db.flags.filter((f) => f.reportId === r.id);
  const reporterHistory = r.reporterId ? db.reports.filter((x) => x.reporterId === r.reporterId && x.id !== r.id).length : 0;
  const duplicates = db.reports
    .filter(
      (x) =>
        x.id !== r.id &&
        x.category === r.category &&
        Math.abs(new Date(x.createdAt).getTime() - new Date(r.createdAt).getTime()) < 7 * 86400_000 &&
        distanceMeters(x.location, r.location) < 150 &&
        proCanSee(ctx, x),
    )
    .slice(0, 5)
    .map((x) => ({ id: x.id, number: x.number, createdAt: x.createdAt, status: effectiveStatus(x, now) }));

  return {
    report: {
      ...r,
      status: effectiveStatus(r, now),
      description: r.description,
      publicText: r.visibility === "public" && r.description ? scrubText(r.description) : CATEGORY_BY_CODE[r.category].publicText,
      reporterId: undefined,
    },
    reporter: r.reporterId ? { label: "Anonieme inwoner", otherReports: reporterHistory } : { label: "Melder onbekend of verwijderd", otherReports: 0 },
    quality: {
      present: outcome.present,
      gone: outcome.gone,
      wrongLocation: votes.filter((v) => v.type === "wrong_location").length,
      wrongCategory: votes.filter((v) => v.type === "wrong_category").length,
      duplicate: votes.filter((v) => v.type === "duplicate").length,
      reliability: reliability(outcome.present, outcome.corrections, r.createdAt, !!r.firstReviewedAt, now),
    },
    flags: {
      open: flags.filter((f) => f.status === "open").length,
      reasons: flags.reduce<Record<string, number>>((acc, f) => ((acc[f.reason] = (acc[f.reason] ?? 0) + 1), acc), {}),
    },
    media: r.mediaIds
      .map((id) => db.media.find((m) => m.id === id))
      .filter(Boolean)
      .map((m) => ({ id: m!.id, url: signedMediaUrl(m!.id), moderationStatus: m!.moderationStatus })),
    assignments: db.assignments
      .filter((a) => a.reportId === r.id)
      .map((a) => ({
        ...a,
        orgName: db.organizations.find((o) => o.id === a.orgId)?.name ?? "",
        assigneeName: a.assignedTo ? (db.proUsers.find((u) => u.id === a.assignedTo)?.name ?? null) : null,
      })),
    events: db.events.filter((e) => e.reportId === r.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    duplicates,
    organizations: db.organizations.filter((o) => o.type !== "platform").map((o) => ({ id: o.id, name: o.name })),
    colleagues: db.proUsers
      .filter((u) => u.orgId === ctx.org.id && u.active && can(u.role, "reports.handle"))
      .map((u) => ({ id: u.id, name: u.name })),
    permissions: {
      handle: can(ctx.user.role, "reports.handle"),
      moderate: can(ctx.user.role, "reports.moderate"),
    },
  };
}

/* Analyse */

/** Categorieën waarop de organisatie geaggregeerde analyses mag zien. */
export function analyticsScope(db: DB, ctx: ProContext): Report[] {
  if (ctx.org.type === "platform") return [];
  return db.reports.filter((r) => ctx.org.categories.includes(r.category) || r.orgId === ctx.org.id);
}

const CELL_LAT = 0.0025;
const CELL_LNG = 0.004;
export const MIN_CELL_COUNT = 3;

export interface HotspotFilter {
  days: number;
  category?: CategoryCode | null;
  weekday?: number | null;
  hourFrom?: number | null;
  hourTo?: number | null;
}

function matchesTime(d: Date, f: HotspotFilter): boolean {
  if (f.weekday !== null && f.weekday !== undefined && d.getDay() !== f.weekday) return false;
  if (f.hourFrom !== null && f.hourFrom !== undefined && f.hourTo !== null && f.hourTo !== undefined) {
    const h = d.getHours();
    if (f.hourFrom <= f.hourTo ? h < f.hourFrom || h >= f.hourTo : h < f.hourFrom && h >= f.hourTo) return false;
  }
  return true;
}

export function hotspots(reports: Report[], f: HotspotFilter, now = new Date()) {
  const periodMs = f.days * 86400_000;
  const start = now.getTime() - periodMs;
  const prevStart = start - periodMs;
  const base = reports.filter((r) => !r.duplicateOf && (!f.category || r.category === f.category));
  const inPeriod = (r: Report, from: number, to: number) => {
    const t = new Date(r.createdAt).getTime();
    return t >= from && t < to && matchesTime(new Date(r.createdAt), f);
  };
  const current = base.filter((r) => inPeriod(r, start, now.getTime() + 1));
  const previous = base.filter((r) => inPeriod(r, prevStart, start));

  type Cell = { key: string; lat: number; lng: number; count: number; prev: number; days: Set<string>; resolved: number; cats: Map<string, number>; areas: Map<string, number>; streets: Map<string, number> };
  const cells = new Map<string, Cell>();
  const keyOf = (r: Report) => `${Math.floor(r.location.lat / CELL_LAT)}:${Math.floor(r.location.lng / CELL_LNG)}`;
  for (const r of current) {
    const key = keyOf(r);
    const [i, j] = key.split(":").map(Number);
    const c = cells.get(key) ?? { key, lat: (i + 0.5) * CELL_LAT, lng: (j + 0.5) * CELL_LNG, count: 0, prev: 0, days: new Set(), resolved: 0, cats: new Map(), areas: new Map(), streets: new Map() };
    c.count++;
    c.days.add(r.createdAt.slice(0, 10));
    if (effectiveStatus(r, now) === "resolved") c.resolved++;
    c.cats.set(r.category, (c.cats.get(r.category) ?? 0) + 1);
    c.areas.set(r.area, (c.areas.get(r.area) ?? 0) + 1);
    if (r.street) c.streets.set(r.street, (c.streets.get(r.street) ?? 0) + 1);
    cells.set(key, c);
  }
  for (const r of previous) {
    const c = cells.get(keyOf(r));
    if (c) c.prev++;
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const list = [...cells.values()]
    .filter((c) => c.count >= MIN_CELL_COUNT)
    .map((c) => ({
      id: c.key,
      lat: c.lat,
      lng: c.lng,
      count: c.count,
      previous: c.prev,
      distinctDays: c.days.size,
      recurring: c.days.size >= 3,
      resolvedPct: Math.round((c.resolved / c.count) * 100),
      topCategory: top(c.cats) as CategoryCode,
      area: top(c.areas),
      place: top(c.streets),
    }))
    .sort((a, b) => b.count - a.count);

  const matrix: (number | null)[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of current) {
    const d = new Date(r.createdAt);
    (matrix[d.getDay()][d.getHours()] as number)++;
  }
  for (const row of matrix) for (let h = 0; h < 24; h++) if ((row[h] as number) > 0 && (row[h] as number) < MIN_CELL_COUNT) row[h] = null;

  return {
    cells: list,
    suppressedCells: [...cells.values()].filter((c) => c.count < MIN_CELL_COUNT).length,
    total: current.length,
    matrix,
  };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
