"use client";

import * as React from "react";
import { Check, ChevronDown, Clock, Flag, MapPin, ShieldCheck, Undo2, X } from "lucide-react";
import { CATEGORY_BY_CODE } from "@/lib/categories";
import { STATUS_HELP } from "@/lib/status";
import type { ConfirmationType, FlagReason, PublicEvent, PublicReport } from "@/lib/types";
import { CategoryIcon, StatusBadge } from "@/components/category";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, Separator, Skeleton } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, cn, formatDateTime, timeAgo } from "@/lib/utils";

const RELIABILITY = {
  low: { label: "Nog niet bevestigd", tone: "text-muted-foreground" },
  medium: { label: "Redelijk betrouwbaar", tone: "text-amber-700" },
  high: { label: "Betrouwbaar", tone: "text-emerald-700" },
};

const FLAG_REASONS: { value: FlagReason; label: string }[] = [
  { value: "personal_data", label: "Er staan persoonsgegevens of een herkenbaar persoon in" },
  { value: "discrimination", label: "Discriminerend of beledigend" },
  { value: "false_report", label: "Bewust valse melding" },
  { value: "abuse", label: "Intimidatie of misbruik" },
  { value: "other", label: "Iets anders" },
];

export function ReportDetail({
  report: initial,
  onChange,
  compact,
}: {
  report: PublicReport;
  onChange?: (r: PublicReport) => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const [report, setReport] = React.useState(initial);
  const [events, setEvents] = React.useState<PublicEvent[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [showCorrections, setShowCorrections] = React.useState(false);
  const [flagOpen, setFlagOpen] = React.useState(false);
  const [flagReason, setFlagReason] = React.useState<FlagReason>("personal_data");
  const cat = CATEGORY_BY_CODE[report.category];
  const live = ["new", "confirmed", "in_progress"].includes(report.status);

  React.useEffect(() => setReport(initial), [initial]);

  const loadEvents = React.useCallback(async () => {
    try {
      const data = await api<{ report: PublicReport; events: PublicEvent[] }>(`/api/reports/${initial.id}`);
      setEvents(data.events);
      setReport(data.report);
    } catch {
      setEvents([]);
    }
  }, [initial.id]);

  React.useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  async function vote(type: ConfirmationType) {
    setBusy(type);
    try {
      const data = await api<{ report: PublicReport }>(`/api/reports/${report.id}/confirmations`, { method: "POST", json: { type } });
      setReport(data.report);
      onChange?.(data.report);
      loadEvents();
      toast({
        title: type === "present" ? "Bedankt, je bevestiging telt mee" : type === "gone" ? "Bedankt, we geven het door" : "Bedankt voor je correctie",
        description:
          type === "present"
            ? "Zo weten buren en de gemeente dat dit nog speelt."
            : type === "gone"
              ? "Als meer buren dit zien, verdwijnt de melding van de kaart."
              : "Een beoordelaar kijkt ernaar.",
      });
      setShowCorrections(false);
    } catch (e) {
      toast({ title: "Dat lukte niet", description: (e as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function submitFlag() {
    setBusy("flag");
    try {
      await api(`/api/reports/${report.id}/flags`, { method: "POST", json: { reason: flagReason } });
      setReport({ ...report, myFlagged: true });
      setFlagOpen(false);
      toast({ title: "Bedankt voor je rapportage", description: "Een moderator bekijkt deze melding." });
    } catch (e) {
      toast({ title: "Dat lukte niet", description: (e as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    setBusy("withdraw");
    try {
      await api(`/api/reports/${report.id}`, { method: "DELETE" });
      const next = { ...report, status: "withdrawn" as const };
      setReport(next);
      onChange?.(next);
      toast({ title: "Je melding is ingetrokken" });
    } catch (e) {
      toast({ title: "Dat lukte niet", description: (e as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-3">
        <CategoryIcon code={report.category} size="lg" />
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="text-lg leading-tight font-semibold">{cat.name}</h2>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {report.street ? `${report.street}, ${report.area}` : report.area}
            </span>
            {report.approximate && <Badge variant="outline">Globale locatie</Badge>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={report.status} />
        <span className="text-xs text-muted-foreground">{STATUS_HELP[report.status]}</span>
      </div>

      <p className="text-[15px] leading-relaxed">{report.text}</p>

      {report.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={report.photoUrl} alt={`Foto bij melding: ${cat.name}`} className="max-h-64 w-full rounded-lg border object-cover" />
      )}

      <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Gemeld</dt>
          <dd className="font-medium">{timeAgo(report.createdAt)}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Laatst bevestigd</dt>
          <dd className="font-medium">{timeAgo(report.lastConfirmedAt)}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Buren zien dit ook</dt>
          <dd className="font-medium">{report.confirmations}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Betrouwbaarheid</dt>
          <dd className={cn("font-medium", RELIABILITY[report.reliability].tone)}>{RELIABILITY[report.reliability].label}</dd>
        </div>
      </dl>

      {report.status === "expired" && cat.group === "safety" && (
        <Alert variant="warning" icon={<Clock />} title="Niet meer actueel gemeld">
          Dit betekent niet dat de situatie veilig is. Zie je het nu? Maak een nieuwe melding.
        </Alert>
      )}

      {live && !report.isMine && (
        <div className="grid gap-3">
          <p className="font-medium">Is dit er nog?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={report.myConfirmation === "present" ? "default" : "outline"}
              onClick={() => vote("present")}
              disabled={!!busy}
            >
              <Check /> Ja, nog aanwezig
            </Button>
            <Button variant={report.myConfirmation === "gone" ? "default" : "outline"} onClick={() => vote("gone")} disabled={!!busy}>
              <X /> Nee, het is weg
            </Button>
          </div>
          {report.myConfirmation && (
            <p className="text-xs text-muted-foreground">
              Je stem is opgeslagen. Je kunt hem altijd aanpassen. Per persoon telt één stem.
            </p>
          )}
          {cat.professionalResolveOnly && (
            <p className="text-xs text-muted-foreground">Bij deze categorie beslist alleen de bevoegde dienst wanneer het is opgelost.</p>
          )}

          <button
            type="button"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowCorrections((v) => !v)}
            aria-expanded={showCorrections}
          >
            Klopt er iets niet? <ChevronDown className={cn("size-4 transition-transform", showCorrections && "rotate-180")} />
          </button>
          {showCorrections && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" size="sm" onClick={() => vote("wrong_location")} disabled={!!busy}>
                Locatie klopt niet
              </Button>
              <Button variant="secondary" size="sm" onClick={() => vote("wrong_category")} disabled={!!busy}>
                Verkeerde categorie
              </Button>
              <Button variant="secondary" size="sm" onClick={() => vote("duplicate")} disabled={!!busy}>
                Dubbele melding
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setFlagOpen(true)} disabled={!!busy || report.myFlagged}>
                <Flag /> {report.myFlagged ? "Gerapporteerd" : "Misbruik melden"}
              </Button>
            </div>
          )}
        </div>
      )}

      {report.isMine && (
        <Alert icon={<ShieldCheck />} title="Dit is jouw melding">
          Meldingsnummer {report.number}. Je kunt je eigen melding niet bevestigen, dat doen buren.
          {["new", "confirmed"].includes(report.status) && (
            <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={withdraw} disabled={!!busy}>
              <Undo2 /> Melding intrekken
            </Button>
          )}
        </Alert>
      )}

      {!compact && <Separator />}

      <div className="grid gap-3">
        <p className="font-medium">Wat is er gebeurd?</p>
        {events === null ? (
          <div className="grid gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <ol className="grid gap-3 border-l pl-4">
            {events.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-foreground/60" />
                <p>{e.message}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-muted-foreground">Meldingsnummer {report.number}</p>
      </div>

      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wat is er mis met deze melding?</DialogTitle>
            <DialogDescription>Een moderator kijkt ernaar. De melding blijft staan tot er een besluit is.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2" role="radiogroup">
            {FLAG_REASONS.map((r) => (
              <label key={r.value} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm", flagReason === r.value && "border-foreground")}>
                <input type="radio" name="flag" value={r.value} checked={flagReason === r.value} onChange={() => setFlagReason(r.value)} className="accent-neutral-900" />
                {r.label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={submitFlag} disabled={busy === "flag"}>
              Rapportage versturen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
