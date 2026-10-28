import { CATEGORY_BY_CODE } from "@/lib/categories";
import { handle, json } from "@/lib/server/http";
import { isPubliclyListed } from "@/lib/server/reports";
import { read } from "@/lib/server/store";
import { effectiveStatus } from "@/lib/rules";

/** Geaggregeerde historie van een wijk. Kleine aantallen worden niet per categorie getoond. */
export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const area = q.get("area");
  const days = Math.min(Number(q.get("days") ?? 30) || 30, 90);
  const db = read();
  const now = new Date();
  const since = now.getTime() - days * 86400_000;
  const items = db.reports.filter(
    (r) => isPubliclyListed(r, now) && (!area || r.area === area) && new Date(r.createdAt).getTime() >= since && !r.duplicateOf,
  );
  const byCategory = new Map<string, number>();
  for (const r of items) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
  const resolved = items.filter((r) => effectiveStatus(r, now) === "resolved").length;
  const categories = [...byCategory.entries()]
    .map(([code, count]) => ({ code, name: CATEGORY_BY_CODE[code as keyof typeof CATEGORY_BY_CODE].name, count }))
    .sort((a, b) => b.count - a.count);
  const small = categories.filter((c) => c.count < 3);
  return json({
    area: area ?? "Hele stad",
    days,
    total: items.length,
    resolved,
    categories: categories.filter((c) => c.count >= 3),
    otherCount: small.reduce((s, c) => s + c.count, 0),
  });
});
