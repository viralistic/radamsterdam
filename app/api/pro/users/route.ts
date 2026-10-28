import { z } from "zod";
import { requirePro } from "@/lib/server/auth";
import { ApiError, handle, json } from "@/lib/server/http";
import { audit } from "@/lib/server/reports";
import { mutate, read } from "@/lib/server/store";
import { ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";

const roleEnum = z.enum(ROLES as [Role, ...Role[]]);

export const GET = handle(async () => {
  const ctx = await requirePro("users.manage");
  const db = read();
  const users = db.proUsers.filter((u) => ctx.user.role === "PLATFORM_ADMIN" || u.orgId === ctx.org.id);
  return json({
    users: users.map((u) => ({ ...u, orgName: db.organizations.find((o) => o.id === u.orgId)?.name })),
    organizations: ctx.user.role === "PLATFORM_ADMIN" ? db.organizations : [ctx.org],
  });
});

const Invite = z.object({ name: z.string().min(2).max(80), email: z.string().email(), role: roleEnum, orgId: z.string().optional() });

export const POST = handle(async (req: Request) => {
  const ctx = await requirePro("users.manage");
  const body = Invite.parse(await req.json());
  const orgId = ctx.user.role === "PLATFORM_ADMIN" && body.orgId ? body.orgId : ctx.org.id;
  if (body.role === "PLATFORM_ADMIN" && ctx.user.role !== "PLATFORM_ADMIN") throw new ApiError(403, "Alleen platformbeheer kent deze rol toe.");
  const user = mutate((db) => {
    if (db.proUsers.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) throw new ApiError(409, "Er bestaat al een account met dit e-mailadres.");
    const u = { id: `u-${crypto.randomUUID().slice(0, 8)}`, name: body.name, email: body.email, orgId, role: body.role, active: true, lastLoginAt: null };
    db.proUsers.push(u);
    audit(db, ctx, "user.invited", u.email, { role: u.role, orgId });
    return u;
  });
  return json({ user }, 201);
});

const Update = z.object({ id: z.string(), role: roleEnum.optional(), active: z.boolean().optional() });

export const PATCH = handle(async (req: Request) => {
  const ctx = await requirePro("users.manage");
  const body = Update.parse(await req.json());
  if (body.id === ctx.user.id) throw new ApiError(400, "Je kunt je eigen rol of toegang niet wijzigen. Vraag een andere beheerder.");
  if (body.role === "PLATFORM_ADMIN" && ctx.user.role !== "PLATFORM_ADMIN") throw new ApiError(403, "Alleen platformbeheer kent deze rol toe.");
  const user = mutate((db) => {
    const u = db.proUsers.find((x) => x.id === body.id && (ctx.user.role === "PLATFORM_ADMIN" || x.orgId === ctx.org.id));
    if (!u) throw new ApiError(404, "Gebruiker niet gevonden.");
    const before = { role: u.role, active: u.active };
    if (body.role) u.role = body.role;
    if (body.active !== undefined) u.active = body.active;
    audit(db, ctx, body.active === false ? "user.access_revoked" : "user.updated", u.email, { before, after: { role: u.role, active: u.active } });
    return u;
  });
  return json({ user });
});
