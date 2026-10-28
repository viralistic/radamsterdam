import { z } from "zod";
import { CATEGORIES, CATEGORY_BY_CODE, type CategoryCode, type CategoryGroup } from "@/lib/categories";
import { ensureCitizenId, getCitizenId } from "@/lib/server/auth";
import { clientIp, handle, json, rateLimit } from "@/lib/server/http";
import { createReport, isPubliclyListed, toPublic } from "@/lib/server/reports";
import { read } from "@/lib/server/store";
import { effectiveStatus, isLive } from "@/lib/rules";
import { CITY_CENTER, distanceMeters } from "@/lib/areas";

const PAGE_SIZE = 25;

/** Meldingen zoeken: scope=live voor de kaart, scope=log voor het publieke logboek. */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams;
  const scope = q.get("scope") === "log" ? "log" : "live";
  const viewer = await getCitizenId();
  const db = read();
  const now = new Date();

  const group = q.get("group") as CategoryGroup | null;
  const category = q.get("category") as CategoryCode | null;
  const status = q.get("status");
  const area = q.get("area");
  const search = (q.get("q") ?? "").trim().toLowerCase();
  const days = Math.min(Number(q.get("days") ?? 90) || 90, 90);
  const onlyConfirmed = q.get("confirmed") === "1";
  const recentHours = Number(q.get("recent") ?? 0);
  const bbox = q.get("bbox")?.split(",").map(Number);
  const near = q.get("near")?.split(",").map(Number);
  const radius = Number(q.get("radius") ?? 0);

  let items = db.reports.filter((r) => isPubliclyListed(r, now));
  if (scope === "live") items = items.filter((r) => isLive(r, now));
  else items = items.filter((r) => now.getTime() - new Date(r.createdAt).getTime() <= days * 86400_000);
  if (group) items = items.filter((r) => CATEGORY_BY_CODE[r.category].group === group);
  if (category) items = items.filter((r) => r.category === category);
  if (status) items = items.filter((r) => effectiveStatus(r, now) === status);
  if (area) items = items.filter((r) => r.area === area);
  if (recentHours > 0) items = items.filter((r) => now.getTime() - new Date(r.createdAt).getTime() <= recentHours * 3600_000);

  let list = items.map((r) => toPublic(r, db, viewer, now));
  if (onlyConfirmed) list = list.filter((r) => r.status === "confirmed" || r.confirmations >= 2);
  if (bbox?.length === 4 && bbox.every(Number.isFinite)) {
    const [w, s, e, n] = bbox;
    list = list.filter((r) => r.location.lng >= w && r.location.lng <= e && r.location.lat >= s && r.location.lat <= n);
  }
  if (near?.length === 2 && near.every(Number.isFinite) && radius > 0) {
    const p = { lat: near[0], lng: near[1] };
    list = list.filter((r) => distanceMeters(p, r.location) <= radius);
  }
  if (search) {
    list = list.filter((r) =>
      [r.text, r.area, r.street ?? "", r.number, CATEGORY_BY_CODE[r.category].name].join(" ").toLowerCase().includes(search),
    );
  }

  if (scope === "live") {
    return json({ items: list.slice(0, 500), total: list.length, center: CITY_CENTER });
  }
  const page = Math.max(1, Number(q.get("page") ?? 1) || 1);
  return json({
    items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: list.length,
    page,
    pageSize: PAGE_SIZE,
  });
});

const codes = CATEGORIES.map((c) => c.code) as [CategoryCode, ...CategoryCode[]];

const NewReport = z.object({
  category: z.enum(codes),
  location: z.object({ lat: z.number().min(50.5).max(53.8), lng: z.number().min(3.2).max(7.3) }),
  street: z.string().max(120).nullish(),
  description: z.string().max(300).optional(),
  reviewerNote: z.string().max(500).optional(),
  mediaId: z.string().uuid().nullish(),
  privacyAck: z.boolean().optional(),
});

export const POST = handle(async (req: Request) => {
  const citizen = await ensureCitizenId();
  rateLimit(`report:${citizen}`, 6, 10 * 60_000);
  rateLimit(`report-ip:${clientIp(req)}`, 30, 10 * 60_000);
  const body = NewReport.parse(await req.json());
  if ((body.description || body.mediaId) && !body.privacyAck) {
    return json({ error: "Bevestig dat je geen onnodige persoonsgegevens of herkenbare gezichten hebt toegevoegd." }, 400);
  }
  const report = createReport(body, citizen);
  return json({ report: toPublic(report, read(), citizen) }, 201);
});
