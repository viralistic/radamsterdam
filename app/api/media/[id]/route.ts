import fs from "node:fs";
import { verifyMediaSignature } from "@/lib/server/auth";
import { mediaPath, read } from "@/lib/server/store";

/** Serveert een privéfoto alleen met een geldige, tijdelijke handtekening. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id) || !verifyMediaSignature(id, q.get("exp"), q.get("sig"))) {
    return new Response("Link verlopen of ongeldig", { status: 403 });
  }
  const media = read().media.find((m) => m.id === id);
  const file = mediaPath(id);
  if (!media || !fs.existsSync(file)) return new Response("Niet gevonden", { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(file)), {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": "inline",
    },
  });
}
