import fs from "node:fs";
import { ensureCitizenId, signedMediaUrl } from "@/lib/server/auth";
import { ApiError, handle, json, rateLimit } from "@/lib/server/http";
import { mediaPath, mutate } from "@/lib/server/store";
import { RETENTION } from "@/lib/server/retention";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function looksLikeImage(buf: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/png") return buf.subarray(0, 4).toString("hex") === "89504e47";
  if (mime === "image/webp") return buf.subarray(8, 12).toString() === "WEBP";
  return false;
}

/**
 * Foto uploaden. De app codeert de foto opnieuw in de browser, waardoor EXIF en GPS-gegevens verdwijnen.
 * Foto's zijn privé en alleen bereikbaar via tijdelijk ondertekende links.
 */
export const POST = handle(async (req: Request) => {
  const citizen = await ensureCitizenId();
  rateLimit(`media:${citizen}`, 10, 10 * 60_000);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Voeg een foto toe.");
  if (!ALLOWED.includes(file.type)) throw new ApiError(400, "Gebruik een JPG-, PNG- of WebP-foto.");
  if (file.size > MAX_BYTES) throw new ApiError(400, "De foto is te groot. Maximaal 2 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buf, file.type)) throw new ApiError(400, "Dit bestand lijkt geen foto te zijn.");

  const id = crypto.randomUUID();
  fs.writeFileSync(mediaPath(id), buf);
  const now = new Date();
  mutate((db) => {
    db.media.push({
      id,
      reportId: null,
      ownerId: citizen,
      mime: file.type,
      size: file.size,
      moderationStatus: "pending",
      createdAt: now.toISOString(),
      deleteAfter: new Date(now.getTime() + RETENTION.mediaDays * 86400_000).toISOString(),
    });
  });
  return json({ id, url: signedMediaUrl(id) }, 201);
});
