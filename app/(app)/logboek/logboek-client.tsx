"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Info, Search } from "lucide-react";
import { CATEGORIES, CATEGORY_BY_CODE } from "@/lib/categories";
import { AREAS } from "@/lib/areas";
import { STATUS_LABEL } from "@/lib/status";
import type { PublicReport } from "@/lib/types";
import { CategoryIcon, StatusBadge } from "@/components/category";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api, formatDateTime } from "@/lib/utils";

interface AreaHistory {
  area: string;
  days: number;
  total: number;
  resolved: number;
  categories: { code: string; name: string; count: number }[];
  otherCount: number;
}

export function LogboekClient() {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [area, setArea] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [days, setDays] = React.useState("30");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<{ items: PublicReport[]; total: number; pageSize: number } | null>(null);
  const [history, setHistory] = React.useState<AreaHistory | null>(null);
  const [debouncedQ, setDebouncedQ] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => setPage(1), [debouncedQ, category, area, status, days]);

  React.useEffect(() => {
    const p = new URLSearchParams({ scope: "log", page: String(page), days });
    if (debouncedQ) p.set("q", debouncedQ);
    if (category) p.set("category", category);
    if (area) p.set("area", area);
    if (status) p.set("status", status);
    setData(null);
    api<{ items: PublicReport[]; total: number; pageSize: number }>(`/api/reports?${p}`).then(setData).catch(() => setData({ items: [], total: 0, pageSize: 25 }));
  }, [debouncedQ, category, area, status, days, page]);

  React.useEffect(() => {
    const p = new URLSearchParams({ days });
    if (area) p.set("area", area);
    api<AreaHistory>(`/api/areas/history?${p}`).then(setHistory).catch(() => setHistory(null));
  }, [area, days]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const max = Math.max(1, ...(history?.categories.map((c) => c.count) ?? [1]));

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:py-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Logboek</h1>
        <p className="text-muted-foreground">De kaart laat zien wat er nu speelt. Het logboek laat zien wat hier steeds terugkomt.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek straat of nummer" className="pl-9" aria-label="Zoeken" />
            </div>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categorie">
              <option value="">Alle categorieën</option>
              {CATEGORIES.filter((c) => c.defaultVisibility !== "professional").map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </Select>
            <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Wijk">
              <option value="">Alle wijken</option>
              {AREAS.map((a) => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="">Alle statussen</option>
              {(["new", "confirmed", "in_progress", "resolved", "expired"] as const).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </Select>
            <Select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Periode">
              <option value="7">Afgelopen 7 dagen</option>
              <option value="30">Afgelopen 30 dagen</option>
              <option value="90">Afgelopen 90 dagen</option>
            </Select>
          </div>

          <Card className="overflow-hidden">
            {data === null ? (
              <div className="grid gap-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : data.items.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={<BookOpen />} title="Geen meldingen gevonden">Pas de filters aan of kies een langere periode.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y">
                {data.items.map((r) => (
                  <li key={r.id}>
                    <Link href={`/melding/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                      <CategoryIcon code={r.category} size="sm" />
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <p className="truncate text-sm font-medium">{CATEGORY_BY_CODE[r.category].name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.street ? `${r.street}, ` : ""}{r.area} · {formatDateTime(r.createdAt)} · {r.number}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {data && data.total > 0 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">{data.total} meldingen</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Vorige</Button>
                <span className="text-muted-foreground">{page} / {pages}</span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Volgende</Button>
              </div>
            </div>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Historie {history?.area ?? ""}</CardTitle>
            <CardDescription>Afgelopen {days} dagen, zonder dubbele meldingen.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {history ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-2xl font-semibold">{history.total}</p>
                    <p className="text-xs text-muted-foreground">meldingen</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-2xl font-semibold">{history.total ? Math.round((history.resolved / history.total) * 100) : 0}%</p>
                    <p className="text-xs text-muted-foreground">opgelost</p>
                  </div>
                </div>
                <ul className="grid gap-2.5">
                  {history.categories.map((c) => (
                    <li key={c.code} className="grid gap-1 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{c.name}</span>
                        <span className="font-medium tabular-nums">{c.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-foreground/80" style={{ width: `${(c.count / max) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                  {history.otherCount > 0 && (
                    <li className="flex justify-between text-sm text-muted-foreground">
                      <span>Overige categorieën</span>
                      <span className="tabular-nums">{history.otherCount}</span>
                    </li>
                  )}
                </ul>
                <p className="flex gap-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Veel meldingen betekent niet automatisch dat een plek onveilig is. Het kan ook betekenen dat buren hier actief meekijken.
                </p>
              </>
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
