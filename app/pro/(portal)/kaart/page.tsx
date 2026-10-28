"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, CATEGORY_BY_CODE, GROUPS, GROUP_ORDER, type CategoryGroup } from "@/lib/categories";
import type { QueueRow } from "@/lib/server/pro";
import { CITY_CENTER } from "@/lib/areas";
import { MapView } from "@/components/map";
import { NoAccess, PageHeader, usePro } from "@/components/pro/shell";
import { GROUP_COLOR, StatusBadge } from "@/components/category";
import { Select } from "@/components/ui/input";
import { useLiveVersion } from "@/hooks/use-live";
import { api, timeAgo } from "@/lib/utils";

interface Point { id: string; lat: number; lng: number; category: (typeof CATEGORIES)[number]["code"]; status: QueueRow["status"] }

export default function ProMapPage() {
  const pro = usePro();
  const router = useRouter();
  const version = useLiveVersion();
  const [points, setPoints] = React.useState<Point[]>([]);
  const [rows, setRows] = React.useState<QueueRow[]>([]);
  const [group, setGroup] = React.useState<"" | CategoryGroup>("");
  const [hover, setHover] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pro.can("reports.read")) return;
    api<{ items: QueueRow[] }>("/api/pro/reports?status=open&pageSize=500").then((d) => {
      setRows(d.items);
      setPoints(d.items.filter((r) => r.status !== "under_review").map((r) => ({ id: r.id, lat: r.location.lat, lng: r.location.lng, category: r.category, status: r.status })));
    });
  }, [version, pro]);

  const visible = React.useMemo(() => points.filter((p) => !group || CATEGORY_BY_CODE[p.category].group === group), [points, group]);
  const markers = React.useMemo(() => visible.map((p) => ({ ...p })), [visible]);
  const rowById = React.useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sel = hover ? rowById.get(hover) : null;

  if (!pro.can("reports.read")) return <NoAccess />;

  return (
    <div className="flex h-dvh flex-col lg:h-dvh">
      <PageHeader
        title="Live kaart"
        description={`${visible.length} actieve meldingen binnen je bevoegdheid. Exacte locaties, alleen voor professionals.`}
        actions={
          <Select value={group} onChange={(e) => setGroup(e.target.value as "" | CategoryGroup)} className="w-48" aria-label="Groep">
            <option value="">Alle groepen</option>
            {GROUP_ORDER.map((g) => <option key={g} value={g}>{GROUPS[g].name}</option>)}
          </Select>
        }
      />
      <div className="relative min-h-[400px] flex-1">
        <MapView className="absolute inset-0" center={CITY_CENTER} zoom={13} markers={markers} onMarkerClick={(id) => (hover === id ? router.push(`/pro/dossier/${id}`) : setHover(id))} selectedId={hover} />
        <div className="absolute top-3 left-3 z-[500] flex flex-wrap gap-x-3 gap-y-1 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm">
          {GROUP_ORDER.map((g) => (
            <span key={g} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: GROUP_COLOR[g] }} />{GROUPS[g].name}</span>
          ))}
        </div>
        {sel && (
          <div className="absolute right-3 bottom-3 left-3 z-[500] rounded-xl border bg-background p-4 shadow-lg sm:left-auto sm:w-80">
            <p className="font-medium">{CATEGORY_BY_CODE[sel.category].name}</p>
            <p className="text-sm text-muted-foreground">{sel.street ?? sel.area} · {timeAgo(sel.createdAt)}</p>
            <div className="mt-2 flex items-center justify-between">
              <StatusBadge status={sel.status} />
              <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => router.push(`/pro/dossier/${sel.id}`)}>Open dossier</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
