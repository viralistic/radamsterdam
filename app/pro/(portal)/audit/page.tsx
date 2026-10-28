"use client";

import * as React from "react";
import type { AuditEntry } from "@/lib/types";
import { NoAccess, PageHeader, usePro } from "@/components/pro/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { api, formatDateTime } from "@/lib/utils";

const ACTIONS: Record<string, string> = {
  "auth.login": "Ingelogd",
  "report.viewed": "Gevoelig dossier bekeken",
  "report.accept": "Melding opgepakt",
  "report.assign": "Toegewezen of doorgezet",
  "report.close": "Melding afgesloten",
  "report.reopen": "Melding heropend",
  "report.note": "Notitie toegevoegd",
  "report.priority": "Prioriteit gewijzigd",
  "report.moderate_media": "Foto gemodereerd",
  "report.flags": "Rapportages beoordeeld",
  "report.visibility": "Zichtbaarheid gewijzigd",
  "reports.bulk_accept": "Bulk opgepakt",
  "reports.bulk_close": "Bulk afgesloten",
  "export.csv": "Export gemaakt",
  "user.invited": "Gebruiker uitgenodigd",
  "user.updated": "Gebruiker gewijzigd",
  "user.access_revoked": "Toegang ingetrokken",
  "settings.category": "Categorie-instelling gewijzigd",
  "settings.org": "Organisatie-instelling gewijzigd",
  "platform.initialized": "Platform ingericht",
};

export default function AuditPage() {
  const pro = usePro();
  const [action, setAction] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<{ items: AuditEntry[]; total: number; pageSize: number } | null>(null);

  React.useEffect(() => setPage(1), [action]);
  React.useEffect(() => {
    if (!pro.can("audit.read")) return;
    const p = new URLSearchParams({ page: String(page) });
    if (action) p.set("action", action);
    api<{ items: AuditEntry[]; total: number; pageSize: number }>(`/api/pro/audit?${p}`).then(setData);
  }, [action, page, pro]);

  if (!pro.can("audit.read")) return <NoAccess />;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Auditlog"
        description="Wie heeft wat bekeken, gewijzigd of geëxporteerd. Het log kan niet worden aangepast en wordt 2 jaar bewaard."
        actions={
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-56" aria-label="Type actie">
            <option value="">Alle acties</option>
            <option value="auth">Inloggen</option>
            <option value="report.viewed">Inzage gevoelige dossiers</option>
            <option value="report">Acties op meldingen</option>
            <option value="export">Exports</option>
            <option value="user">Gebruikers en rollen</option>
            <option value="settings">Instellingen</option>
          </Select>
        }
      />
      <div className="grid gap-4 px-4 py-6 lg:px-8">
        <Card className="overflow-hidden">
          {!data ? (
            <div className="grid gap-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Tijdstip</th>
                    <th className="px-4 py-2 font-medium">Medewerker</th>
                    <th className="px-4 py-2 font-medium">Actie</th>
                    <th className="px-4 py-2 font-medium">Onderwerp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatDateTime(a.createdAt)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{a.actorName}</td>
                      <td className="px-4 py-2.5">{ACTIONS[a.action] ?? a.action}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{a.target ?? ""}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nog geen regels voor deze selectie.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {data && data.total > data.pageSize && (
          <div className="flex justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Vorige</Button>
            <span className="self-center text-muted-foreground">{page} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Volgende</Button>
          </div>
        )}
      </div>
    </>
  );
}
