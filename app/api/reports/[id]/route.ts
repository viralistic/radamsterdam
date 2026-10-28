import { getCitizenId } from "@/lib/server/auth";
import { ApiError, handle, json } from "@/lib/server/http";
import { isPubliclyListed, publicEvents, toPublic, withdrawReport } from "@/lib/server/reports";
import { read } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const viewer = await getCitizenId();
  const db = read();
  const r = db.reports.find((x) => x.id === id || x.number === id);
  if (!r || (!isPubliclyListed(r) && r.reporterId !== viewer)) {
    throw new ApiError(404, "Deze melding bestaat niet of is niet openbaar.");
  }
  return json({ report: toPublic(r, db, viewer), events: publicEvents(db, r.id) });
});

/** De melder kan een eigen melding intrekken zolang die nog niet is opgepakt. */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const viewer = await getCitizenId();
  if (!viewer) throw new ApiError(404, "Deze melding is niet gevonden.");
  withdrawReport(id, viewer);
  return json({ ok: true });
});
