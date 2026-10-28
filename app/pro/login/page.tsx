import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DEMO_MFA_CODE, DEMO_MODE, DEMO_PASSWORD, getPro } from "@/lib/server/auth";
import { read } from "@/lib/server/store";
import { ROLE_INFO } from "@/lib/roles";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Inloggen professionals" };
export const dynamic = "force-dynamic";

export default async function ProLoginPage() {
  if (await getPro()) redirect("/pro");
  const db = read();
  const demo = DEMO_MODE
    ? {
        password: DEMO_PASSWORD,
        code: DEMO_MFA_CODE,
        accounts: db.proUsers
          .filter((u) => u.active)
          .map((u) => ({
            email: u.email,
            name: u.name,
            role: ROLE_INFO[u.role].name,
            org: db.organizations.find((o) => o.id === u.orgId)?.name ?? "",
          })),
      }
    : null;
  return <LoginForm demo={demo} />;
}
