"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { NoAccess, PageHeader, usePro } from "@/components/pro/shell";
import { Kpi } from "@/components/pro/charts";
import { CategoryIcon } from "@/components/category";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import type { CategoryCode } from "@/lib/categories";
import { api, formatHours } from "@/lib/utils";

interface Stats { total: number; resolved: number; resolvedPct: number; expired: number; medianResolutionHours: number | null; medianFirstReviewHours: number | null }
interface Data {
  days: number;
  overall: Stats & { forwarded: number; duplicates: number };
  byCategory: (Stats & { code: CategoryCode; name: string })[];
  byArea: (Stats & { area: string })[];
}

function StatsTable<T extends Stats>({ rows, first }: { rows: T[]; first: (r: T) => React.ReactNode }) {
  return (
    <div className="overflow-x-auto border-t">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="px-4 py-2 font-medium" />
            <th className="px-4 py-2 text-right font-medium">Meldingen</th>
            <th className="px-4 py-2 text-right font-medium">Opgelost</th>
            <th className="px-4 py-2 text-right font-medium">Verlopen</th>
            <th className="px-4 py-2 text-right font-medium">Tot beoordeling</th>
            <th className="px-4 py-2 text-right font-medium">Tot oplossing</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/40">
              <td className="px-4 py-2.5">{first(r)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.total}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.resolvedPct}%</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.expired}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatHours(r.medianFirstReviewHours)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatHours(r.medianResolutionHours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RapportagesPage() {
  const pro = usePro();
  const [days, setDays] = React.useState("30");
  const [data, setData] = React.useState<Data | null>(null);

  React.useEffect(() => {
    if (!pro.can("analytics.read")) return;
    setData(null);
    api<Data>(`/api/pro/analytics/report?days=${days}`).then(setData);
  }, [days, pro]);

  if (!pro.can("analytics.read")) return <NoAccess />;

  return (
    <>
      <PageHeader
        title="Rapportages"
        description="Vaste definities: tijden zijn medianen vanaf het moment van melden. Dubbele meldingen tellen niet mee."
        actions={
          <>
            <Select value={days} onChange={(e) => setDays(e.target.value)} className="w-44" aria-label="Periode">
              <option value="7">Afgelopen 7 dagen</option>
              <option value="30">Afgelopen 30 dagen</option>
              <option value="90">Afgelopen 90 dagen</option>
            </Select>
            {pro.can("reports.export") && (
              <a href={`/api/pro/export?days=${days}`} className={buttonVariants({ variant: "outline" })}>
                <Download /> Exporteer CSV
              </a>
            )}
          </>
        }
      />
      <div className="grid gap-6 px-4 py-6 lg:px-8">
        {!data ? (
          <Skeleton className="h-28" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Meldingen" value={data.overall.total} definition={`Unieke meldingen, ${data.days} dagen.`} />
            <Kpi label="Opgelost" value={`${data.overall.resolvedPct}%`} definition="Afgesloten door een dienst of door buren." />
            <Kpi label="Verlopen" value={data.overall.expired} definition="Te lang niet bevestigd." />
            <Kpi label="Tot beoordeling" value={formatHours(data.overall.medianFirstReviewHours)} definition="Mediaan tot eerste actie van een dienst." />
            <Kpi label="Tot oplossing" value={formatHours(data.overall.medianResolutionHours)} definition="Mediaan van opgeloste meldingen." />
            <Kpi label="Doorgezet" value={data.overall.forwarded} definition="Naar een andere organisatie dan standaard." />
          </div>
        )}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Per categorie</CardTitle>
            <CardDescription>Gesorteerd op aantal meldingen.</CardDescription>
          </CardHeader>
          {data ? <StatsTable rows={data.byCategory} first={(r) => <span className="flex items-center gap-2"><CategoryIcon code={r.code} size="sm" />{r.name}</span>} /> : <Skeleton className="m-4 h-40" />}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Per wijk</CardTitle>
            <CardDescription>Wijken met minder dan 3 meldingen worden niet getoond.</CardDescription>
          </CardHeader>
          {data ? <StatsTable rows={data.byArea} first={(r) => r.area} /> : <Skeleton className="m-4 h-40" />}
        </Card>
        {pro.can("reports.export") && (
          <p className="text-xs text-muted-foreground">De export bevat geen omschrijvingen, melders of exacte locaties. Elke export wordt vastgelegd in het auditlog.</p>
        )}
      </div>
    </>
  );
}
