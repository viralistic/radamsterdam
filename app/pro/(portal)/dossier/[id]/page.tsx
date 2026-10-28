"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Eye, Flag, Lock, MapPin, MessageSquare, RotateCcw, Send, ShieldAlert, UserPlus } from "lucide-react";
import { CATEGORY_BY_CODE, VISIBILITY_LABEL, type Visibility } from "@/lib/categories";
import { RESOLUTION_LABEL } from "@/lib/status";
import type { Assignment, ReportEvent, ResolutionCode, Report } from "@/lib/types";
import { CategoryIcon, StatusBadge } from "@/components/category";
import { MapView } from "@/components/map";
import { NoAccess } from "@/components/pro/shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert, Skeleton } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ApiClientError, api, cn, formatDateTime, timeAgo } from "@/lib/utils";

interface Dossier {
  report: Omit<Report, "reporterId"> & { publicText: string };
  reporter: { label: string; otherReports: number };
  quality: { present: number; gone: number; wrongLocation: number; wrongCategory: number; duplicate: number; reliability: string };
  flags: { open: number; reasons: Record<string, number> };
  media: { id: string; url: string; moderationStatus: string }[];
  assignments: (Assignment & { orgName: string; assigneeName: string | null })[];
  events: ReportEvent[];
  duplicates: { id: string; number: string; createdAt: string; status: string }[];
  organizations: { id: string; name: string }[];
  colleagues: { id: string; name: string }[];
  permissions: { handle: boolean; moderate: boolean };
}

const FLAG_LABEL: Record<string, string> = {
  personal_data: "Persoonsgegevens",
  discrimination: "Discriminerend",
  false_report: "Bewust vals",
  abuse: "Intimidatie of misbruik",
  other: "Overig",
};

const CLOSE_CODES: ResolutionCode[] = ["REPAIRED", "CLEANED", "REFERRED_CARE", "NOT_CONFIRMED", "OUT_OF_SCOPE", "DUPLICATE"];

