"use client";

import * as React from "react";
import { CheckCheck, Inbox, Search } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { AREAS } from "@/lib/areas";
import { STATUS_LABEL, RESOLUTION_LABEL } from "@/lib/status";
import type { QueueRow } from "@/lib/server/pro";
import { NoAccess, PageHeader, usePro } from "@/components/pro/shell";
import { QueueTable } from "@/components/pro/queue-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, Skeleton, Tabs } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useLiveVersion } from "@/hooks/use-live";
import { api } from "@/lib/utils";

type Assigned = "all" | "none" | "me" | "overdue";

export default function WachtrijPage() {
  const pro = usePro();
  const toast = useToast();
  const version = useLiveVersion();
  const [status, setStatus] = React.useState("open");
  const [category, setCategory] = React.useState("");
  const [area, setArea] = React.useState("");
  const [assigned, setAssigned] = React.useState<Assigned>("all");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<{ items: QueueRow[]; total: number; pageSize: number } | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkCode, setBulkCode] = React.useState("REPAIRED");
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => setPage(1), [status, category, area, assigned, q]);

  React.useEffect(() => {
    const p = new URLSearchParams({ status, page: String(page) });
    if (category) p.set("category", category);
    if (area) p.set("area", area);
    if (assigned !== "all") p.set("assigned", assigned);
    if (q) p.set("q", q);
    const t = setTimeout(() => api<{ items: QueueRow[]; total: number; pageSize: number }>(`/api/pro/reports?${p}`).then(setData), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [status, category, area, assigned, q, page, version, tick]);

  if (!pro.can("reports.read")) return <NoAccess text="Je rol ziet alleen geaggregeerde gegevens. Gebruik Rapportages of Hotspots." />;

  const rows = data?.items ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function bulk(action: "accept" | "close") {
    try {
      const res = await api<{ done: number; skipped: number }>("/api/pro/reports", {
        method: "PATCH",
        json: { ids: [...selected], action, resolutionCode: action === "close" ? bulkCode : undefined },
      });
      toast({ title: `${res.done} meldingen bijgewerkt`, description: res.skipped ? `${res.skipped} overgeslagen: gevoelig of al afgerond.` : undefined });
      setSelected(new Set());
      setTick((t) => t + 1);
    } catch (e) {
      toast({ title: "Bulkactie mislukt", description: (e as Error).message, variant: "error" });
    }
  }

  return (
    <>
      <PageHeader
        title={pro.user.role === "MODERATOR" ? "Moderatie" : "Meldingenwachtrij"}
        description={
          pro.user.role === "MODERATOR"
            ? "Meldingen met misbruikrapportages of foto's die op beoordeling wachten."
            : "Beoordeel, wijs toe en sluit af. Je ziet alleen meldingen binnen de bevoegdheid van je organisatie."
        }
      />
      <div className="grid gap-4 px-4 py-6 lg:px-8">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            value={assigned}
            onValueChange={setAssigned}
            items={[
              { value: "all", label: "Alles" },
              { value: "none", label: "Niet toegewezen" },
              { value: "me", label: "Aan mij" },
              { value: "overdue", label: "Te laat" },
            ]}
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nummer of straat" className="pl-9" aria-label="Zoeken" />
            </div>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="open">Open</option>
              <option value="all">Alle statussen</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categorie">
              <option value="">Alle categorieën</option>
              {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
            <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Wijk">
              <option value="">Alle wijken</option>
              {AREAS.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            </Select>
          </div>
        </div>

        {pro.can("reports.bulk") && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium">{selected.size} geselecteerd</span>
            <Button size="sm" onClick={() => bulk("accept")}><CheckCheck /> Oppakken</Button>
            <span className="text-muted-foreground">of afsluiten als</span>
            <Select value={bulkCode} onChange={(e) => setBulkCode(e.target.value)} className="h-8 w-auto">
              {(["REPAIRED", "CLEANED", "NOT_CONFIRMED", "OUT_OF_SCOPE"] as const).map((c) => <option key={c} value={c}>{RESOLUTION_LABEL[c]}</option>)}
            </Select>
            <Button size="sm" variant="outline" onClick={() => bulk("close")}>Afsluiten</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Wissen</Button>
          </div>
        )}

        <Card className="overflow-hidden">
          {data === null ? (
            <div className="grid gap-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rows.length === 0 ? (
            <div className="p-4"><EmptyState icon={<Inbox />} title="Geen meldingen in deze weergave">Pas de filters aan of kijk later terug.</EmptyState></div>
          ) : (
            <QueueTable
              rows={rows}
              selectable={pro.can("reports.bulk")}
              selected={selected}
              onToggle={(id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
              onToggleAll={() => setSelected((s) => {
                const eligible = rows.filter((r) => !r.sensitive).map((r) => r.id);
                return eligible.every((id) => s.has(id)) ? new Set() : new Set(eligible);
              })}
            />
          )}
        </Card>
        {data && data.total > 0 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">{data.total} meldingen. Gevoelige meldingen (slot) worden altijd los beoordeeld.</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Vorige</Button>
              <span className="text-muted-foreground">{page} / {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Volgende</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
