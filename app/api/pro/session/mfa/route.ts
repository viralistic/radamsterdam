import { z } from "zod";
import { completeProLogin, DEMO_MFA_CODE, getPendingLogin } from "@/lib/server/auth";
import { ApiError, clientIp, handle, json, rateLimit } from "@/lib/server/http";
import { mutate } from "@/lib/server/store";

const Body = z.object({ code: z.string().regex(/^\d{6}$/) });

/** Stap 2: verificatiecode. In de demo is dit een vaste code. In productie: TOTP of de IdP. */
export const POST = handle(async (req: Request) => {
  rateLimit(`mfa:${clientIp(req)}`, 10, 10 * 60_000);
  const uid = await getPendingLogin();
  if (!uid) throw new ApiError(401, "Je inlogpoging is verlopen. Begin opnieuw.");
  const { code } = Body.parse(await req.json());
  if (code !== DEMO_MFA_CODE) throw new ApiError(401, "Deze code klopt niet.");
  await completeProLogin(uid);
  mutate((db) => {
    const user = db.proUsers.find((u) => u.id === uid)!;
    user.lastLoginAt = new Date().toISOString();
    db.audit.push({ id: crypto.randomUUID(), actorId: user.id, actorName: user.name, orgId: user.orgId, action: "auth.login", target: null, createdAt: user.lastLoginAt, metadata: { mfa: true } });
  });
  return json({ ok: true });
});
