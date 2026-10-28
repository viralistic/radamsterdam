"use client";

import * as React from "react";
import { Info, Repeat, TrendingDown, TrendingUp } from "lucide-react";
import { CATEGORIES, CATEGORY_BY_CODE, type CategoryCode } from "@/lib/categories";
import { CITY_CENTER } from "@/lib/areas";
import { MapView, type MapViewHandle } from "@/components/map";
import { NoAccess, PageHeader, usePro } from "@/components/pro/shell";
import { HeatMatrix } from "@/components/pro/charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Alert, EmptyState, Skeleton } from "@/components/ui/misc";
import { api, cn } from "@/lib/utils";

interface Cell {
  id: string;
  lat: number;
  lng: number;
  count: number;
  previous: number;
  distinctDays: number;
  recurring: boolean;
  resolvedPct: number;
  topCategory: CategoryCode;
  area: string | null;
  place: string | null;
}
interface Data { cells: Cell[]; suppressedCells: number; total: number; matrix: (number | null)[][] }

const WINDOWS = [
  { v: "", label: "Hele dag" },
  { v: "6-12", label: "Ochtend 06 tot 12" },
  { v: "12-18", label: "Middag 12 tot 18" },
  { v: "18-22", label: "Avond 18 tot 22" },
  { v: "22-6", label: "Nacht 22 tot 06" },
];

export default function HotspotsPage() {
  const pro = usePro();
  const mapRef = React.useRef<MapViewHandle>(null);
  const [days, setDays] = React.useState("30");
  const [category, setCategory] = React.useState("");
  const [weekday, setWeekday] = React.useState("");
  const [window_, setWindow] = React.useState("");
  const [data, setData] = React.useState<Data | null>(null);
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pro.can("analytics.read")) return;
    const p = new URLSearchParams({ days });
    if (category) p.set("category", category);
    if (weekday) p.set("weekday", weekday);
    if (window_) {
      const [f, t] = window_.split("-");
      p.set("hourFrom", f);
      p.set("hourTo", t);
    }
    setData(null);
    api<Data>(`/api/pro/analytics/hotspots?${p}`).then(setData);
  }, [days, category, weekday, window_, pro]);

  const max = Math.max(1, ...(data?.cells.map((c) => c.count) ?? [1]));
  const circles = React.useMemo(
    () => (data?.cells ?? []).map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, radius: 90 + (c.count / max) * 160, intensity: c.count / max, label: `${c.place ?? c.area}: ${c.count} meldingen` })),
    [data, max],
  );

  if (!pro.can("analytics.read")) return <NoAccess />;

  return (
    <>
      <PageHeader title="Hotspots" description="Waar keren problemen terug, en wanneer? Geaggregeerd per vak van circa 250 meter." />
      <div className="grid gap-6 px-4 py-6 lg:px-8">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Periode">
            <option value="7">Afgelopen 7 dagen</option>
            <option value="30">Afgelopen 30 dagen</option>
            <option value="90">Afgelopen 90 dagen</option>
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categorie">
            <option value="">Alle categorieën</option>
            {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
          <Select value={weekday} onChange={(e) => setWeekday(e.target.value)} aria-label="Weekdag">
            <option value="">Alle dagen</option>
            {["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"].map((d, i) => <option key={d} value={i}>{d}</option>)}
          </Select>
          <Select value={window_} onChange={(e) => setWindow(e.target.value)} aria-label="Tijdvak">
            {WINDOWS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
          </Select>
        </div>

        <Alert variant="info" icon={<Info />} title="Meldingsvolume is geen criminaliteitscijfer">
          Meer meldingen kan ook betekenen dat bewoners hier actiever melden of dat er al meer toezicht is. Gebruik dit als aanvulling op andere bronnen. Een mens beslist altijd over inzet.
        </Alert>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Card className="overflow-hidden">
            <div className="relative h-[420px]">
              <MapView ref={mapRef} className="absolute inset-0" center={CITY_CENTER} zoom={12} circles={circles} onCircleClick={setActive} />
            </div>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Plekken met de meeste meldingen</CardTitle>
              <CardDescription>
                {data ? `${data.total} meldingen in de selectie. ${data.suppressedCells} vakken met minder dan 3 meldingen niet getoond.` : "Laden..."}
              </CardDescription>
            </CardHeader>
            <div className="max-h-[340px] overflow-y-auto border-t">
              {!data ? (
                <div className="grid gap-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : data.cells.length === 0 ? (
                <div className="p-4"><EmptyState title="Geen hotspots in deze selectie">Kies een langere periode of een andere categorie.</EmptyState></div>
              ) : (
                <ul className="divide-y">
                  {data.cells.slice(0, 20).map((c) => {
                    const trend = c.previous ? Math.round(((c.count - c.previous) / c.previous) * 100) : null;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => { setActive(c.id); mapRef.current?.flyTo({ lat: c.lat, lng: c.lng }, 16); }}
                          className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50", active === c.id && "bg-muted")}
                        >
                          <span className="w-8 text-lg font-semibold tabular-nums">{c.count}</span>
                          <span className="grid min-w-0 flex-1 gap-0.5">
                            <span className="truncate text-sm font-medium">{c.place ?? c.area}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {c.area} · vooral {CATEGORY_BY_CODE[c.topCategory].short.toLowerCase()} · {c.resolvedPct}% opgelost
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-1">
                            {c.recurring && <Badge variant="warning"><Repeat /> {c.distinctDays} dagen</Badge>}
                            {trend !== null && trend !== 0 && (
                              <span className={cn("inline-flex items-center gap-0.5 text-xs", trend > 0 ? "text-red-700" : "text-emerald-700")}>
                                {trend > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                                {trend > 0 ? "+" : ""}{trend}%
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Wanneer wordt er gemeld?</CardTitle>
            <CardDescription>Meldingen per weekdag en uur in de selectie. Donkerder is meer.</CardDescription>
          </CardHeader>
          <CardContent>{data ? <HeatMatrix matrix={data.matrix} /> : <Skeleton className="h-40" />}</CardContent>
        </Card>
      </div>
    </>
  );
}
