import { z } from "zod";
import { CATEGORY_BY_CODE } from "@/lib/categories";
import { requirePro, type ProContext } from "@/lib/server/auth";
import { ApiError, handle, json } from "@/lib/server/http";
import { addEvent, audit, getReportForPro } from "@/lib/server/reports";
import { openAssignment, toDossier } from "@/lib/server/pro";
import { mutate, read, type DB } from "@/lib/server/store";
import { can } from "@/lib/roles";
import { computeExpiry, effectiveStatus, effectiveTtlHours } from "@/lib/rules";
import { RESOLUTION_LABEL } from "@/lib/status";
import type { Report } from "@/lib/types";
import { fuzzLocation } from "@/lib/areas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const ctx = await requirePro("reports.read");
  const { id } = await params;
  const r = getReportForPro(ctx, id);
  // Inzage in gevoelige dossiers wordt vastgelegd.
  if (r.visibility === "professional" || CATEGORY_BY_CODE[r.category].group === "safety") {
    mutate((db) => audit(db, ctx, "report.viewed", r.number));
  }
  return json(toDossier(read(), ctx, r));
});

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({
    action: z.literal("assign"),
    orgId: z.string(),
    assignedTo: z.string().nullish(),
    team: z.string().max(60).nullish(),
    dueHours: z.number().int().min(1).max(24 * 60).nullish(),
  }),
  z.object({
    action: z.literal("close"),
    resolutionCode: z.enum(["REPAIRED", "CLEANED", "REFERRED_CARE", "NOT_CONFIRMED", "OUT_OF_SCOPE", "DUPLICATE"]),
    duplicateOf: z.string().nullish(),
    publicMessage: z.string().max(200).optional(),
  }),
  z.object({ action: z.literal("reopen"), reason: z.string().min(3).max(200) }),
  z.object({ action: z.literal("note"), text: z.string().min(1).max(1000) }),
  z.object({ action: z.literal("priority"), priority: z.enum(["low", "normal", "high"]) }),
  z.object({ action: z.literal("moderate_media"), mediaId: z.string(), decision: z.enum(["approved", "rejected"]) }),
  z.object({ action: z.literal("flags"), decision: z.enum(["dismiss", "uphold"]) }),
  z.object({ action: z.literal("visibility"), visibility: z.enum(["public", "public_fuzzy", "professional"]) }),
]);

type ActionBody = z.infer<typeof Action>;

const MODERATION = new Set(["moderate_media", "flags", "visibility"]);

