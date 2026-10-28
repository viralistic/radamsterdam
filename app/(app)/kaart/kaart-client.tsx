"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, List, LocateFixed, Plus, SlidersHorizontal } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CATEGORY_BY_CODE, GROUPS, GROUP_ORDER, type CategoryGroup } from "@/lib/categories";
import type { LatLng, PublicReport } from "@/lib/types";
import { CITY_CENTER } from "@/lib/areas";
import { MapView, type MapViewHandle } from "@/components/map";
import { CategoryIcon, GROUP_COLOR, StatusBadge } from "@/components/category";
import { ReportDetail } from "@/components/citizen/report-detail";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { EmptyState, Skeleton, Switch } from "@/components/ui/misc";
import { useGeolocation, useLiveVersion } from "@/hooks/use-live";
import { api, cn, timeAgo } from "@/lib/utils";

type Filter = "all" | CategoryGroup;

export function KaartClient() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedParam = params.get("melding");
  const mapRef = React.useRef<MapViewHandle>(null);
  const version = useLiveVersion();
  const geo = useGeolocation();

  const [reports, setReports] = React.useState<PublicReport[] | null>(null);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [onlyConfirmed, setOnlyConfirmed] = React.useState(false);
  const [onlyRecent, setOnlyRecent] = React.useState(false);
  const [bounds, setBounds] = React.useState<[number, number, number, number] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(selectedParam);
  const [listOpen, setListOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);
  const flown = React.useRef(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const set = () => setIsDesktop(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  React.useEffect(() => {
    const q = new URLSearchParams({ scope: "live" });
    if (filter !== "all") q.set("group", filter);
    if (onlyConfirmed) q.set("confirmed", "1");
    if (onlyRecent) q.set("recent", "2");
    api<{ items: PublicReport[] }>(`/api/reports?${q}`)
      .then((d) => setReports(d.items))
      .catch(() => setReports([]));
  }, [filter, onlyConfirmed, onlyRecent, version]);

  const selected = reports?.find((r) => r.id === selectedId) ?? null;

  // Diepe link: vlieg naar de melding.
  React.useEffect(() => {
    if (selected && !flown.current && selectedParam) {
      flown.current = true;
      setTimeout(() => mapRef.current?.flyTo(selected.location, 16), 400);
    }
  }, [selected, selectedParam]);

  const inView = React.useMemo(() => {
    if (!reports) return null;
    if (!bounds) return reports;
    const [w, s, e, n] = bounds;
    return reports.filter((r) => r.location.lng >= w && r.location.lng <= e && r.location.lat >= s && r.location.lat <= n);
  }, [reports, bounds]);

  const markers = React.useMemo(
    () => (reports ?? []).map((r) => ({ id: r.id, lat: r.location.lat, lng: r.location.lng, category: r.category, status: r.status, approximate: r.approximate })),
    [reports],
  );

  function select(id: string | null) {
    setSelectedId(id);
    const url = id ? `/kaart?melding=${id}` : "/kaart";
    router.replace(url, { scroll: false });
    if (id) {
      const r = reports?.find((x) => x.id === id);
      if (r) mapRef.current?.flyTo(r.location);
      setListOpen(false);
    }
  }

  async function locate() {
    const p = await geo.locate();
    if (p) mapRef.current?.flyTo(p, 16);
  }

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of inView ?? []) c[CATEGORY_BY_CODE[r.category].group] = (c[CATEGORY_BY_CODE[r.category].group] ?? 0) + 1;
    return c;
  }, [inView]);

  const filterChips = (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
      {(["all", ...GROUP_ORDER] as Filter[]).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => setFilter(f)}
          aria-pressed={filter === f}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-background px-3 text-sm font-medium shadow-xs transition-colors",
            filter === f ? "border-foreground bg-foreground text-background" : "hover:bg-accent",
          )}
        >
          {f !== "all" && <span className="size-2 rounded-full" style={{ background: GROUP_COLOR[f] }} />}
          {f === "all" ? "Alles" : GROUPS[f].name}
        </button>
      ))}
    </div>
  );

  const extraFilters = (
    <div className="grid gap-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        Alleen bevestigd door buren
        <Switch checked={onlyConfirmed} onCheckedChange={setOnlyConfirmed} label="Alleen bevestigd" />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        Alleen gemeld in de laatste 2 uur
        <Switch checked={onlyRecent} onCheckedChange={setOnlyRecent} label="Alleen recent" />
      </label>
    </div>
  );

  const list = (
    <div className="grid gap-1">
      {inView === null ? (
        Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)
      ) : inView.length === 0 ? (
        <EmptyState title="Geen signalen in dit gebied" action={<Link href="/melden" className={buttonVariants({ size: "sm" })}><Plus /> Melding maken</Link>}>
          Rustig hier. Zie je toch iets? Meld het dan als eerste.
        </EmptyState>
      ) : (
        inView.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => select(r.id)}
            className={cn("flex w-full gap-3 rounded-lg p-3 text-left hover:bg-muted/60", r.id === selectedId && "bg-muted")}
          >
            <CategoryIcon code={r.category} />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{CATEGORY_BY_CODE[r.category].name}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="truncate text-sm text-muted-foreground">{r.street ?? r.area}</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={r.status} />
                {r.confirmations > 0 && <span className="text-xs text-muted-foreground">{r.confirmations}x bevestigd</span>}
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );

  const legend = (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {GROUP_ORDER.map((g) => (
        <span key={g} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: GROUP_COLOR[g] }} />
          {GROUPS[g].name} {counts[g] ? `(${counts[g]})` : ""}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-full border border-dashed border-muted-foreground" />
        Globale locatie
      </span>
    </div>
  );

  return (
    <div className="absolute inset-0 flex">
      {/* Desktop zijpaneel */}
      <aside className="hidden w-[400px] shrink-0 flex-col border-r bg-background md:flex">
        {selected && isDesktop ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Button variant="ghost" size="sm" onClick={() => select(null)}>
                <ArrowLeft /> Terug naar lijst
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <ReportDetail report={selected} onChange={(r) => setReports((all) => all?.map((x) => (x.id === r.id ? r : x)) ?? null)} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 border-b p-4">
              <div>
                <h1 className="text-lg font-semibold">Wat speelt er in de buurt?</h1>
                <p className="text-sm text-muted-foreground">
                  {inView ? `${inView.length} actuele signalen in beeld.` : "Signalen laden..."} Tik op een signaal om te bevestigen.
                </p>
              </div>
              {filterChips}
              {extraFilters}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">{list}</div>
            <div className="border-t p-4">{legend}</div>
          </>
        )}
      </aside>

      {/* Kaart */}
      <div className="relative min-w-0 flex-1">
        <MapView
          ref={mapRef}
          className="absolute inset-0"
          center={CITY_CENTER}
          zoom={13}
          markers={markers}
          selectedId={selectedId}
          onMarkerClick={select}
          onMove={(_c: LatLng, b) => setBounds(b)}
          userLocation={geo.position}
        />

        {/* Mobiele bediening */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] grid gap-2 p-3 md:hidden">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="min-w-0 flex-1">{filterChips}</div>
            <Button variant="outline" size="icon" className="shrink-0 rounded-full bg-background" onClick={() => setFiltersOpen(true)} aria-label="Meer filters">
              <SlidersHorizontal />
            </Button>
          </div>
        </div>

        <div className="absolute right-3 bottom-28 z-[500] md:right-[10px] md:bottom-24">
          <Button variant="outline" size="icon" className="rounded-full bg-background shadow-md" onClick={locate} disabled={geo.loading} aria-label="Ga naar mijn locatie">
            <LocateFixed />
          </Button>
        </div>
        {geo.error && (
          <div className="absolute inset-x-3 top-16 z-[500] rounded-lg border bg-background px-3 py-2 text-sm shadow md:top-3 md:left-auto md:w-80">{geo.error}</div>
        )}

        <div className="absolute inset-x-3 bottom-3 z-[500] md:hidden">
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border bg-background px-4 py-3 text-left shadow-lg"
          >
            <span>
              <span className="block text-sm font-medium">{inView ? `${inView.length} signalen in beeld` : "Signalen laden..."}</span>
              <span className="block text-xs text-muted-foreground">Bekijk de lijst en bevestig wat je ziet</span>
            </span>
            <List className="size-5" />
          </button>
        </div>
      </div>

      {/* Mobiele panelen */}
      <Dialog open={!isDesktop && listOpen} onOpenChange={setListOpen}>
        <SheetContent>
          <div className="px-4 pt-3 pb-2">
            <DialogPrimitive.Title className="font-semibold">Signalen in beeld</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Tik op een signaal voor details.</DialogPrimitive.Description>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">{list}</div>
        </SheetContent>
      </Dialog>

      <Dialog open={!isDesktop && filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent>
          <div className="grid gap-5 px-5 pt-3 pb-8">
            <DialogPrimitive.Title className="font-semibold">Filters</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Kies welke signalen je ziet</DialogPrimitive.Description>
            {extraFilters}
            {legend}
            <Button onClick={() => setFiltersOpen(false)}>Toon resultaten</Button>
          </div>
        </SheetContent>
      </Dialog>

      <Dialog open={!isDesktop && !!selected} onOpenChange={(o) => !o && select(null)}>
        <SheetContent>
          <DialogPrimitive.Title className="sr-only">Details van de melding</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Bevestig of corrigeer deze melding</DialogPrimitive.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-8">
            {selected && <ReportDetail report={selected} compact onChange={(r) => setReports((all) => all?.map((x) => (x.id === r.id ? r : x)) ?? null)} />}
          </div>
        </SheetContent>
      </Dialog>
    </div>
  );
}
