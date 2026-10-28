import { CATEGORY_BY_CODE, type CategoryCode, type Visibility } from "./categories";
import type { CategoryConfig, Confirmation, Report, ReportStatus } from "./types";

/** Aantal onafhankelijke bevestigingen (exclusief de melder) voordat een melding "bevestigd" is. */
export const CONFIRM_THRESHOLD = 2;
/** Aantal onafhankelijke "niet meer aanwezig" stemmen waarmee buren een melding als opgelost markeren. */
export const COMMUNITY_RESOLVE_THRESHOLD = 3;
/** Aantal misbruikrapportages waarna een melding wordt verborgen tot een moderator kijkt. */
export const FLAG_REVIEW_THRESHOLD = 3;
/** Meldingen zonder vaste geldigheid verdwijnen na deze periode zonder bevestiging van de live kaart. */
export const MAX_STALE_HOURS = 24 * 30;

export function effectiveTtlHours(code: CategoryCode, config?: CategoryConfig): number | null {
  if (config && config.ttlHours !== undefined) return config.ttlHours;
  return CATEGORY_BY_CODE[code].defaultTtlHours;
}

export function effectiveVisibility(code: CategoryCode, config?: CategoryConfig): Visibility {
  return config?.visibility ?? CATEGORY_BY_CODE[code].defaultVisibility;
}

export function computeExpiry(fromIso: string, ttlHours: number | null): string {
  const hours = ttlHours ?? MAX_STALE_HOURS;
  return new Date(new Date(fromIso).getTime() + hours * 3600_000).toISOString();
}

/** De status zoals die nu geldt, met automatisch verlopen. */
export function effectiveStatus(report: Pick<Report, "status" | "expiresAt">, now = new Date()): ReportStatus {
  if ((report.status === "new" || report.status === "confirmed") && report.expiresAt) {
    if (new Date(report.expiresAt).getTime() <= now.getTime()) return "expired";
  }
  return report.status;
}

export function isLive(report: Pick<Report, "status" | "expiresAt">, now = new Date()): boolean {
  const s = effectiveStatus(report, now);
  return s === "new" || s === "confirmed" || s === "in_progress";
}

/** Eén actieve bevestiging per gebruiker: de laatste telt. */
export function latestPerUser(confirmations: Confirmation[]): Confirmation[] {
  const map = new Map<string, Confirmation>();
  for (const c of confirmations) {
    const prev = map.get(c.userId);
    if (!prev || prev.createdAt <= c.createdAt) map.set(c.userId, c);
  }
  return [...map.values()];
}

export interface ConfirmationOutcome {
  status: ReportStatus;
  present: number;
  gone: number;
  corrections: number;
  lastConfirmedAt: string;
  resolvedByCommunity: boolean;
}

/**
 * Bepaalt de nieuwe status na een bevestiging of correctie.
 * Eén persoon bepaalt nooit zelfstandig of een melding waar is: de melder telt niet mee
 * en per gebruiker telt alleen de laatste stem.
 */
export function evaluateConfirmations(
  report: Pick<Report, "status" | "reporterId" | "lastConfirmedAt" | "category" | "expiresAt">,
  confirmations: Confirmation[],
  now = new Date(),
): ConfirmationOutcome {
  const votes = latestPerUser(confirmations).filter((c) => c.userId !== report.reporterId);
  const present = votes.filter((c) => c.type === "present");
  const lastPresent = present.reduce<string>(
    (acc, c) => (c.createdAt > acc ? c.createdAt : acc),
    report.lastConfirmedAt,
  );
  const goneSinceLastPresent = votes.filter((c) => c.type === "gone" && c.createdAt >= lastPresent);
  const corrections = votes.filter((c) => !["present", "gone"].includes(c.type)).length;

  let status = effectiveStatus(report, now);
  let resolvedByCommunity = false;

  if (status === "new" && present.length >= CONFIRM_THRESHOLD) status = "confirmed";

  const cat = CATEGORY_BY_CODE[report.category];
  if (
    (status === "new" || status === "confirmed") &&
    !cat.professionalResolveOnly &&
    goneSinceLastPresent.length >= COMMUNITY_RESOLVE_THRESHOLD
  ) {
    status = "resolved";
    resolvedByCommunity = true;
  }

  return {
    status,
    present: present.length,
    gone: votes.filter((c) => c.type === "gone").length,
    corrections,
    lastConfirmedAt: lastPresent,
    resolvedByCommunity,
  };
}

/** Eenvoudige betrouwbaarheidsscore op basis van bevestigingen, correcties en ouderdom. */
export function reliability(
  present: number,
  corrections: number,
  createdAt: string,
  hasProfessionalReview: boolean,
  now = new Date(),
): "low" | "medium" | "high" {
  if (hasProfessionalReview) return "high";
  const ageHours = (now.getTime() - new Date(createdAt).getTime()) / 3600_000;
  let score = 1 + present * 1.5 - corrections * 2;
  if (ageHours > 48) score -= 1;
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(\+31|0031|0)[\s-]?(\d[\s-]?){8,9}/g;
const PLATE = /\b([A-Z]{2}-?\d{2,3}-?[A-Z]{1,2}|\d{1,2}-?[A-Z]{2,3}-?\d{1,2}|[A-Z]{1,2}-?\d{3}-?[A-Z]{1,2})\b/g;

/** Haalt persoonsgegevens die we nooit publiek willen tonen uit vrije tekst. */
export function scrubText(text: string): string {
  return text
    .replace(EMAIL, "[verwijderd]")
    .replace(PHONE, "[verwijderd]")
    .replace(PLATE, "[verwijderd]")
    .trim();
}

export function formatReportNumber(n: number, year: number): string {
  return `SR-${year}-${String(n).padStart(6, "0")}`;
}
