"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { CATEGORY_BY_CODE } from "@/lib/categories";
import type { PublicReport, ReportStatus } from "@/lib/types";
import { CategoryIcon, StatusBadge } from "@/components/category";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, Skeleton, Tabs } from "@/components/ui/misc";
import { useLiveVersion } from "@/hooks/use-live";
import { api, timeAgo } from "@/lib/utils";

type Tab = "open" | "in_progress" | "done" | "expired";
const TAB_STATUSES: Record<Tab, ReportStatus[]> = {
  open: ["new", "confirmed", "under_review"],
  in_progress: ["in_progress"],
  done: ["resolved", "withdrawn"],
  expired: ["expired"],
};

export default function MijnMeldingenPage() {
  const version = useLiveVersion();
  const [reports, setReports] = React.useState<PublicReport[] | null>(null);
  const [tab, setTab] = React.useState<Tab>("open");

  React.useEffect(() => {
    api<{ reports: PublicReport[] }>("/api/me").then((d) => setReports(d.reports)).catch(() => setReports([]));
  }, [version]);

  const count = (t: Tab) => reports?.filter((r) => TAB_STATUSES[t].includes(r.status)).length ?? 0;
  const list = reports?.filter((r) => TAB_STATUSES[tab].includes(r.status)) ?? null;

  return (
    <div className="mx-auto grid max-w-2xl gap-5 px-4 py-6 md:py-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mijn meldingen</h1>
        <p className="text-muted-foreground">Zie wat er met jouw meldingen gebeurt. Op dit apparaat, zonder account.</p>
      </div>
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="w-full"
        items={[
          { value: "open", label: `Openstaand ${count("open") || ""}` },
          { value: "in_progress", label: `In behandeling ${count("in_progress") || ""}` },
          { value: "done", label: "Afgerond" },
          { value: "expired", label: "Verlopen" },
        ]}
      />
      {list === null ? (
        <div className="grid gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={reports?.length ? "Niets in deze lijst" : "Je hebt nog niets gemeld"}
          action={<Link href="/melden" className={buttonVariants({ size: "sm" })}><Plus /> Melding maken</Link>}
        >
          Zie je iets op straat? Een melding maken duurt een paar tikken. Je volgt hem daarna hier.
        </EmptyState>
      ) : (
        <ul className="grid gap-2">
          {list.map((r) => (
            <li key={r.id}>
              <Link href={`/melding/${r.id}`} className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted/40">
                <CategoryIcon code={r.category} />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="truncate font-medium">{CATEGORY_BY_CODE[r.category].name}</p>
                  <p className="truncate text-sm text-muted-foreground">{r.street ?? r.area} · {timeAgo(r.createdAt)}</p>
                  <p className="font-mono text-xs text-muted-foreground">{r.number}</p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
