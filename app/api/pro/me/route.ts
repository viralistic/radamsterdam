import { requirePro } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";
import { ROLE_INFO } from "@/lib/roles";

export const GET = handle(async () => {
  const { user, org } = await requirePro();
  return json({ user, org, permissions: ROLE_INFO[user.role].permissions });
});
