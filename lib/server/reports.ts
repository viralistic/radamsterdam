import { CATEGORY_BY_CODE, type CategoryCode } from "../categories";
import { fuzzLocation, nearestArea } from "../areas";
import {
  computeExpiry,
  effectiveStatus,
  effectiveTtlHours,
  effectiveVisibility,
  evaluateConfirmations,
  FLAG_REVIEW_THRESHOLD,
  formatReportNumber,
  latestPerUser,
  reliability,
  scrubText,
} from "../rules";
import type {
  ConfirmationType,
  FlagReason,
  LatLng,
  PublicEvent,
  PublicReport,
  Report,
  ReportEvent,
  ReportEventType,
} from "../types";
import { mutate, read, type DB } from "./store";
import { signedMediaUrl, type ProContext } from "./auth";
import { ApiError } from "./http";

export function addEvent(
  db: DB,
  reportId: string,
  type: ReportEventType,
  message: string,
  opts: { actorId?: string | null; actorLabel?: string; internal?: boolean; metadata?: Record<string, unknown>; at?: string } = {},
): ReportEvent {
  const e: ReportEvent = {
    id: crypto.randomUUID(),
    reportId,
    type,
    actorId: opts.actorId ?? null,
    actorLabel: opts.actorLabel ?? "Systeem",
    createdAt: opts.at ?? new Date().toISOString(),
    internal: opts.internal ?? false,
    message,
    metadata: opts.metadata,
  };
  db.events.push(e);
  return e;
}

export function audit(db: DB, ctx: ProContext, action: string, target: string | null, metadata?: Record<string, unknown>) {
  db.audit.push({
    id: crypto.randomUUID(),
    actorId: ctx.user.id,
    actorName: ctx.user.name,
    orgId: ctx.org.id,
    action,
    target,
    createdAt: new Date().toISOString(),
    metadata,
  });
}

/* Publieke weergave */

export function isPubliclyListed(r: Report, now = new Date()): boolean {
  if (r.visibility === "professional") return false;
  const s = effectiveStatus(r, now);
  return s !== "under_review" && s !== "withdrawn";
}

export function toPublic(r: Report, db: DB, viewerId: string | null, now = new Date()): PublicReport {
  const cat = CATEGORY_BY_CODE[r.category];
  const confs = db.confirmations.filter((c) => c.reportId === r.id);
  const outcome = evaluateConfirmations(r, confs, now);
  const mine = viewerId !== null && r.reporterId === viewerId;
  const myConf = viewerId ? latestPerUser(confs).find((c) => c.userId === viewerId) : undefined;
  const exact = r.visibility === "public" || mine;
  const showText = (r.visibility === "public" || mine) && !r.anonymized && r.description;

  let photoUrl: string | null = null;
  const media = r.mediaIds.map((id) => db.media.find((m) => m.id === id)).find(Boolean);
  if (media && (mine || (r.visibility === "public" && media.moderationStatus === "approved"))) {
    photoUrl = signedMediaUrl(media.id);
  }

  return {
    id: r.id,
    number: r.number,
    category: r.category,
    location: exact ? r.location : r.publicLocation,
    approximate: !exact,
    area: r.area,
    // Publiek tonen we alleen de straatnaam, zonder huisnummer.
    street: exact && r.street ? r.street.replace(/\s+\d+\S*$/, "") : null,
    text: showText ? scrubText(r.description) : cat.publicText,
    status: effectiveStatus(r, now),
    createdAt: r.createdAt,
    lastConfirmedAt: r.lastConfirmedAt,
    expiresAt: r.expiresAt,
    confirmations: outcome.present,
    reliability: reliability(outcome.present, outcome.corrections, r.createdAt, !!r.firstReviewedAt, now),
    photoUrl,
    isMine: mine,
    myConfirmation: myConf?.type ?? null,
    myFlagged: viewerId ? db.flags.some((f) => f.reportId === r.id && f.userId === viewerId) : false,
  };
}

