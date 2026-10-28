import { onChange, read } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** Server-Sent Events: de kaart ververst zodra er iets verandert. */
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));
      send(`retry: 5000\nevent: version\ndata: ${read().version}\n\n`);
      const off = onChange((v) => send(`event: version\ndata: ${v}\n\n`));
      const ping = setInterval(() => send(`: ping\n\n`), 25_000);
      cleanup = () => {
        off();
        clearInterval(ping);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* al gesloten */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
