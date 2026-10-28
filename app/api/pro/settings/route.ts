import { z } from "zod";
import { CATEGORIES, type CategoryCode } from "@/lib/categories";
import { requirePro } from "@/lib/server/auth";
import { ApiError, handle, json } from "@/lib/server/http";
import { audit } from "@/lib/server/reports";
import { mutate, read } from "@/lib/server/store";
import { effectiveTtlHours, effectiveVisibility } from "@/lib/rules";
import { RETENTION } from "@/lib/server/retention";

export const GET = handle(async () => {
  const ctx = await requirePro("settings.manage");
  const db = read();
  const editable = (code: CategoryCode) => ctx.user.role === "PLATFORM_ADMIN" || ctx.org.categories.includes(code);
  return json({
    org: ctx.org,
    retention: RETENTION,
    categories: CATEGORIES.map((c) => ({
      code: c.code,
      name: c.name,
      group: c.group,
      ttlHours: effectiveTtlHours(c.code, db.categoryConfig[c.code]),
      visibility: effectiveVisibility(c.code, db.categoryConfig[c.code]),
      active: db.categoryConfig[c.code]?.active !== false,
      orgId: db.categoryConfig[c.code]?.orgId ?? c.defaultOrg,
      editable: editable(c.code),
    })),
    organizations: db.organizations.filter((o) => o.type !== "platform").map((o) => ({ id: o.id, name: o.name })),
  });
});

const codes = CATEGORIES.map((c) => c.code) as [CategoryCode, ...CategoryCode[]];
const Body = z.union([
  z.object({
    type: z.literal("category"),
    code: z.enum(codes),
    ttlHours: z.number().int().min(1).max(24 * 60).nullable(),
    visibility: z.enum(["public", "public_fuzzy", "professional"]),
    active: z.boolean(),
    orgId: z.string(),
  }),
  z.object({ type: z.literal("org"), responseHours: z.number().int().min(1).max(24 * 30) }),
]);

/** Wijzigingen in routering, zichtbaarheid en geldigheid worden altijd gelogd. */
export const PUT = handle(async (req: Request) => {
  const ctx = await requirePro("settings.manage");
  const body = Body.parse(await req.json());
  mutate((db) => {
    if (body.type === "org") {
      const org = db.organizations.find((o) => o.id === ctx.org.id)!;
      audit(db, ctx, "settings.org", org.name, { before: org.responseHours, after: body.responseHours });
      org.responseHours = body.responseHours;
      return;
    }
    if (ctx.user.role !== "PLATFORM_ADMIN" && !ctx.org.categories.includes(body.code)) throw new ApiError(403, "Deze categorie valt buiten je organisatie.");
    if (!db.organizations.some((o) => o.id === body.orgId)) throw new ApiError(400, "Onbekende organisatie.");
    const before = db.categoryConfig[body.code];
    db.categoryConfig[body.code] = { ttlHours: body.ttlHours, visibility: body.visibility, active: body.active, orgId: body.orgId };
    audit(db, ctx, "settings.category", body.code, { before, after: db.categoryConfig[body.code] });
  });
  return json({ ok: true });
});
