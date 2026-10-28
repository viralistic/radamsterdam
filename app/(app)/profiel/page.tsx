"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, ChevronRight, Loader2, MapPin, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { CATEGORIES, GROUPS, GROUP_ORDER, type CategoryCode } from "@/lib/categories";
import type { CitizenPrefs, FollowedArea } from "@/lib/types";
import { searchAddress, type GeoResult } from "@/lib/geocode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Input, Label, Select } from "@/components/ui/input";
import { Alert, EmptyState, Separator, Skeleton } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/utils";

const RADII = [500, 1000, 3000, 5000] as const;
const fmtRadius = (r: number) => (r < 1000 ? `${r} meter` : `${r / 1000} km`);

export default function ProfielPage() {
  const toast = useToast();
  const router = useRouter();
  const [prefs, setPrefs] = React.useState<CitizenPrefs | null>(null);
  const [reportCount, setReportCount] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    api<{ prefs: CitizenPrefs; reports: unknown[] }>("/api/me").then((d) => {
      setPrefs(d.prefs);
      setReportCount(d.reports.length);
    });
  }, []);

  async function save(next: CitizenPrefs, message = "Voorkeuren opgeslagen") {
    setPrefs(next);
    setSaving(true);
    try {
      await api("/api/me/preferences", { method: "PUT", json: next });
      toast({ title: message });
    } catch (e) {
      toast({ title: "Opslaan lukte niet", description: (e as Error).message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    await api("/api/me", { method: "DELETE" });
    toast({ title: "Je gegevens zijn verwijderd", description: "Je meldingen blijven anoniem in het logboek staan." });
    setDeleteOpen(false);
    router.push("/");
  }

  if (!prefs) return <div className="mx-auto grid max-w-2xl gap-4 px-4 py-8"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  const n = prefs.notifications;

  return (
    <div className="mx-auto grid max-w-2xl gap-5 px-4 py-6 md:py-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profiel</h1>
        <p className="text-muted-foreground">Kies welke buurt je volgt en hoe vaak je iets hoort. Je hebt geen account nodig.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="size-4" /> Gebieden die je volgt</CardTitle>
          <CardDescription>Maximaal vijf gebieden. Je locatievoorkeur is nooit openbaar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {prefs.areas.length === 0 ? (
            <EmptyState title="Je volgt nog geen gebied">Volg je straat, je werk of de school van je kinderen. Dan zie je wat daar speelt.</EmptyState>
          ) : (
            <ul className="grid gap-2">
              {prefs.areas.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Straal {fmtRadius(a.radius)} · {a.categories.length ? `${a.categories.length} categorieën` : "Alle categorieën"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Verwijder ${a.name}`}
                    onClick={() => save({ ...prefs, areas: prefs.areas.filter((x) => x.id !== a.id) }, "Gebied verwijderd")}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" className="w-fit" onClick={() => setAddOpen(true)} disabled={prefs.areas.length >= 5}>
            <Plus /> Gebied toevoegen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellRing className="size-4" /> Meldingen ontvangen</CardTitle>
          <CardDescription>We bundelen berichten, zodat je niet bij elke melding een pushbericht krijgt.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2" role="radiogroup">
            {([
              ["urgent", "Alleen urgente, relevante meldingen", "Bijvoorbeeld een obstakel op je fietsroute."],
              ["all", "Alle meldingen in mijn gebieden", "Uit de categorieën die je kiest."],
              ["digest", "Alleen een samenvatting", "Een overzicht per dag of per week."],
              ["off", "Geen berichten", "Je kijkt zelf op de kaart."],
            ] as const).map(([value, label, help]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-foreground">
                <input type="radio" name="mode" className="mt-0.5 accent-neutral-900" checked={n.mode === value} onChange={() => save({ ...prefs, notifications: { ...n, mode: value } })} />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="text-muted-foreground">{help}</span>
                </span>
              </label>
            ))}
          </div>
          {n.mode === "digest" && (
            <div className="grid gap-2">
              <Label htmlFor="digest">Hoe vaak?</Label>
              <Select id="digest" value={n.digest} onChange={(e) => save({ ...prefs, notifications: { ...n, digest: e.target.value as "daily" | "weekly" } })}>
                <option value="daily">Dagelijks</option>
                <option value="weekly">Wekelijks</option>
              </Select>
            </div>
          )}
          {n.mode !== "off" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="qf">Stil vanaf</Label>
                <Input id="qf" type="time" value={n.quietFrom} onChange={(e) => save({ ...prefs, notifications: { ...n, quietFrom: e.target.value } })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qt">Stil tot</Label>
                <Input id="qt" type="time" value={n.quietTo} onChange={(e) => save({ ...prefs, notifications: { ...n, quietTo: e.target.value } })} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Pushberichten werken in de mobiele app. In deze webversie bewaren we alvast je voorkeur.{saving && " Opslaan..."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Privacy</CardTitle>
          <CardDescription>Wat we van jou bewaren en hoe je het weghaalt.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <Link href="/privacy" className="flex items-center justify-between rounded-md py-2 hover:underline">Privacy en spelregels <ChevronRight className="size-4" /></Link>
          <Link href="/mijn-meldingen" className="flex items-center justify-between rounded-md py-2 hover:underline">Mijn meldingen ({reportCount}) <ChevronRight className="size-4" /></Link>
          <Separator className="my-2" />
          <Button variant="outline" className="w-fit text-red-700" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Mijn gegevens verwijderen
          </Button>
        </CardContent>
      </Card>

      <AddAreaDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={(a) => save({ ...prefs, areas: [...prefs.areas, a] }, `Je volgt nu ${a.name}`)}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Je gegevens verwijderen?</DialogTitle>
            <DialogDescription>
              We wissen je voorkeuren, foto&apos;s en bevestigingen en koppelen je meldingen los van dit apparaat. De meldingen zelf blijven anoniem in het logboek, zodat de gemeente ze kan afhandelen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuleren</Button>
            <Button variant="destructive" onClick={deleteAccount}>Ja, verwijder mijn gegevens</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddAreaDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (a: FollowedArea) => void }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [chosen, setChosen] = React.useState<GeoResult | null>(null);
  const [name, setName] = React.useState("");
  const [radius, setRadius] = React.useState<(typeof RADII)[number]>(1000);
  const [cats, setCats] = React.useState<CategoryCode[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setChosen(null);
      setName("");
      setCats([]);
    }
  }, [open]);

  React.useEffect(() => {
    if (query.trim().length < 3 || chosen?.label === query) return setResults([]);
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(
      () => searchAddress(query, ctrl.signal).then(setResults).catch(() => setResults([])).finally(() => setSearching(false)),
      300,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, chosen]);

  function useLocation() {
    navigator.geolocation?.getCurrentPosition((p) => {
      const r = { label: "Mijn huidige locatie", lat: p.coords.latitude, lng: p.coords.longitude };
      setChosen(r);
      setQuery(r.label);
      setName((n) => n || "Mijn buurt");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gebied volgen</DialogTitle>
          <DialogDescription>Zoek een adres of gebruik je locatie. Je kiest daarna de straal.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="relative grid gap-2">
            <Label htmlFor="area-q">Adres of postcode</Label>
            <Input id="area-q" value={query} onChange={(e) => { setQuery(e.target.value); setChosen(null); }} placeholder="Bijvoorbeeld 1011 AB of Javastraat" />
            {searching && <Loader2 className="absolute top-8 right-3 size-4 animate-spin text-muted-foreground" />}
            {results.length > 0 && (
              <ul className="overflow-hidden rounded-lg border">
                {results.map((r) => (
                  <li key={r.label}>
                    <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setChosen(r); setQuery(r.label); setResults([]); setName((n) => n || r.label.split(",")[0]); }}>
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="link" size="sm" className="w-fit px-0" onClick={useLocation}>Gebruik mijn locatie</Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="area-name">Naam</Label>
            <Input id="area-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Bijvoorbeeld Thuis" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="area-r">Straal</Label>
            <Select id="area-r" value={radius} onChange={(e) => setRadius(Number(e.target.value) as (typeof RADII)[number])}>
              {RADII.map((r) => <option key={r} value={r}>{fmtRadius(r)}</option>)}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Categorieën (leeg is alles)</Label>
            <div className="grid max-h-48 gap-3 overflow-y-auto rounded-lg border p-3">
              {GROUP_ORDER.map((g) => (
                <div key={g} className="grid gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{GROUPS[g].name}</p>
                  {CATEGORIES.filter((c) => c.group === g && c.defaultVisibility !== "professional").map((c) => (
                    <label key={c.code} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={cats.includes(c.code)} onChange={(e) => setCats((all) => (e.target.checked ? [...all, c.code] : all.filter((x) => x !== c.code)))} />
                      {c.name}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {!chosen && query.length > 2 && results.length === 0 && !searching && (
            <Alert>Kies een resultaat uit de lijst of gebruik je locatie.</Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button
            disabled={!chosen || !name.trim()}
            onClick={() => {
              onAdd({ id: crypto.randomUUID(), name: name.trim(), lat: chosen!.lat, lng: chosen!.lng, radius, categories: cats });
              onOpenChange(false);
            }}
          >
            Gebied volgen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
