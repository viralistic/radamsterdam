"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { ROLE_INFO, ROLES } from "@/lib/roles";
import type { Organization, ProUser, Role } from "@/lib/types";
import { NoAccess, PageHeader, usePro } from "@/components/pro/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Skeleton, Switch } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, timeAgo } from "@/lib/utils";

type Row = ProUser & { orgName?: string };

export default function GebruikersPage() {
  const pro = usePro();
  const toast = useToast();
  const [data, setData] = React.useState<{ users: Row[]; organizations: Organization[] } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", role: "MUNICIPAL_OPERATOR" as Role, orgId: "" });
  const isPlatform = pro.user.role === "PLATFORM_ADMIN";
  const roles = ROLES.filter((r) => isPlatform || r !== "PLATFORM_ADMIN");

  const load = React.useCallback(() => api<{ users: Row[]; organizations: Organization[] }>("/api/pro/users").then(setData), []);
  React.useEffect(() => {
    if (pro.can("users.manage")) load();
  }, [pro, load]);

  async function update(id: string, patch: Partial<Pick<ProUser, "role" | "active">>) {
    try {
      await api("/api/pro/users", { method: "PATCH", json: { id, ...patch } });
      toast({ title: patch.active === false ? "Toegang ingetrokken" : "Gebruiker bijgewerkt" });
      load();
    } catch (e) {
      toast({ title: "Dat lukte niet", description: (e as Error).message, variant: "error" });
    }
  }

  async function invite() {
    try {
      await api("/api/pro/users", { method: "POST", json: { ...form, orgId: form.orgId || undefined } });
      toast({ title: "Uitnodiging verstuurd", description: `${form.email} kan inloggen met MFA.` });
      setOpen(false);
      setForm({ name: "", email: "", role: "MUNICIPAL_OPERATOR", orgId: "" });
      load();
    } catch (e) {
      toast({ title: "Dat lukte niet", description: (e as Error).message, variant: "error" });
    }
  }

  if (!pro.can("users.manage")) return <NoAccess />;

  return (
    <>
      <PageHeader
        title="Gebruikers en rollen"
        description="Iedere rol krijgt alleen de toegang die nodig is voor de taak. Wijzigingen worden gelogd."
        actions={<Button onClick={() => setOpen(true)}><UserPlus /> Gebruiker uitnodigen</Button>}
      />
      <div className="grid gap-6 px-4 py-6 lg:px-8 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          {!data ? (
            <div className="grid gap-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Naam</th>
                    <th className="px-4 py-2 font-medium">Rol</th>
                    <th className="px-4 py-2 font-medium">Laatst ingelogd</th>
                    <th className="px-4 py-2 font-medium">Toegang</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.users.map((u) => {
                    const self = u.email === pro.user.email;
                    return (
                      <tr key={u.id}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{u.name} {self && <Badge variant="muted">Jij</Badge>}</p>
                          <p className="text-xs text-muted-foreground">{u.email}{isPlatform && ` · ${u.orgName}`}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <Select value={u.role} disabled={self} onChange={(e) => update(u.id, { role: e.target.value as Role })} className="h-8 w-48" aria-label={`Rol van ${u.name}`}>
                            {(roles.includes(u.role) ? roles : [...roles, u.role]).map((r) => <option key={r} value={r}>{ROLE_INFO[r].name}</option>)}
                          </Select>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Nooit"}</td>
                        <td className="px-4 py-2.5">
                          <Switch checked={u.active} disabled={self} onCheckedChange={(v) => update(u.id, { active: v })} label={`Toegang voor ${u.name}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Rollen</CardTitle>
            <CardDescription>Platformbeheer heeft geen automatische toegang tot dossiers.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {ROLES.map((r) => (
              <div key={r} className="grid gap-0.5 text-sm">
                <p className="font-medium">{ROLE_INFO[r].name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_INFO[r].description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gebruiker uitnodigen</DialogTitle>
            <DialogDescription>De medewerker logt in met wachtwoord en MFA. Kies de kleinste rol die nodig is.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="n">Naam</Label>
              <Input id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e">E-mailadres</Label>
              <Input id="e" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r">Rol</Label>
              <Select id="r" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {roles.map((r) => <option key={r} value={r}>{ROLE_INFO[r].name}</option>)}
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_INFO[form.role].description}</p>
            </div>
            {isPlatform && data && (
              <div className="grid gap-2">
                <Label htmlFor="o">Organisatie</Label>
                <Select id="o" value={form.orgId} onChange={(e) => setForm({ ...form, orgId: e.target.value })}>
                  <option value="">Kies een organisatie</option>
                  {data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={invite} disabled={!form.name || !form.email || (isPlatform && !form.orgId)}>Uitnodigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
