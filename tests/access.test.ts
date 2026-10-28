import { describe, expect, it } from "vitest";
import { can, ROLES } from "@/lib/roles";
import { proCanSee } from "@/lib/server/reports";
import { hotspots, MIN_CELL_COUNT } from "@/lib/server/pro";
import { ORGANIZATIONS, PRO_USERS } from "@/lib/server/seed";
import type { Report } from "@/lib/types";

const ctx = (userId: string) => {
  const user = PRO_USERS.find((u) => u.id === userId)!;
  return { user, org: ORGANIZATIONS.find((o) => o.id === user.orgId)! };
};

const report = (over: Partial<Report>): Report => ({
  id: "r",
  number: "SR-1",
  category: "WASTE",
  reporterId: null,
  location: { lat: 52.37, lng: 4.89 },
  publicLocation: { lat: 52.37, lng: 4.89 },
  area: "Centrum",
  street: null,
  description: "",
  reviewerNote: "",
  visibility: "public",
  status: "new",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastConfirmedAt: new Date().toISOString(),
  expiresAt: null,
  mediaIds: [],
  orgId: "org-gemeente",
  duplicateOf: null,
  priority: "normal",
  resolvedAt: null,
  resolutionCode: null,
  firstReviewedAt: null,
  ...over,
});

describe("rollen", () => {
  it("geeft platformbeheer en analisten geen toegang tot dossiers", () => {
    expect(can("PLATFORM_ADMIN", "reports.read")).toBe(false);
    expect(can("ANALYST", "reports.read")).toBe(false);
    expect(proCanSee(ctx("u-admin"), report({}))).toBe(false);
    expect(proCanSee(ctx("u-fatima"), report({}))).toBe(false);
  });
  it("laat de politie alleen bevoegde categorieën zien", () => {
    expect(proCanSee(ctx("u-kees"), report({ category: "WASTE" }))).toBe(false);
    expect(proCanSee(ctx("u-kees"), report({ category: "SUSPICIOUS_ACTIVITY", orgId: "org-politie", visibility: "professional" }))).toBe(true);
  });
  it("laat moderators geen afgeschermde hulpvragen zien", () => {
    expect(proCanSee(ctx("u-ruben"), report({ category: "HOMELESSNESS_SUPPORT", visibility: "professional", orgId: "org-outreach" }))).toBe(false);
    expect(proCanSee(ctx("u-ruben"), report({}))).toBe(true);
  });
  it("heeft voor iedere rol een beschrijving", () => {
    expect(ROLES.length).toBe(7);
  });
});

describe("hotspots", () => {
  it("onderdrukt vakken met minder dan het minimum aantal meldingen", () => {
    const now = new Date();
    const few = Array.from({ length: MIN_CELL_COUNT - 1 }, (_, i) => report({ id: `a${i}` }));
    const many = Array.from({ length: 5 }, (_, i) => report({ id: `b${i}`, location: { lat: 52.30, lng: 4.95 } }));
    const res = hotspots([...few, ...many], { days: 30 }, now);
    expect(res.cells).toHaveLength(1);
    expect(res.cells[0].count).toBe(5);
    expect(res.suppressedCells).toBe(1);
  });
});