function apply(db: DB, ctx: ProContext, r: Report, body: ActionBody) {
  const now = new Date().toISOString();
  const actor = { actorId: ctx.user.id, actorLabel: ctx.org.name };
  const status = effectiveStatus(r);
  r.updatedAt = now;

  switch (body.action) {
    case "accept": {
      if (!["new", "confirmed", "under_review"].includes(status)) throw new ApiError(409, "Deze melding is al opgepakt of afgerond.");
      db.assignments.push({ id: crypto.randomUUID(), reportId: r.id, orgId: ctx.org.id, assignedTo: ctx.user.id, team: null, status: "in_progress", dueAt: new Date(Date.now() + ctx.org.responseHours * 3600_000).toISOString(), createdAt: now, closedAt: null, resolutionCode: null });
      r.status = "in_progress";
      r.orgId = ctx.org.id;
      r.firstReviewedAt ??= now;
      addEvent(db, r.id, "assigned", "Opgepakt door de verantwoordelijke dienst.", actor);
      break;
    }
    case "assign": {
      const org = db.organizations.find((o) => o.id === body.orgId && o.type !== "platform");
      if (!org) throw new ApiError(400, "Kies een bestaande organisatie.");
      if (body.assignedTo && !db.proUsers.some((u) => u.id === body.assignedTo && u.orgId === org.id)) {
        throw new ApiError(400, "Deze medewerker hoort niet bij de gekozen organisatie.");
      }
      const prev = openAssignment(db, r.id);
      if (prev) Object.assign(prev, { status: "closed", closedAt: now, resolutionCode: null });
      const dueHours = body.dueHours ?? org.responseHours;
      db.assignments.push({ id: crypto.randomUUID(), reportId: r.id, orgId: org.id, assignedTo: body.assignedTo ?? null, team: body.team ?? null, status: "in_progress", dueAt: new Date(Date.now() + dueHours * 3600_000).toISOString(), createdAt: now, closedAt: null, resolutionCode: null });
      const forwarded = org.id !== r.orgId;
      r.orgId = org.id;
      r.status = "in_progress";
      r.firstReviewedAt ??= now;
      addEvent(db, r.id, "assigned", forwarded ? `Doorgezet naar ${org.name}.` : "Toegewezen binnen de dienst.", { ...actor, metadata: { orgId: org.id, assignedTo: body.assignedTo, dueHours } });
      break;
    }
    case "close": {
      if (!["new", "confirmed", "in_progress", "under_review"].includes(status)) throw new ApiError(409, "Deze melding is al afgerond.");
      const a = openAssignment(db, r.id);
      if (a) Object.assign(a, { status: "closed", closedAt: now, resolutionCode: body.resolutionCode });
      else db.assignments.push({ id: crypto.randomUUID(), reportId: r.id, orgId: ctx.org.id, assignedTo: ctx.user.id, team: null, status: "closed", dueAt: null, createdAt: now, closedAt: now, resolutionCode: body.resolutionCode });
      if (body.resolutionCode === "DUPLICATE") {
        const original = body.duplicateOf ? db.reports.find((x) => x.id === body.duplicateOf) : null;
        if (!original) throw new ApiError(400, "Kies de oorspronkelijke melding.");
        r.duplicateOf = original.id;
      }
      r.status = "resolved";
      r.resolvedAt = now;
      r.resolutionCode = body.resolutionCode;
      r.firstReviewedAt ??= now;
      addEvent(db, r.id, "status_changed", body.publicMessage?.trim() || `Afgehandeld: ${RESOLUTION_LABEL[body.resolutionCode].toLowerCase()}.`, { ...actor, metadata: { resolutionCode: body.resolutionCode } });
      break;
    }
    case "reopen": {
      if (!["resolved", "expired", "withdrawn"].includes(status)) throw new ApiError(409, "Alleen afgeronde meldingen kunnen worden heropend.");
      r.status = "in_progress";
      r.resolvedAt = null;
      r.resolutionCode = null;
      r.lastConfirmedAt = now;
      r.expiresAt = computeExpiry(now, effectiveTtlHours(r.category, db.categoryConfig[r.category]));
      const owner = db.organizations.find((o) => o.id === r.orgId) ?? ctx.org;
      db.assignments.push({ id: crypto.randomUUID(), reportId: r.id, orgId: owner.id, assignedTo: owner.id === ctx.org.id ? ctx.user.id : null, team: null, status: "in_progress", dueAt: new Date(Date.now() + owner.responseHours * 3600_000).toISOString(), createdAt: now, closedAt: null, resolutionCode: null });
      addEvent(db, r.id, "reopened", "Heropend: de situatie is teruggekeerd.", actor);
      addEvent(db, r.id, "note", `Reden heropenen: ${body.reason}`, { ...actor, internal: true, actorLabel: ctx.user.name });
      break;
    }
    case "note":
      addEvent(db, r.id, "note", body.text, { ...actor, internal: true, actorLabel: ctx.user.name });
      break;
    case "priority":
      r.priority = body.priority;
      addEvent(db, r.id, "note", `Prioriteit gewijzigd naar ${body.priority}.`, { ...actor, internal: true, actorLabel: ctx.user.name });
      break;
    case "moderate_media": {
      const m = db.media.find((x) => x.id === body.mediaId && x.reportId === r.id);
      if (!m) throw new ApiError(404, "Foto niet gevonden.");
      m.moderationStatus = body.decision;
      addEvent(db, r.id, "media_moderated", body.decision === "approved" ? "Foto vrijgegeven voor publicatie." : "Foto afgewezen voor publicatie.", { ...actor, internal: true, actorLabel: ctx.user.name });
      break;
    }
    case "flags": {
      const open = db.flags.filter((f) => f.reportId === r.id && f.status === "open");
      open.forEach((f) => (f.status = body.decision === "dismiss" ? "dismissed" : "upheld"));
      if (body.decision === "uphold") {
        r.status = "withdrawn";
        addEvent(db, r.id, "status_changed", "Verwijderd door een moderator wegens strijd met de gebruiksregels.", actor);
      } else if (r.status === "under_review") {
        r.status = r.firstReviewedAt ? "in_progress" : "new";
        addEvent(db, r.id, "status_changed", "Weer zichtbaar na beoordeling door een moderator.", actor);
      }
      break;
    }
    case "visibility": {
      r.visibility = body.visibility;
      r.publicLocation = body.visibility === "public" ? r.location : fuzzLocation(r.location);
      addEvent(db, r.id, "visibility_changed", `Zichtbaarheid gewijzigd naar ${body.visibility}.`, { ...actor, internal: true, actorLabel: ctx.user.name });
      break;
    }
  }
  audit(db, ctx, `report.${body.action}`, r.number, { ...body });
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = Action.parse(await req.json());
  const ctx = await requirePro(MODERATION.has(body.action) ? "reports.moderate" : "reports.handle");
  if (body.action === "visibility" && !can(ctx.user.role, "reports.moderate")) throw new ApiError(403, "Alleen moderators wijzigen zichtbaarheid.");
  const r = getReportForPro(ctx, id);
  mutate((db) => apply(db, ctx, db.reports.find((x) => x.id === r.id)!, body));
  return json(toDossier(read(), ctx, read().reports.find((x) => x.id === r.id)!));
});
