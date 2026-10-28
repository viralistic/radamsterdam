import type { DB } from "./store";
import { effectiveStatus } from "../rules";
import { fuzzLocation } from "../areas";
import { CATEGORY_BY_CODE } from "../categories";

const DAY = 86400_000;

/** Bewaartermijnen. Pas aan na de DPIA en afspraken met de verwerkingsverantwoordelijke. */
export const RETENTION = {
  mediaDays: 90,
  reportDetailDays: 365,
  sensitiveDetailDays: 90,
  confirmationIdentityDays: 365,
  auditDays: 730,
};

export function runRetention(db: DB, now: Date, deleteFile: (id: string) => void): void {
  const t = now.getTime();

  // Verlopen meldingen krijgen een vaste status en een logregel.
  for (const r of db.reports) {
    if (r.status !== "expired" && effectiveStatus(r, now) === "expired") {
      r.status = "expired";
      r.updatedAt = r.expiresAt ?? now.toISOString();
      db.events.push({
        id: crypto.randomUUID(),
        reportId: r.id,
        type: "expired",
        actorId: null,
        actorLabel: "Systeem",
        createdAt: r.updatedAt,
        internal: false,
        message: "Verlopen: te lang niet bevestigd.",
      });
    }
  }

  // Foto's na de bewaartermijn verwijderen.
  const expiredMedia = db.media.filter((m) => new Date(m.deleteAfter).getTime() <= t);
  if (expiredMedia.length) {
    const ids = new Set(expiredMedia.map((m) => m.id));
    expiredMedia.forEach((m) => deleteFile(m.id));
    db.media = db.media.filter((m) => !ids.has(m.id));
    for (const r of db.reports) r.mediaIds = r.mediaIds.filter((id) => !ids.has(id));
  }

  // Details van oude meldingen anonimiseren. Het logboek houdt categorie, wijk, tijd en status.
  for (const r of db.reports) {
    if (r.anonymized) continue;
    const sensitive = CATEGORY_BY_CODE[r.category].defaultVisibility === "professional";
    const limit = (sensitive ? RETENTION.sensitiveDetailDays : RETENTION.reportDetailDays) * DAY;
    const closed = r.status === "resolved" || r.status === "expired" || r.status === "withdrawn";
    if (closed && t - new Date(r.createdAt).getTime() > limit) {
      r.description = "";
      r.reviewerNote = "";
      r.reporterId = null;
      r.location = fuzzLocation(r.location);
      r.street = null;
      r.anonymized = true;
    }
  }

  for (const c of db.confirmations) {
    if (t - new Date(c.createdAt).getTime() > RETENTION.confirmationIdentityDays * DAY) c.userId = `anon-${c.id}`;
  }

  db.audit = db.audit.filter((a) => t - new Date(a.createdAt).getTime() <= RETENTION.auditDays * DAY);
}
