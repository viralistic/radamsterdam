import fs from "node:fs";
import { clearCitizen, getCitizenId } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";
import { addEvent, toPublic } from "@/lib/server/reports";
import { mediaPath, mutate, read } from "@/lib/server/store";
import type { CitizenPrefs } from "@/lib/types";

const DEFAULT_PREFS: CitizenPrefs = {
  areas: [],
  notifications: { mode: "urgent", digest: "weekly", quietFrom: "22:00", quietTo: "07:00" },
};

export const GET = handle(async () => {
  const viewer = await getCitizenId();
  if (!viewer) return json({ reports: [], prefs: DEFAULT_PREFS, known: false });
  const db = read();
  const reports = db.reports.filter((r) => r.reporterId === viewer).map((r) => toPublic(r, db, viewer));
  return json({ reports, prefs: db.prefs[viewer] ?? DEFAULT_PREFS, known: true });
});

/** Account verwijderen: koppeling met meldingen verbreken, foto's en voorkeuren wissen. */
export const DELETE = handle(async () => {
  const viewer = await getCitizenId();
  if (viewer) {
    mutate((db) => {
      const ownMedia = db.media.filter((m) => m.ownerId === viewer);
      for (const m of ownMedia) fs.rmSync(mediaPath(m.id), { force: true });
      const ids = new Set(ownMedia.map((m) => m.id));
      db.media = db.media.filter((m) => !ids.has(m.id));
      for (const r of db.reports) {
        if (r.reporterId !== viewer) continue;
        r.reporterId = null;
        r.mediaIds = r.mediaIds.filter((id) => !ids.has(id));
        addEvent(db, r.id, "note", "Melder heeft het account verwijderd. Melding is losgekoppeld.", { internal: true });
      }
      db.confirmations = db.confirmations.filter((c) => c.userId !== viewer);
      db.flags = db.flags.map((f) => (f.userId === viewer ? { ...f, userId: `deleted-${f.id}` } : f));
      delete db.prefs[viewer];
    });
  }
  await clearCitizen();
  return json({ ok: true });
});
