import { requirePro } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";
import { analyticsScope, hotspots } from "@/lib/server/pro";
import { read } from "@/lib/server/store";
import type { CategoryCode } from "@/lib/categories";

const num = (v: string | null) => (v === null || v === "" ? null : Number(v));

export const GET = handle(async (req: Request) => {
  const ctx = await requirePro("analytics.read");
  const q = new URL(req.url).searchParams;
  const db = read();
  return json(
    hotspots(analyticsScope(db, ctx), {
      days: Math.min(Number(q.get("days") ?? 30) || 30, 90),
      category: (q.get("category") as CategoryCode) || null,
      weekday: num(q.get("weekday")),
      hourFrom: num(q.get("hourFrom")),
      hourTo: num(q.get("hourTo")),
    }),
  );
});
