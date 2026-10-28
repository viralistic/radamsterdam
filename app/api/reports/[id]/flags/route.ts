import { z } from "zod";
import { ensureCitizenId } from "@/lib/server/auth";
import { handle, json, rateLimit } from "@/lib/server/http";
import { flagReport } from "@/lib/server/reports";

const Body = z.object({ reason: z.enum(["abuse", "personal_data", "false_report", "discrimination", "other"]) });

/** Rapportages gaan naar moderatie. Ze verwijderen een melding niet direct. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const citizen = await ensureCitizenId();
  rateLimit(`flag:${citizen}`, 10, 10 * 60_000);
  const { reason } = Body.parse(await req.json());
  flagReport(id, citizen, reason);
  return json({ ok: true });
});
