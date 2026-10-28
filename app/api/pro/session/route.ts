import { z } from "zod";
import { DEMO_MODE, DEMO_PASSWORD, endProSession, getPro, startProLogin } from "@/lib/server/auth";
import { ApiError, clientIp, handle, json, rateLimit } from "@/lib/server/http";
import { read } from "@/lib/server/store";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

/** Stap 1: e-mail en wachtwoord. Daarna volgt altijd MFA. */
export const POST = handle(async (req: Request) => {
  rateLimit(`login:${clientIp(req)}`, 10, 10 * 60_000);
  if (!DEMO_MODE) {
    throw new ApiError(501, "Koppel een identiteitsprovider (bijvoorbeeld via OIDC) om professionele accounts te gebruiken.");
  }
  const { email, password } = Body.parse(await req.json());
  const user = read().proUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.active || password !== DEMO_PASSWORD) {
    throw new ApiError(401, "Deze combinatie van e-mail en wachtwoord klopt niet.");
  }
  await startProLogin(user.id);
  return json({ next: "mfa" });
});

export const GET = handle(async () => {
  const ctx = await getPro();
  return json({ authenticated: !!ctx });
});

export const DELETE = handle(async () => {
  await endProSession();
  return json({ ok: true });
});
