import { z } from "zod";
import { CATEGORY_BY_CODE } from "@/lib/categories";
import { requirePro } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";
import { addEvent, audit, proCanSee } from "@/lib/server/reports";
import { isSensitive, openAssignment, toQueueRow } from "@/lib/server/pro";
import { mutate, read } from "@/lib/server/store";
import { effectiveStatus } from "@/lib/rules";
import type { ResolutionCode } from "@/lib/types";

const OPEN = ["new", "confirmed", "in_progress", "under_review"];
const PRIORITY = { high: 0, normal: 1, low: 2 };

/** Meldingenwachtrij, beperkt tot de categorieën waarvoor de organisatie bevoegd is. */
export const GET = handle(async (req: Request) => {
  const ctx = await requirePro("reports.read");
  const q = new URL(req.url).searchParams;
  const db = read();
  const now = new Date();
  const status = q.get("status") ?? "open";
  const category = q.get("category");
  const area = q.get("area");
  const assigned = q.get("assigned");
  const search = (q.get("q") ?? "").toLowerCase().trim();
  const page = Math.max(1, Number(q.get("page") ?? 1) || 1);
  const pageSize = Math.min(Number(q.get("pageSize") ?? 25) || 25, 500);

  let rows = db.reports.filter((r) => proCanSee(ctx, r)).map((r) => toQueueRow(db, r, now));
  if (ctx.user.role === "MODERATOR" && status === "open") {
    rows = rows.filter((r) => r.flags > 0 || r.status === "under_review" || db.reports.find((x) => x.id === r.id)!.mediaIds.some((m) => db.media.find((y) => y.id === m)?.moderationStatus === "pending"));
  } else if (status === "open") rows = rows.filter((r) => OPEN.includes(r.status));
  else if (status !== "all") rows = rows.filter((r) => r.status === status);
  if (category) rows = rows.filter((r) => r.category === category);
  if (area) rows = rows.filter((r) => r.area === area);
  if (assigned === "me") rows = rows.filter((r) => r.assigneeId === ctx.user.id);
  if (assigned === "none") rows = rows.filter((r) => !r.assignee);
  if (assigned === "overdue") rows = rows.filter((r) => r.overdue);
  if (search) {
    rows = rows.filter((r) => [r.number, r.area, r.street ?? "", CATEGORY_BY_CODE[r.category].name].join(" ").toLowerCase().includes(search));
  }
  rows.sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || Number(b.overdue) - Number(a.overdue) || a.createdAt.localeCompare(b.createdAt));
  if (status !== "open") rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return json({ items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize });
});

const Bulk = z.object({
  ids: z.array(z.string()).min(1).max(100),
  action: z.enum(["accept", "close"]),
  resolutionCode: z.enum(["REPAIRED", "CLEANED", "NOT_CONFIRMED", "OUT_OF_SCOPE", "DUPLICATE"]).optional(),
});

/** Bulkacties, alleen voor niet-gevoelige meldingen. Gevoelige meldingen worden altijd los beoordeeld. */
export const PATCH = handle(async (req: Request) => {
  const ctx = await requirePro("reports.bulk");
  const body = Bulk.parse(await req.json());
  const result = mutate((db) => {
    let done = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    for (const id of body.ids) {
      const r = db.reports.find((x) => x.id === id);
      if (!r || !proCanSee(ctx, r) || isSensitive(r)) {
        skipped++;
        continue;
      }
      const s = effectiveStatus(r);
      if (body.action === "accept" && (s === "new" || s === "confirmed")) {
        db.assignments.push({ id: crypto.randomUUID(), reportId: r.id, orgId: ctx.org.id, assignedTo: ctx.user.id, team: null, status: "in_progress", dueAt: new Date(Date.now() + ctx.org.responseHours * 3600_000).toISOString(), createdAt: now, closedAt: null, resolutionCode: null });
        r.status = "in_progress";
        r.firstReviewedAt ??= now;
        r.updatedAt = now;
        addEvent(db, r.id, "assigned", "Opgepakt door de verantwoordelijke dienst.", { actorId: ctx.user.id, actorLabel: ctx.org.name });
        done++;
      } else if (body.action === "close" && body.resolutionCode && ["new", "confirmed", "in_progress"].includes(s)) {
        const a = openAssignment(db, r.id);
        if (a) Object.assign(a, { status: "closed", closedAt: now, resolutionCode: body.resolutionCode });
        r.status = "resolved";
        r.resolvedAt = now;
        r.resolutionCode = body.resolutionCode as ResolutionCode;
        r.firstReviewedAt ??= now;
        r.updatedAt = now;
        addEvent(db, r.id, "status_changed", "Afgehandeld door de verantwoordelijke dienst.", { actorId: ctx.user.id, actorLabel: ctx.org.name, metadata: { resolutionCode: body.resolutionCode } });
        done++;
      } else skipped++;
    }
    audit(db, ctx, `reports.bulk_${body.action}`, null, { count: done, skipped });
    return { done, skipped };
  });
  return json(result);
});
