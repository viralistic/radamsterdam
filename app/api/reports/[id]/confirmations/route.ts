import { z } from "zod";
import { ensureCitizenId } from "@/lib/server/auth";
import { handle, json, rateLimit } from "@/lib/server/http";
import { confirmReport, toPublic } from "@/lib/server/reports";
import { read } from "@/lib/server/store";

const Body = z.object({ type: z.enum(["present", "gone", "wrong_location", "wrong_category", "duplicate"]) });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const citizen = await ensureCitizenId();
  rateLimit(`confirm:${citizen}`, 40, 10 * 60_000);
  const { type } = Body.parse(await req.json());
  const r = confirmReport(id, citizen, type);
  return json({ report: toPublic(r, read(), citizen) });
});
