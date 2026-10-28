import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: number | ResponseInit): NextResponse {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Vangt fouten af en vertaalt ze naar duidelijke, Nederlandse foutmeldingen. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message }, err.status);
      if (err instanceof ZodError) {
        return json({ error: "Controleer de ingevulde gegevens.", issues: err.issues.map((i) => i.message) }, 400);
      }
      console.error(err);
      return json({ error: "Er ging iets mis. Probeer het opnieuw." }, 500);
    }
  };
}

const buckets = new Map<string, number[]>();

/** Eenvoudige rate limiter per sleutel. In productie: Redis of de API-gateway. */
export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    throw new ApiError(429, "Je hebt veel meldingen achter elkaar gedaan. Wacht even en probeer het opnieuw.");
  }
  hits.push(now);
  buckets.set(key, hits);
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
