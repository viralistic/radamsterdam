import { CATEGORY_BY_CODE } from "@/lib/categories";
import { requirePro } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";
import { analyticsScope, hotspots, median, openAssignment, toQueueRow } from "@/lib/server/pro";
import { proCanSee } from "@/lib/server/reports";
import { read } from "@/lib/server/store";
import { can } from "@/lib/roles";
import { effectiveStatus, isLive } from "@/lib/rules";

/** KPI's voor het operationeel overzicht. Iedere waarde komt met periode en definitie. */
export const GET = handle(async (req: Request) => {
  const ctx = await requirePro("analytics.read");
  const days = Math.min(Number(new URL(req.url).searchParams.get("days") ?? 7) || 7, 90);
  const db = read();
  const now = new Date();
  const scope = analyticsScope(db, ctx);
  const since = now.getTime() - days * 86400_000;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const inPeriod = scope.filter((r) => new Date(r.createdAt).getTime() >= since);

  const live = scope.filter((r) => isLive(r, now));
  const toReview = live.filter((r) => !openAssignment(db, r.id) && effectiveStatus(r, now) !== "in_progress");
  const firstReview = inPeriod
    .filter((r) => r.firstReviewedAt)
    .map((r) => (new Date(r.firstReviewedAt!).getTime() - new Date(r.createdAt).getTime()) / 3600_000);
  const overdue = db.assignments.filter((a) => a.status !== "closed" && a.dueAt && new Date(a.dueAt) < now && scope.some((r) => r.id === a.reportId));
  const recurring = hotspots(scope, { days: 30 }, now).cells.filter((c) => c.recurring).length;

  const byCategory = new Map<string, number>();
  for (const r of inPeriod) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);

  const series: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(startOfDay.getTime() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, count: inPeriod.filter((r) => new Date(r.createdAt).toISOString().slice(0, 10) === key).length });
  }

  const canRead = can(ctx.user.role, "reports.read");
  const priority = canRead
    ? toReview
        .filter((r) => proCanSee(ctx, r))
        .sort((a, b) => (a.priority === "high" ? -1 : 0) - (b.priority === "high" ? -1 : 0) || a.createdAt.localeCompare(b.createdAt))
        .slice(0, 6)
        .map((r) => toQueueRow(db, r, now))
    : [];
  const ids = new Set(scope.map((r) => r.id));
  const recent = canRead
    ? db.events
        .filter((e) => ids.has(e.reportId) && e.type !== "created")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8)
        .map((e) => ({ ...e, number: db.reports.find((r) => r.id === e.reportId)?.number }))
    : [];

  return json({
    days,
    kpis: {
      newToday: scope.filter((r) => new Date(r.createdAt) >= startOfDay).length,
      toReview: toReview.length,
      inProgress: live.filter((r) => effectiveStatus(r, now) === "in_progress").length,
      medianFirstReviewHours: median(firstReview),
      recurringLocations: recurring,
      overdue: overdue.length,
    },
    byCategory: [...byCategory.entries()].map(([code, count]) => ({ code, name: CATEGORY_BY_CODE[code as keyof typeof CATEGORY_BY_CODE].short, count })).sort((a, b) => b.count - a.count),
    series,
    priority,
    recent,
    liveMap: canRead ? live.filter((r) => proCanSee(ctx, r)).map((r) => ({ id: r.id, lat: r.location.lat, lng: r.location.lng, category: r.category, status: effectiveStatus(r, now) })) : [],
  });
});
