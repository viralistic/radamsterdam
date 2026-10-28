import { CATEGORY_BY_CODE, type CategoryCode } from "@/lib/categories";
import { requirePro } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";
import { analyticsScope, median } from "@/lib/server/pro";
import { read } from "@/lib/server/store";
import { effectiveStatus } from "@/lib/rules";

/** Rapportage per categorie en wijk, met vaste definities. */
export const GET = handle(async (req: Request) => {
  const ctx = await requirePro("analytics.read");
  const days = Math.min(Number(new URL(req.url).searchParams.get("days") ?? 30) || 30, 90);
  const db = read();
  const now = new Date();
  const since = now.getTime() - days * 86400_000;
  const items = analyticsScope(db, ctx).filter((r) => new Date(r.createdAt).getTime() >= since && !r.duplicateOf);

  const hours = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3600_000;
  const groupBy = <K extends string>(key: (r: (typeof items)[number]) => K) => {
    const m = new Map<K, typeof items>();
    for (const r of items) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return m;
  };
  const stats = (list: typeof items) => {
    const resolved = list.filter((r) => effectiveStatus(r, now) === "resolved");
    return {
      total: list.length,
      resolved: resolved.length,
      resolvedPct: list.length ? Math.round((resolved.length / list.length) * 100) : 0,
      expired: list.filter((r) => effectiveStatus(r, now) === "expired").length,
      medianResolutionHours: median(resolved.filter((r) => r.resolvedAt).map((r) => hours(r.createdAt, r.resolvedAt!))),
      medianFirstReviewHours: median(list.filter((r) => r.firstReviewedAt).map((r) => hours(r.createdAt, r.firstReviewedAt!))),
    };
  };

  const forwarded = items.filter((r) => r.orgId !== CATEGORY_BY_CODE[r.category].defaultOrg).length;

  return json({
    days,
    overall: { ...stats(items), forwarded, duplicates: analyticsScope(db, ctx).filter((r) => r.duplicateOf && new Date(r.createdAt).getTime() >= since).length },
    byCategory: [...groupBy((r) => r.category).entries()]
      .map(([code, list]) => ({ code, name: CATEGORY_BY_CODE[code as CategoryCode].name, ...stats(list) }))
      .sort((a, b) => b.total - a.total),
    byArea: [...groupBy((r) => r.area).entries()]
      .map(([area, list]) => ({ area, ...stats(list) }))
      .filter((a) => a.total >= 3)
      .sort((a, b) => b.total - a.total),
  });
});
