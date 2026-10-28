import { redirect } from "next/navigation";
import { getPro } from "@/lib/server/auth";
import { ROLE_INFO } from "@/lib/roles";
import { ProShell } from "@/components/pro/shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPro();
  if (!ctx) redirect("/pro/login");
  return (
    <ProShell
      user={{ name: ctx.user.name, email: ctx.user.email, role: ctx.user.role, roleName: ROLE_INFO[ctx.user.role].name }}
      org={{ name: ctx.org.name, type: ctx.org.type }}
      permissions={ROLE_INFO[ctx.user.role].permissions}
    >
      {children}
    </ProShell>
  );
}
