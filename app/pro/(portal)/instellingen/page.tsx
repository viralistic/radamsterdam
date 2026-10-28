"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { VISIBILITY_LABEL, type CategoryCode, type CategoryGroup, type Visibility } from "@/lib/categories";
import type { Organization } from "@/lib/types";
import { NoAccess, PageHeader, usePro } from "@/components/pro/shell";
import { CategoryIcon } from "@/components/category";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Skeleton, Switch } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/utils";

interface CatRow { code: CategoryCode; name: string; group: CategoryGroup; ttlHours: number | null; visibility: Visibility; active: boolean; orgId: string; editable: boolean }
interface Data { org: Organization; retention: Record<string, number>; categories: CatRow[]; organizations: { id: string; name: string }[] }

export default function InstellingenPage() {
  const pro = usePro();
  const toast = useToast();
  const [data, setData] = React.useState<Data | null>(null);
  const [rows, setRows] = React.useState<CatRow[]>([]);
  const [response, setResponse] = React.useState("");

  const load = React.useCallback(() => api<Data>("/api/pro/settings").then((d) => { setData(d); setRows(d.categories); setResponse(String(d.org.responseHours)); }), []);
  React.useEffect(() => { if (pro.can("settings.manage")) load(); }, [pro, load]);

  async function saveCategory(r: CatRow) {
    try {
      await api("/api/pro/settings", { method: "PUT", json: { type: "category", code: r.code, ttlHours: r.ttlHours, visibility: r.visibility, active: r.active, orgId: r.orgId } });
      toast({ title: `${r.name} opgeslagen` });
      load();
    } catch (e) {
      toast({ title: "Opslaan lukte niet", description: (e as Error).message, variant: "error" });
    }
  }

  async function saveOrg() {
    try {
      await api("/api/pro/settings", { method: "PUT", json: { type: "org", responseHours: Number(response) } });
      toast({ title: "Reactietermijn opgeslagen" });
    } catch (e) {
      toast({ title: "Opslaan lukte niet", description: (e as Error).message, variant: "error" });
    }
  }

  if (!pro.can("settings.manage")) return <NoAccess />;
  const set = (code: CategoryCode, patch: Partial<CatRow>) => setRows((all) => all.map((r) => (r.code === code ? { ...r, ...patch } : r)));
  const dirty = (r: CatRow) => JSON.stringify(r) !== JSON.stringify(data?.categories.find((x) => x.code === r.code));

  return (
    <>
      <PageHeader title="Instellingen" description="Routering, zichtbaarheid en geldigheid per categorie. Elke wijziging komt in het auditlog." />
      <div className="grid gap-6 px-4 py-6 lg:px-8">
        {!data ? <Skeleton className="h-64" /> : (
          <>
            {pro.org.type !== "platform" && (
              <Card>
                <CardHeader>
                  <CardTitle>{data.org.name}</CardTitle>
                  <CardDescription>Standaard reactietermijn voor nieuwe taken van je organisatie.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-end gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="resp">Reactietermijn in uren</Label>
                    <Input id="resp" type="number" min={1} value={response} onChange={(e) => setResponse(e.target.value)} className="w-40" />
                  </div>
                  <Button variant="outline" onClick={saveOrg}><Save /> Opslaan</Button>
                </CardContent>
              </Card>
            )}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Categorieën</CardTitle>
                <CardDescription>Leeg bij geldigheid betekent: actueel tot opgelost, met een maximum van 30 dagen zonder bevestiging.</CardDescription>
              </CardHeader>
              <div className="overflow-x-auto border-t">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Categorie</th>
                      <th className="px-4 py-2 font-medium">Geldig (uur)</th>
                      <th className="px-4 py-2 font-medium">Zichtbaarheid</th>
                      <th className="px-4 py-2 font-medium">Verantwoordelijke</th>
                      <th className="px-4 py-2 font-medium">Actief</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => (
                      <tr key={r.code} className={r.editable ? "" : "opacity-50"}>
                        <td className="px-4 py-2"><span className="flex items-center gap-2"><CategoryIcon code={r.code} size="sm" />{r.name}</span></td>
                        <td className="px-4 py-2">
                          <Input type="number" min={1} disabled={!r.editable} value={r.ttlHours ?? ""} placeholder="Tot opgelost" onChange={(e) => set(r.code, { ttlHours: e.target.value ? Number(e.target.value) : null })} className="h-8 w-28" />
                        </td>
                        <td className="px-4 py-2">
                          <Select disabled={!r.editable} value={r.visibility} onChange={(e) => set(r.code, { visibility: e.target.value as Visibility })} className="h-8 w-52">
                            {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => <option key={v} value={v}>{VISIBILITY_LABEL[v].title}</option>)}
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <Select disabled={!r.editable} value={r.orgId} onChange={(e) => set(r.code, { orgId: e.target.value })} className="h-8 w-52">
                            {data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </Select>
                        </td>
                        <td className="px-4 py-2"><Switch disabled={!r.editable} checked={r.active} onCheckedChange={(v) => set(r.code, { active: v })} label={`${r.name} actief`} /></td>
                        <td className="px-4 py-2 text-right">
                          {r.editable && <Button size="sm" variant={dirty(r) ? "default" : "ghost"} disabled={!dirty(r)} onClick={() => saveCategory(r)}>Opslaan</Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Bewaartermijnen</CardTitle>
                <CardDescription>Vastgelegd in de server. Aanpassen na de DPIA met de verwerkingsverantwoordelijke.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Foto's", data.retention.mediaDays],
                  ["Details meldingen", data.retention.reportDetailDays],
                  ["Gevoelige meldingen", data.retention.sensitiveDetailDays],
                  ["Identiteit bevestigingen", data.retention.confirmationIdentityDays],
                  ["Auditlog", data.retention.auditDays],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border p-3">
                    <p className="text-muted-foreground">{k}</p>
                    <p className="font-medium">{v} dagen</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