export default function DossierPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [d, setD] = React.useState<Dossier | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [dialog, setDialog] = React.useState<"assign" | "close" | "reopen" | null>(null);

  React.useEffect(() => {
    api<Dossier>(`/api/pro/reports/${id}`)
      .then(setD)
      .catch((e: ApiClientError) => setError(e.message));
  }, [id]);

  async function act(body: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      const next = await api<Dossier>(`/api/pro/reports/${id}`, { method: "PATCH", json: body });
      setD(next);
      setDialog(null);
      toast({ title: message });
      return true;
    } catch (e) {
      toast({ title: "Dat lukte niet", description: (e as Error).message, variant: "error" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (error) return <NoAccess text={error} />;
  if (!d) return <div className="grid gap-4 p-8"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;

  const r = d.report;
  const cat = CATEGORY_BY_CODE[r.category];
  const live = ["new", "confirmed", "in_progress", "under_review"].includes(r.status);
  const closed = ["resolved", "expired", "withdrawn"].includes(r.status);
  const current = d.assignments.filter((a) => a.status !== "closed").at(-1);

  return (
    <>
      <div className="flex flex-col gap-4 border-b px-4 py-5 lg:px-8">
        <Link href="/pro/wachtrij" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit -ml-2" })}>
          <ArrowLeft /> Wachtrij
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <CategoryIcon code={r.category} size="lg" />
            <div className="grid gap-1">
              <h1 className="text-xl font-semibold tracking-tight">{cat.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono">{r.number}</span>
                <StatusBadge status={r.status} />
                {r.priority === "high" && <Badge variant="danger">Hoge prioriteit</Badge>}
                {r.visibility === "professional" && <Badge variant="outline"><Lock /> Afgeschermd</Badge>}
              </div>
            </div>
          </div>
          {d.permissions.handle && (
            <div className="flex flex-wrap gap-2">
              {["new", "confirmed", "under_review"].includes(r.status) && (
                <Button onClick={() => act({ action: "accept" }, "Melding opgepakt")} disabled={busy}>
                  <Check /> Oppakken
                </Button>
              )}
              {live && (
                <>
                  <Button variant="outline" onClick={() => setDialog("assign")} disabled={busy}><UserPlus /> Toewijzen of doorzetten</Button>
                  <Button variant="outline" onClick={() => setDialog("close")} disabled={busy}><CheckCircle2 /> Afsluiten</Button>
                </>
              )}
              {closed && <Button variant="outline" onClick={() => setDialog("reopen")} disabled={busy}><RotateCcw /> Heropenen</Button>}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 px-4 py-6 lg:px-8 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Oorspronkelijke melding</CardTitle>
              <CardDescription>Tekst van de melder, ongewijzigd. Persoonsgegevens worden alleen uit de publieke versie gefilterd.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="rounded-lg bg-muted/50 p-3 text-sm">{r.description || <span className="text-muted-foreground">Geen omschrijving toegevoegd.</span>}</p>
              {r.reviewerNote && (
                <div className="grid gap-1">
                  <p className="text-xs font-medium text-muted-foreground">Toelichting voor de beoordelaar</p>
                  <p className="rounded-lg bg-muted/50 p-3 text-sm">{r.reviewerNote}</p>
                </div>
              )}
              <div className="grid gap-1">
                <p className="text-xs font-medium text-muted-foreground">Zoals inwoners het zien</p>
                <p className="text-sm">{r.visibility === "professional" ? "Niet zichtbaar op de openbare kaart." : r.publicText}</p>
              </div>
              {d.media.length > 0 && (
                <div className="grid gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Foto</p>
                  {d.media.map((m) => (
                    <div key={m.id} className="grid gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="Foto bij melding" className="max-h-72 rounded-lg border object-cover" />
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant={m.moderationStatus === "approved" ? "success" : m.moderationStatus === "rejected" ? "danger" : "warning"}>
                          {m.moderationStatus === "approved" ? "Vrijgegeven" : m.moderationStatus === "rejected" ? "Afgewezen" : "Wacht op moderatie"}
                        </Badge>
                        {d.permissions.moderate && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => act({ action: "moderate_media", mediaId: m.id, decision: "approved" }, "Foto vrijgegeven")}>Vrijgeven</Button>
                            <Button size="sm" variant="outline" onClick={() => act({ action: "moderate_media", mediaId: m.id, decision: "rejected" }, "Foto afgewezen")}>Afwijzen</Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tijdlijn</CardTitle>
              <CardDescription>Alle gebeurtenissen. Interne notities zijn nooit zichtbaar voor inwoners.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {d.permissions.handle && (
                <form
                  className="grid gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (note.trim() && (await act({ action: "note", text: note.trim() }, "Notitie toegevoegd"))) setNote("");
                  }}
                >
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Interne notitie toevoegen" className="min-h-16" />
                  <Button type="submit" size="sm" variant="secondary" className="w-fit" disabled={!note.trim() || busy}><Send /> Notitie opslaan</Button>
                </form>
              )}
              <ol className="grid gap-4 border-l pl-5">
                {d.events.map((e) => (
                  <li key={e.id} className="relative grid gap-0.5 text-sm">
                    <span className={cn("absolute top-1 -left-[25px] flex size-3 items-center justify-center rounded-full ring-4 ring-background", e.internal ? "bg-amber-500" : "bg-foreground/70")} />
                    <div className="flex flex-wrap items-center gap-2">
                      <p>{e.message}</p>
                      {e.internal && <Badge variant="warning"><MessageSquare /> Intern</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{e.actorLabel} · {formatDateTime(e.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card className="overflow-hidden">
            <div className="relative h-52">
              <MapView className="absolute inset-0" center={r.location} zoom={16} cluster={false} markers={[{ id: r.id, lat: r.location.lat, lng: r.location.lng, category: r.category, status: r.status }]} />
            </div>
            <CardContent className="grid gap-1 pt-4 text-sm">
              <p className="flex items-center gap-1.5 font-medium"><MapPin className="size-4" /> {r.street ?? "Geen adres"}</p>
              <p className="text-muted-foreground">{r.area} · {r.location.lat.toFixed(5)}, {r.location.lng.toFixed(5)}</p>
              <p className="text-xs text-muted-foreground">Publiek: {r.visibility === "public" ? "exacte locatie" : r.visibility === "public_fuzzy" ? "afgerond op circa 150 meter" : "niet zichtbaar"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Opvolging</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row label="Organisatie" value={current?.orgName ?? d.organizations.find((o) => o.id === r.orgId)?.name ?? "Onbekend"} />
              <Row label="Medewerker" value={current?.assigneeName ?? "Niemand"} />
              <Row label="Team" value={current?.team ?? "Geen"} />
              <Row label="Reactietermijn" value={current?.dueAt ? `${formatDateTime(current.dueAt)}${new Date(current.dueAt) < new Date() ? " (verstreken)" : ""}` : "Geen"} />
              <Row label="Gemeld" value={formatDateTime(r.createdAt)} />
              <Row label="Eerste beoordeling" value={r.firstReviewedAt ? `${formatDateTime(r.firstReviewedAt)}` : "Nog niet"} />
              {r.resolutionCode && <Row label="Afhandeling" value={RESOLUTION_LABEL[r.resolutionCode]} />}
              {d.permissions.handle && live && (
                <div className="grid gap-1.5">
                  <Label htmlFor="prio">Prioriteit</Label>
                  <Select id="prio" value={r.priority} onChange={(e) => act({ action: "priority", priority: e.target.value }, "Prioriteit aangepast")}>
                    <option value="high">Hoog</option>
                    <option value="normal">Normaal</option>
                    <option value="low">Laag</option>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Betrouwbaarheid</CardTitle>
              <CardDescription>Afgeleid uit stemmen van buren. Een melding is geen vastgesteld incident.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row label="Nog aanwezig" value={d.quality.present} />
              <Row label="Niet meer aanwezig" value={d.quality.gone} />
              <Row label="Locatie klopt niet" value={d.quality.wrongLocation} />
              <Row label="Verkeerde categorie" value={d.quality.wrongCategory} />
              <Row label="Dubbele melding" value={d.quality.duplicate} />
              <Row label="Melder" value={`${d.reporter.label}${d.reporter.otherReports ? `, ${d.reporter.otherReports} andere meldingen` : ""}`} />
              {d.duplicates.length > 0 && (
                <div className="grid gap-1.5 rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Mogelijk dezelfde situatie (binnen 150 m en 7 dagen)</p>
                  {d.duplicates.map((x) => (
                    <Link key={x.id} href={`/pro/dossier/${x.id}`} className="flex justify-between text-sm hover:underline">
                      <span className="font-mono">{x.number}</span>
                      <span className="text-muted-foreground">{timeAgo(x.createdAt)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(d.flags.open > 0 || d.permissions.moderate) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldAlert className="size-4" /> Moderatie</CardTitle>
                <CardDescription>{d.flags.open} open misbruikrapportages.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {Object.entries(d.flags.reasons).map(([k, v]) => <Row key={k} label={FLAG_LABEL[k] ?? k} value={v} />)}
                {d.permissions.moderate && (
                  <>
                    {d.flags.open > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => act({ action: "flags", decision: "dismiss" }, "Rapportages afgewezen, melding blijft staan")}><Flag /> Rapportages afwijzen</Button>
                        <Button size="sm" variant="destructive" onClick={() => act({ action: "flags", decision: "uphold" }, "Melding verwijderd")}>Melding verwijderen</Button>
                      </div>
                    )}
                    <div className="grid gap-1.5">
                      <Label htmlFor="vis" className="flex items-center gap-1.5"><Eye className="size-3.5" /> Zichtbaarheid</Label>
                      <Select id="vis" value={r.visibility} onChange={(e) => act({ action: "visibility", visibility: e.target.value }, "Zichtbaarheid aangepast")}>
                        {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => <option key={v} value={v}>{VISIBILITY_LABEL[v].title}</option>)}
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AssignDialog open={dialog === "assign"} onOpenChange={(o) => setDialog(o ? "assign" : null)} d={d} busy={busy} onSubmit={(b) => act({ action: "assign", ...b }, "Toewijzing opgeslagen")} />
      <CloseDialog open={dialog === "close"} onOpenChange={(o) => setDialog(o ? "close" : null)} d={d} busy={busy} onSubmit={(b) => act({ action: "close", ...b }, "Melding afgesloten")} />
      <ReopenDialog open={dialog === "reopen"} onOpenChange={(o) => setDialog(o ? "reopen" : null)} busy={busy} onSubmit={(reason) => act({ action: "reopen", reason }, "Melding heropend")} />
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function AssignDialog({ open, onOpenChange, d, busy, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; d: Dossier; busy: boolean; onSubmit: (b: Record<string, unknown>) => void }) {
  const [orgId, setOrgId] = React.useState(d.report.orgId);
  const [assignedTo, setAssignedTo] = React.useState("");
  const [team, setTeam] = React.useState("");
  const [dueHours, setDueHours] = React.useState("");
  const ownOrg = d.colleagues.length > 0 && orgId === d.report.orgId;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Toewijzen of doorzetten</DialogTitle>
          <DialogDescription>Kies de verantwoordelijke organisatie. Een defecte lantaarnpaal hoort bij de gemeente, niet bij de politie.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="org">Organisatie</Label>
            <Select id="org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {d.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </div>
          {ownOrg && (
            <div className="grid gap-2">
              <Label htmlFor="who">Medewerker (optioneel)</Label>
              <Select id="who" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Nog niemand</option>
                {d.colleagues.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="team">Team (optioneel)</Label>
              <Input id="team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Team Oost" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="due">Reactietermijn (uur)</Label>
              <Input id="due" type="number" min={1} value={dueHours} onChange={(e) => setDueHours(e.target.value)} placeholder="Standaard" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button disabled={busy} onClick={() => onSubmit({ orgId, assignedTo: ownOrg && assignedTo ? assignedTo : null, team: team || null, dueHours: dueHours ? Number(dueHours) : null })}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({ open, onOpenChange, d, busy, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; d: Dossier; busy: boolean; onSubmit: (b: Record<string, unknown>) => void }) {
  const [code, setCode] = React.useState<ResolutionCode>("REPAIRED");
  const [duplicateOf, setDuplicateOf] = React.useState(d.duplicates[0]?.id ?? "");
  const [message, setMessage] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Melding afsluiten</DialogTitle>
          <DialogDescription>De melder en buren zien de reden. Komt het terug? Dan kun je de melding heropenen.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2" role="radiogroup">
            {CLOSE_CODES.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-foreground">
                <input type="radio" name="code" className="accent-neutral-900" checked={code === c} onChange={() => setCode(c)} />
                {RESOLUTION_LABEL[c]}
              </label>
            ))}
          </div>
          {code === "DUPLICATE" && (
            d.duplicates.length ? (
              <div className="grid gap-2">
                <Label htmlFor="dup">Oorspronkelijke melding</Label>
                <Select id="dup" value={duplicateOf} onChange={(e) => setDuplicateOf(e.target.value)}>
                  {d.duplicates.map((x) => <option key={x.id} value={x.id}>{x.number}</option>)}
                </Select>
              </div>
            ) : (
              <Alert variant="warning">Er is geen vergelijkbare melding in de buurt gevonden. Kies een andere reden.</Alert>
            )
          )}
          <div className="grid gap-2">
            <Label htmlFor="msg">Bericht voor inwoners (optioneel)</Label>
            <Input id="msg" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} placeholder="Bijvoorbeeld: lamp vervangen op 12 oktober" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button disabled={busy || (code === "DUPLICATE" && !duplicateOf)} onClick={() => onSubmit({ resolutionCode: code, duplicateOf: code === "DUPLICATE" ? duplicateOf : null, publicMessage: message || undefined })}>
            Afsluiten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReopenDialog({ open, onOpenChange, busy, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; busy: boolean; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Melding heropenen</DialogTitle>
          <DialogDescription>De oude geschiedenis blijft bewaard. Geef kort aan waarom.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bijvoorbeeld: lamp is opnieuw uitgevallen" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button disabled={busy || reason.trim().length < 3} onClick={() => onSubmit(reason.trim())}>Heropenen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
