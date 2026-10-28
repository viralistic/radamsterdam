"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { CategoryCode } from "@/lib/categories";
import type { QueueRow } from "@/lib/server/pro";
import type { ReportEvent, ReportStatus } from "@/lib/types";
import { CITY_CENTER } from "@/lib/areas";
import { PageHeader, usePro } from "@/components/pro/shell";
import { BarList, Columns, Kpi } from "@/components/pro/charts";
import { QueueTable } from "@/components/pro/queue-table";
import { MapView } from "@/components/map";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useLiveVersion } from "@/hooks/use-live";
import { api, formatHours, timeAgo } from "@/lib/utils";

interface Summary {
  days: number;
  kpis: { newToday: number; toReview: number; inProgress: number; medianFirstReviewHours: number | null; recurringLocations: number; overdue: number };
  byCategory: { code: string; name: string; count: number }[];
  series: { date: string; count: number }[];
  priority: QueueRow[];
  recent: (ReportEvent & { number?: string })[];
  liveMap: { id: string; lat: number; lng: number; category: CategoryCode; status: ReportStatus }[];
}

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? "Goedenacht" : h < 12 ? "Goedemorgen" : h < 18 ? "Goedemiddag" : "Goedenavond";
}

export default function OverviewPage() {
  const pro = usePro();
  const router = useRouter();
  const version = useLiveVersion();
  const [days, setDays] = React.useState("7");
  const [data, setData] = React.useState<Summary | null>(null);

  React.useEffect(() => {
    if (!pro.can("analytics.read")) {
      router.replace(pro.can("reports.read") ? "/pro/wachtrij" : "/pro/gebruikers");
      return;
    }
    api<Summary>(`/api/pro/analytics/summary?days=${days}`).then(setData);
  }, [days, version, pro, router]);

  const markers = React.useMemo(() => data?.liveMap.map((m) => ({ ...m })) ?? [], [data]);

  if (!pro.can("analytics.read")) return null;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${pro.user.name.split(" ")[0]}`}
        description={`${pro.org.name}. Dit speelt er in de categorieën waarvoor je organisatie bevoegd is.`}
        actions={
          <Select value={days} onChange={(e) => setDays(e.target.value)} className="w-44" aria-label="Periode">
            <option value="7">Afgelopen 7 dagen</option>
            <option value="30">Afgelopen 30 dagen</option>
            <option value="90">Afgelopen 90 dagen</option>
          </Select>
        }
      />
      <div className="grid gap-6 px-4 py-6 lg:px-8">
        {!data ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Nieuw vandaag" value={data.kpis.newToday} definition="Gemeld sinds 00:00 vandaag." />
            <Kpi label="Nog te beoordelen" value={data.kpis.toReview} definition="Actueel en nog door niemand opgepakt." />
            <Kpi label="In behandeling" value={data.kpis.inProgress} definition="Opgepakt en nog niet afgesloten." />
            <Kpi label="Tijd tot beoordeling" value={formatHours(data.kpis.medianFirstReviewHours)} definition={`Mediaan, meldingen uit de afgelopen ${data.days} dagen.`} />
            <Kpi label="Terugkerende plekken" value={data.kpis.recurringLocations} definition="Minstens 3 meldingen op 3 verschillende dagen, laatste 30 dagen." />
            <Kpi label="Buiten reactietermijn" value={data.kpis.overdue} definition="Open taken waarvan de termijn is verstreken." tone={data.kpis.overdue ? "warn" : undefined} />
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          {pro.can("reports.read") && (
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between">
                <div className="grid gap-1.5">
                  <CardTitle>Eerst oppakken</CardTitle>
                  <CardDescription>Hoge prioriteit eerst, daarna de oudste.</CardDescription>
                </div>
                <Link href="/pro/wachtrij" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Naar wachtrij <ArrowRight />
                </Link>
              </CardHeader>
              {data && data.priority.length === 0 ? (
                <CardContent><EmptyState title="Alles is opgepakt">Er staan geen meldingen te wachten.</EmptyState></CardContent>
              ) : (
                <QueueTable rows={data?.priority ?? []} compact />
              )}
            </Card>
          )}
          {pro.can("reports.read") && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Actueel op de kaart</CardTitle>
                <CardDescription>{data ? `${data.liveMap.length} actieve meldingen` : "Laden..."}</CardDescription>
              </CardHeader>
              <div className="relative h-80 border-t">
                <MapView className="absolute inset-0" center={CITY_CENTER} zoom={12} markers={markers} onMarkerClick={(id) => router.push(`/pro/dossier/${id}`)} />
              </div>
            </Card>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Meldingen per dag</CardTitle>
              <CardDescription>Alle binnengekomen meldingen, afgelopen {days} dagen.</CardDescription>
            </CardHeader>
            <CardContent>
              {data ? <Columns data={data.series.map((s) => ({ label: new Date(s.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }), value: s.count }))} /> : <Skeleton className="h-32" />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Meldingen per categorie</CardTitle>
              <CardDescription>Afgelopen {days} dagen.</CardDescription>
            </CardHeader>
            <CardContent>{data ? <BarList items={data.byCategory.slice(0, 7).map((c) => ({ label: c.name, value: c.count }))} /> : <Skeleton className="h-32" />}</CardContent>
          </Card>
          {pro.can("reports.read") && (
            <Card>
              <CardHeader>
                <CardTitle>Recente wijzigingen</CardTitle>
                <CardDescription>Laatste acties op meldingen.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3">
                  {data?.recent.map((e) => (
                    <li key={e.id} className="grid gap-0.5 text-sm">
                      <Link href={`/pro/dossier/${e.reportId}`} className="truncate hover:underline">{e.message}</Link>
                      <span className="text-xs text-muted-foreground">{e.number} · {e.actorLabel} · {timeAgo(e.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
