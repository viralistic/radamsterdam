import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { read } from "./store";
import { ApiError } from "./http";
import { can, type Permission } from "../roles";
import type { Organization, ProUser } from "../types";

const CITIZEN_COOKIE = "sr_uid";
const PRO_COOKIE = "sr_pro";
const PENDING_COOKIE = "sr_pro_pending";
const PRO_SESSION_HOURS = 8;

export const DEMO_MODE = process.env.STRAATRADAR_DEMO !== "false";
export const DEMO_PASSWORD = "straatradar";
export const DEMO_MFA_CODE = "246810";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production" && !DEMO_MODE) {
    throw new Error("SESSION_SECRET ontbreekt of is te kort.");
  }
  return "straatradar-dev-secret-alleen-voor-demo";
}

export function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function encodeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeToken<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sign(body), sig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp?: number };
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/* Inwoners: anoniem apparaat-ID, geen account nodig. */

export async function getCitizenId(): Promise<string | null> {
  const jar = await cookies();
  const value = decodeToken<{ id: string }>(jar.get(CITIZEN_COOKIE)?.value);
  return value?.id ?? null;
}

export async function ensureCitizenId(): Promise<string> {
  const existing = await getCitizenId();
  if (existing) return existing;
  const id = `c-${crypto.randomUUID()}`;
  const jar = await cookies();
  jar.set(CITIZEN_COOKIE, encodeToken({ id }), { ...cookieBase, maxAge: 60 * 60 * 24 * 365 });
  return id;
}

export async function clearCitizen(): Promise<void> {
  const jar = await cookies();
  jar.delete(CITIZEN_COOKIE);
}

/* Professionals: wachtwoord + MFA, rolgebonden toegang. */

export async function startProLogin(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(PENDING_COOKIE, encodeToken({ uid: userId, exp: Date.now() + 5 * 60_000 }), { ...cookieBase, maxAge: 300 });
}

export async function getPendingLogin(): Promise<string | null> {
  const jar = await cookies();
  return decodeToken<{ uid: string }>(jar.get(PENDING_COOKIE)?.value)?.uid ?? null;
}

export async function completeProLogin(userId: string): Promise<void> {
  const jar = await cookies();
  jar.delete(PENDING_COOKIE);
  jar.set(PRO_COOKIE, encodeToken({ uid: userId, mfa: true, exp: Date.now() + PRO_SESSION_HOURS * 3600_000 }), {
    ...cookieBase,
    sameSite: "strict",
    maxAge: PRO_SESSION_HOURS * 3600,
  });
}

export async function endProSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(PRO_COOKIE);
  jar.delete(PENDING_COOKIE);
}

export interface ProContext {
  user: ProUser;
  org: Organization;
}

export async function getPro(): Promise<ProContext | null> {
  const jar = await cookies();
  const session = decodeToken<{ uid: string; mfa: boolean }>(jar.get(PRO_COOKIE)?.value);
  if (!session?.mfa) return null;
  const db = read();
  const user = db.proUsers.find((u) => u.id === session.uid);
  if (!user || !user.active) return null;
  const org = db.organizations.find((o) => o.id === user.orgId);
  if (!org) return null;
  return { user, org };
}

export async function requirePro(permission?: Permission): Promise<ProContext> {
  const ctx = await getPro();
  if (!ctx) throw new ApiError(401, "Log opnieuw in om verder te gaan.");
  if (permission && !can(ctx.user.role, permission)) {
    throw new ApiError(403, "Je rol heeft geen toegang tot deze gegevens.");
  }
  return ctx;
}

/* Tijdelijke, ondertekende links voor foto's. */

export function signedMediaUrl(mediaId: string, minutes = 10): string {
  const exp = Date.now() + minutes * 60_000;
  return `/api/media/${mediaId}?exp=${exp}&sig=${sign(`media:${mediaId}:${exp}`)}`;
}

export function verifyMediaSignature(mediaId: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sign(`media:${mediaId}:${exp}`), sig);
}
