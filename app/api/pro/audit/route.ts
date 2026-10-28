import { requirePro } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";
import { read } from "@/lib/server/store";

export const GET = handle(async (req: Request) => {
  const ctx = await requirePro("audit.read");
  const q = new URL(req.url).searchParams;
  const action = q.get("action");
  const page = Math.max(1, Number(q.get("page") ?? 1) || 1);
  const db = read();
  let items = db.audit.filter((a) => ctx.user.role === "PLATFORM_ADMIN" || a.orgId === ctx.org.id);
  if (action) items = items.filter((a) => a.action.startsWith(action));
  items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return json({ items: items.slice((page - 1) * 50, page * 50), total: items.length, page, pageSize: 50 });
});
