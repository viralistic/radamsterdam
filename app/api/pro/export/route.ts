import { CATEGORY_BY_CODE } from "@/lib/categories";
import { requirePro } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { analyticsScope } from "@/lib/server/pro";
import { audit } from "@/lib/server/reports";
import { mutate, read } from "@/lib/server/store";
import { effectiveStatus } from "@/lib/rules";

/** CSV-export zonder toelichting, melder of exacte locatie. Elke export wordt gelogd. */
export const GET = handle(async (req: Request) => {
  const ctx = await requirePro("reports.export");
  const days = Math.min(Number(new URL(req.url).searchParams.get("days") ?? 30) || 30, 90);
  const db = read();
  const now = new Date();
  const since = now.getTime() - days * 86400_000;
  const rows = analyticsScope(db, ctx).filter((r) => new Date(r.createdAt).getTime() >= since);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["meldingsnummer", "categorie", "wijk", "gemeld_op", "status", "afhandeling", "afgehandeld_op", "eerste_beoordeling_op", "dubbel"];
  const lines = rows.map((r) =>
    [r.number, CATEGORY_BY_CODE[r.category].name, r.area, r.createdAt, effectiveStatus(r, now), r.resolutionCode, r.resolvedAt, r.firstReviewedAt, r.duplicateOf ? "ja" : "nee"].map(esc).join(","),
  );
  mutate((d) => audit(d, ctx, "export.csv", null, { days, rows: rows.length }));
  return new Response([header.join(","), ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="straatradar-${days}d-${now.toISOString().slice(0, 10)}.csv"`,
    },
  });
});
