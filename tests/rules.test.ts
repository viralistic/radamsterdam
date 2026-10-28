import { describe, expect, it } from "vitest";
import {
  computeExpiry,
  effectiveStatus,
  evaluateConfirmations,
  isLive,
  latestPerUser,
  reliability,
  scrubText,
} from "@/lib/rules";
import { fuzzLocation } from "@/lib/areas";
import type { Confirmation } from "@/lib/types";

const now = new Date("2026-10-28T12:00:00Z");
const iso = (minAgo: number) => new Date(now.getTime() - minAgo * 60_000).toISOString();
const vote = (userId: string, type: Confirmation["type"], minAgo: number): Confirmation => ({
  id: `${userId}-${minAgo}`,
  reportId: "r1",
  userId,
  type,
  createdAt: iso(minAgo),
});

const base = {
  status: "new" as const,
  reporterId: "reporter",
  lastConfirmedAt: iso(60),
  category: "WASTE" as const,
  expiresAt: computeExpiry(iso(60), 72),
};

describe("verlopen", () => {
  it("laat een melding verlopen na de geldigheidsduur", () => {
    expect(effectiveStatus({ status: "new", expiresAt: iso(1) }, now)).toBe("expired");
    expect(isLive({ status: "confirmed", expiresAt: iso(-10) }, now)).toBe(true);
  });
  it("laat meldingen in behandeling nooit automatisch verlopen", () => {
    expect(effectiveStatus({ status: "in_progress", expiresAt: iso(100) }, now)).toBe("in_progress");
  });
  it("gebruikt een maximum van 30 dagen voor meldingen zonder vaste duur", () => {
    const exp = computeExpiry(now.toISOString(), null);
    expect(new Date(exp).getTime() - now.getTime()).toBe(30 * 86400_000);
  });
});

describe("bevestigen", () => {
  it("telt de melder niet mee en vraagt twee onafhankelijke bevestigingen", () => {
    expect(evaluateConfirmations(base, [vote("reporter", "present", 5), vote("a", "present", 4)], now).status).toBe("new");
    expect(evaluateConfirmations(base, [vote("a", "present", 4), vote("b", "present", 3)], now).status).toBe("confirmed");
  });
  it("telt per persoon alleen de laatste stem", () => {
    const votes = [vote("a", "present", 10), vote("a", "present", 5), vote("a", "gone", 2)];
    expect(latestPerUser(votes)).toHaveLength(1);
    expect(latestPerUser(votes)[0].type).toBe("gone");
  });
  it("lost op door buren na drie 'niet meer aanwezig' na de laatste bevestiging", () => {
    const votes = [vote("a", "present", 30), vote("b", "gone", 3), vote("c", "gone", 2), vote("d", "gone", 1)];
    const out = evaluateConfirmations(base, votes, now);
    expect(out.status).toBe("resolved");
    expect(out.resolvedByCommunity).toBe(true);
  });
  it("negeert oude 'weg'-stemmen van voor een nieuwe bevestiging", () => {
    const votes = [vote("b", "gone", 30), vote("c", "gone", 29), vote("d", "gone", 28), vote("a", "present", 2)];
    expect(evaluateConfirmations(base, votes, now).status).toBe("new");
  });
  it("laat buren veiligheidsmeldingen niet zelf als opgelost markeren", () => {
    const votes = [vote("b", "gone", 3), vote("c", "gone", 2), vote("d", "gone", 1)];
    expect(evaluateConfirmations({ ...base, category: "FEEL_UNSAFE" }, votes, now).status).toBe("new");
  });
});

describe("privacy", () => {
  it("haalt e-mail, telefoonnummers en kentekens uit vrije tekst", () => {
    const out = scrubText("Bel 06-12345678 of mail jan@voorbeeld.nl, auto XX-123-B");
    expect(out).not.toMatch(/0612|06-12|jan@|XX-123/);
  });
  it("rondt gevoelige locaties af", () => {
    const p = { lat: 52.371234, lng: 4.893456 };
    const f = fuzzLocation(p);
    expect(f).not.toEqual(p);
    expect(Math.abs(f.lat - p.lat)).toBeLessThan(0.001);
    expect(fuzzLocation({ lat: p.lat + 0.0001, lng: p.lng })).toEqual(f);
  });
});

describe("betrouwbaarheid", () => {
  it("stijgt met bevestigingen en daalt met correcties", () => {
    expect(reliability(0, 0, iso(5), false, now)).toBe("low");
    expect(reliability(1, 0, iso(5), false, now)).toBe("medium");
    expect(reliability(3, 0, iso(5), false, now)).toBe("high");
    expect(reliability(3, 2, iso(5), false, now)).toBe("low");
    expect(reliability(0, 0, iso(5), true, now)).toBe("high");
  });
});