export function publicEvents(db: DB, reportId: string): PublicEvent[] {
  return db.events
    .filter((e) => e.reportId === reportId && !e.internal)
    .map((e) => ({ id: e.id, type: e.type, createdAt: e.createdAt, message: e.message }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* Professionele toegang */

/** Welke meldingen een professional mag zien. Server-side, niet alleen in de interface. */
export function proCanSee(ctx: ProContext, r: Report): boolean {
  const role = ctx.user.role;
  if (role === "MODERATOR") return r.visibility !== "professional";
  if (role === "MUNICIPAL_OPERATOR" || role === "TEAM_MANAGER" || role === "POLICE_OPERATOR") {
    return ctx.org.categories.includes(r.category) || r.orgId === ctx.org.id;
  }
  return false;
}

export function getReportForPro(ctx: ProContext, id: string): Report {
  const db = read();
  const r = db.reports.find((x) => x.id === id);
  if (!r || !proCanSee(ctx, r)) throw new ApiError(404, "Deze melding bestaat niet of valt buiten je bevoegdheid.");
  return r;
}

/* Wijzigingen door inwoners */

export interface NewReportInput {
  category: CategoryCode;
  location: LatLng;
  street?: string | null;
  description?: string;
  reviewerNote?: string;
  mediaId?: string | null;
}

export function createReport(input: NewReportInput, reporterId: string): Report {
  return mutate((db) => {
    const cfg = db.categoryConfig[input.category];
    if (cfg?.active === false) throw new ApiError(400, "Deze categorie is tijdelijk niet beschikbaar.");
    const cat = CATEGORY_BY_CODE[input.category];
    const now = new Date();
    const createdAt = now.toISOString();
    const visibility = effectiveVisibility(input.category, cfg);
    db.reportCounter += 1;

    let mediaIds: string[] = [];
    if (input.mediaId) {
      const m = db.media.find((x) => x.id === input.mediaId && x.ownerId === reporterId && !x.reportId);
      if (!m) throw new ApiError(400, "De foto kon niet worden gekoppeld. Voeg hem opnieuw toe.");
      mediaIds = [m.id];
    }

    const report: Report = {
      id: crypto.randomUUID(),
      number: formatReportNumber(db.reportCounter, now.getFullYear()),
      category: input.category,
      reporterId,
      location: input.location,
      publicLocation: visibility === "public" ? input.location : fuzzLocation(input.location),
      area: nearestArea(input.location),
      street: input.street ? input.street.slice(0, 120) : null,
      description: (input.description ?? "").slice(0, 300),
      reviewerNote: (input.reviewerNote ?? "").slice(0, 500),
      visibility,
      status: "new",
      createdAt,
      updatedAt: createdAt,
      lastConfirmedAt: createdAt,
      expiresAt: computeExpiry(createdAt, effectiveTtlHours(input.category, cfg)),
      mediaIds,
      orgId: cfg?.orgId ?? cat.defaultOrg,
      duplicateOf: null,
      priority: cat.acuteCheck ? "high" : "normal",
      resolvedAt: null,
      resolutionCode: null,
      firstReviewedAt: null,
    };
    for (const id of mediaIds) {
      const m = db.media.find((x) => x.id === id)!;
      m.reportId = report.id;
    }
    db.reports.unshift(report);
    addEvent(db, report.id, "created", "Melding ontvangen.", { actorLabel: "Inwoner", at: createdAt });
    return report;
  });
}

export function confirmReport(reportId: string, userId: string, type: ConfirmationType): Report {
  return mutate((db) => {
    const r = db.reports.find((x) => x.id === reportId);
    if (!r || (!isPubliclyListed(r) && r.reporterId !== userId)) throw new ApiError(404, "Deze melding is niet gevonden.");
    const now = new Date();
    const s = effectiveStatus(r, now);
    if (!["new", "confirmed", "in_progress"].includes(s)) {
      throw new ApiError(409, "Deze melding is niet meer actueel. Zie je het probleem nog? Maak een nieuwe melding.");
    }
    if (r.reporterId === userId && (type === "present" || type === "gone")) {
      throw new ApiError(409, "Je kunt je eigen melding niet bevestigen. Vraag een buur om mee te kijken.");
    }

    // Eén actieve bevestiging per persoon: vervang een eerdere stem.
    db.confirmations = db.confirmations.filter((c) => !(c.reportId === r.id && c.userId === userId));
    db.confirmations.push({ id: crypto.randomUUID(), reportId: r.id, userId, type, createdAt: now.toISOString() });

    const outcome = evaluateConfirmations(r, db.confirmations.filter((c) => c.reportId === r.id), now);
    const ttl = effectiveTtlHours(r.category, db.categoryConfig[r.category]);

    if (type === "present") {
      r.lastConfirmedAt = now.toISOString();
      if (r.status !== "in_progress") r.expiresAt = computeExpiry(r.lastConfirmedAt, ttl);
      addEvent(db, r.id, "confirmed", "Een buur meldt dat de situatie nog aanwezig is.", { actorLabel: "Inwoner" });
    } else if (type === "gone") {
      addEvent(db, r.id, "confirmed", "Een buur meldt dat de situatie niet meer aanwezig is.", { actorLabel: "Inwoner" });
    } else {
      const label = { wrong_location: "de locatie niet klopt", wrong_category: "de categorie niet klopt", duplicate: "dit een dubbele melding is" }[type];
      addEvent(db, r.id, "correction", `Een buur geeft aan dat ${label}.`, { actorLabel: "Inwoner", internal: true });
    }

    if (r.status !== "in_progress" && outcome.status !== s) {
      r.status = outcome.status;
      if (outcome.resolvedByCommunity) {
        r.resolvedAt = now.toISOString();
        r.resolutionCode = "COMMUNITY";
        addEvent(db, r.id, "status_changed", "Opgelost: meerdere buren melden dat het verdwenen is.");
      } else if (outcome.status === "confirmed") {
        addEvent(db, r.id, "status_changed", "Bevestigd door meerdere buren.");
      }
    }
    r.updatedAt = now.toISOString();
    return r;
  });
}

export function flagReport(reportId: string, userId: string, reason: FlagReason): void {
  mutate((db) => {
    const r = db.reports.find((x) => x.id === reportId);
    if (!r || !isPubliclyListed(r)) throw new ApiError(404, "Deze melding is niet gevonden.");
    if (db.flags.some((f) => f.reportId === reportId && f.userId === userId)) {
      throw new ApiError(409, "Je hebt deze melding al gerapporteerd. Een moderator kijkt ernaar.");
    }
    db.flags.push({ id: crypto.randomUUID(), reportId, userId, reason, createdAt: new Date().toISOString(), status: "open" });
    addEvent(db, reportId, "flagged", `Gerapporteerd door een inwoner (${reason}).`, { internal: true, actorLabel: "Inwoner" });
    const open = db.flags.filter((f) => f.reportId === reportId && f.status === "open").length;
    if (open >= FLAG_REVIEW_THRESHOLD && r.status !== "under_review") {
      r.status = "under_review";
      r.updatedAt = new Date().toISOString();
      addEvent(db, reportId, "status_changed", "Tijdelijk verborgen: een moderator beoordeelt deze melding.");
    }
  });
}

export function withdrawReport(reportId: string, userId: string): void {
  mutate((db) => {
    const r = db.reports.find((x) => x.id === reportId && x.reporterId === userId);
    if (!r) throw new ApiError(404, "Deze melding is niet gevonden.");
    if (!["new", "confirmed"].includes(effectiveStatus(r))) {
      throw new ApiError(409, "Deze melding is al opgepakt of afgerond en kan niet meer worden ingetrokken.");
    }
    r.status = "withdrawn";
    r.updatedAt = new Date().toISOString();
    addEvent(db, r.id, "status_changed", "Ingetrokken door de melder.", { actorLabel: "Inwoner" });
  });
}
