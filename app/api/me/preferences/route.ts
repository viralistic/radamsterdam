import { z } from "zod";
import { CATEGORIES, type CategoryCode } from "@/lib/categories";
import { ensureCitizenId } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";
import { mutate } from "@/lib/server/store";

const codes = CATEGORIES.map((c) => c.code) as [CategoryCode, ...CategoryCode[]];
const time = z.string().regex(/^\d{2}:\d{2}$/);

const Prefs = z.object({
  areas: z
    .array(
      z.object({
        id: z.string().max(64),
        name: z.string().min(1).max(60),
        lat: z.number(),
        lng: z.number(),
        radius: z.union([z.literal(500), z.literal(1000), z.literal(3000), z.literal(5000)]),
        categories: z.array(z.enum(codes)),
      }),
    )
    .max(5),
  notifications: z.object({
    mode: z.enum(["urgent", "all", "digest", "off"]),
    digest: z.enum(["daily", "weekly"]),
    quietFrom: time,
    quietTo: time,
  }),
});

export const PUT = handle(async (req: Request) => {
  const citizen = await ensureCitizenId();
  const prefs = Prefs.parse(await req.json());
  mutate((db) => {
    db.prefs[citizen] = prefs;
  });
  return json({ prefs });
});
