"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CircleCheck,
  Eye,
  Loader2,
  LocateFixed,
  MapPin,
  Phone,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_BY_CODE,
  GROUPS,
  GROUP_ORDER,
  VISIBILITY_LABEL,
  type CategoryCode,
} from "@/lib/categories";
import type { LatLng, PublicReport } from "@/lib/types";
import { CITY_CENTER } from "@/lib/areas";
import { reverseGeocode, searchAddress, type GeoResult } from "@/lib/geocode";
import { MapView, type MapViewHandle } from "@/components/map";
import { CategoryIcon } from "@/components/category";
import { EmergencyBar } from "@/components/emergency";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGeolocation } from "@/hooks/use-live";
import { api, cn } from "@/lib/utils";

type Step = 0 | 1 | 2 | 3 | 4;
const STEP_TITLES = ["Wat zie je?", "Waar is het?", "Wil je iets toevoegen?", "Klopt alles?"];

/** Codeert de foto opnieuw in de browser. Daarmee verdwijnen EXIF- en GPS-gegevens. */
async function stripAndResize(file: File, max = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Foto verwerken mislukt"))), "image/jpeg", 0.82));
}

export function MeldenClient() {
  const router = useRouter();
  const mapRef = React.useRef<MapViewHandle>(null);
  const geo = useGeolocation();
  const [step, setStep] = React.useState<Step>(0);
  const [category, setCategory] = React.useState<CategoryCode | null>(null);
  const [acuteFor, setAcuteFor] = React.useState<CategoryCode | null>(null);
  const [center, setCenter] = React.useState<LatLng>(CITY_CENTER);
  const [address, setAddress] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [description, setDescription] = React.useState("");
  const [reviewerNote, setReviewerNote] = React.useState("");
  const [photo, setPhoto] = React.useState<{ id: string; preview: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [privacyAck, setPrivacyAck] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [created, setCreated] = React.useState<PublicReport | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const locatedOnce = React.useRef(false);

  const cat = category ? CATEGORY_BY_CODE[category] : null;

  function chooseCategory(code: CategoryCode) {
    if (CATEGORY_BY_CODE[code].acuteCheck) {
      setAcuteFor(code);
      return;
    }
    setCategory(code);
    setStep(1);
  }

  // Vraag pas om locatie als de stap daarom vraagt.
  React.useEffect(() => {
    if (step === 1 && !locatedOnce.current) {
      locatedOnce.current = true;
      setLocating(true);
      geo.locate().then((p) => {
        setLocating(false);
        if (p) {
          setCenter(p);
          setTimeout(() => mapRef.current?.flyTo(p, 17), 300);
        }
      });
    }
  }, [step, geo]);

  // Adres bij de pin.
  React.useEffect(() => {
    if (step !== 1) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => reverseGeocode(center.lat, center.lng, ctrl.signal).then(setAddress), 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [center, step]);

  React.useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => searchAddress(query, ctrl.signal).then(setResults).catch(() => setResults([])), 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const blob = await stripAndResize(file);
      const form = new FormData();
      form.append("file", new File([blob], "foto.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPhoto({ id: data.id, preview: URL.createObjectURL(blob) });
    } catch (e) {
      setError((e as Error).message || "De foto kon niet worden toegevoegd.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const needsAck = !!description.trim() || !!photo || !!reviewerNote.trim();

  async function submit() {
    if (!category) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api<{ report: PublicReport }>("/api/reports", {
        method: "POST",
        json: {
          category,
          location: center,
          street: address,
          description: description.trim() || undefined,
          reviewerNote: reviewerNote.trim() || undefined,
          mediaId: photo?.id ?? null,
          privacyAck,
        },
      });
      setCreated(data.report);
      setStep(4);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function back() {
    if (step === 0) router.push("/kaart");
    else setStep((s) => (s - 1) as Step);
  }

  if (step === 4 && created && cat) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-lg content-center gap-6 px-4 py-10">
        <div className="grid justify-items-center gap-3 text-center">
          <div className="rounded-full bg-emerald-50 p-3 text-emerald-600">
            <CircleCheck className="size-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Bedankt. Je melding is ontvangen.</h1>
          <p className="text-muted-foreground">
            Meldingsnummer <span className="font-mono font-medium text-foreground">{created.number}</span>
          </p>
          <p className="text-xs text-muted-foreground">Dit nummer bevestigt dat we je melding hebben. Het is geen bewijs dat de situatie is gecontroleerd.</p>
        </div>
        <div className="grid gap-3 rounded-xl border p-5">
          <p className="font-medium">Wat gebeurt er nu?</p>
          <ol className="grid gap-3 text-sm">
            <li className="flex gap-3"><span className="font-semibold">1.</span>{cat.defaultVisibility === "professional" ? "Je melding gaat direct en alleen naar de bevoegde dienst." : "Buren zien je melding op de kaart en kunnen hem bevestigen."}</li>
            <li className="flex gap-3"><span className="font-semibold">2.</span>{cat.owner} beoordeelt de melding en pakt hem op.</li>
            <li className="flex gap-3"><span className="font-semibold">3.</span>Je ziet in Mijn meldingen wanneer het is opgepakt en opgelost.</li>
          </ol>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/mijn-meldingen" className={buttonVariants()}>Volg je melding</Link>
          <Link href={cat.defaultVisibility === "professional" ? "/kaart" : `/kaart?melding=${created.id}`} className={buttonVariants({ variant: "outline" })}>
            Bekijk de kaart
          </Link>
        </div>
        <button type="button" className="text-sm text-muted-foreground underline underline-offset-4" onClick={() => window.location.reload()}>
          Nog iets melden
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Terug">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Stap {step + 1} van 4</p>
          <p className="truncate text-sm font-medium">{STEP_TITLES[step]}</p>
        </div>
        <Link href="/kaart" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Melding annuleren">
          <X />
        </Link>
      </header>
      <div className="h-1 shrink-0 bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} />
      </div>

      {step === 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid max-w-3xl gap-6 px-4 py-6">
            <div className="grid gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">Wat zie je?</h1>
              <p className="text-muted-foreground">Kies wat het beste past. Je hoeft geen namen of personen te beschrijven.</p>
            </div>
            <EmergencyBar />
            {GROUP_ORDER.map((g) => (
              <section key={g} className="grid gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">{GROUPS[g].name}</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CATEGORIES.filter((c) => c.group === g && c.code !== "OTHER").map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => chooseCategory(c.code)}
                      className="flex min-h-[88px] flex-col items-start gap-2 rounded-xl border p-3 text-left text-sm font-medium transition-colors hover:border-foreground/40 hover:bg-muted/40"
                    >
                      <CategoryIcon code={c.code} size="sm" />
                      {c.name}
                    </button>
                  ))}
                </div>
              </section>
            ))}
            <button
              type="button"
              onClick={() => chooseCategory("OTHER")}
              className="flex items-center gap-3 rounded-xl border border-dashed p-3 text-left text-sm font-medium hover:bg-muted/40"
            >
              <CategoryIcon code="OTHER" size="sm" /> Iets anders in de openbare ruimte
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="relative min-h-0 flex-1">
          <MapView ref={mapRef} className="absolute inset-0" center={center} zoom={15} cluster={false} onMove={(c) => setCenter(c)} userLocation={geo.position} />
          {/* Vaste pin in het midden: schuif de kaart om de plek te kiezen. */}
          <div className="pointer-events-none absolute top-1/2 left-1/2 z-[500] -translate-x-1/2 -translate-y-full">
            <MapPin className="size-10 fill-primary text-primary-foreground drop-shadow-lg" strokeWidth={1.5} />
          </div>
          <div className="absolute inset-x-0 top-0 z-[600] p-3">
            <div className="relative mx-auto max-w-lg">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek een adres of straat" className="bg-background pl-9 shadow-md" aria-label="Zoek een adres" />
              {results.length > 0 && (
                <ul className="absolute inset-x-0 top-11 overflow-hidden rounded-lg border bg-background shadow-lg">
                  {results.map((r) => (
                    <li key={r.label}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setQuery("");
                          setResults([]);
                          mapRef.current?.flyTo(r, 17);
                        }}
                      >
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-[600] p-3">
            <div className="mx-auto grid max-w-lg gap-3 rounded-xl border bg-background p-4 shadow-lg">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{address ?? (locating ? "Locatie ophalen..." : "Gekozen plek op de kaart")}</p>
                  <p className="text-xs text-muted-foreground">Schuif de kaart tot de pin op de juiste plek staat.</p>
                </div>
              </div>
              {geo.error && <p className="text-xs text-amber-700">{geo.error}</p>}
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    const p = await geo.locate();
                    if (p) mapRef.current?.flyTo(p, 17);
                  }}
                  disabled={geo.loading}
                >
                  {geo.loading ? <Loader2 className="animate-spin" /> : <LocateFixed />} Mijn locatie
                </Button>
                <Button onClick={() => setStep(2)}>
                  Deze plek klopt <ArrowRight />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && cat && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid max-w-lg gap-6 px-4 py-6">
            <div className="grid gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">Wil je iets toevoegen?</h1>
              <p className="text-muted-foreground">Alles op deze pagina is optioneel. Je kunt ook direct verder.</p>
            </div>

            <div className="grid gap-2">
              <Label>Foto</Label>
              {photo ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.preview} alt="Gekozen foto" className="max-h-56 w-full rounded-lg border object-cover" />
                  <Button variant="outline" size="sm" className="absolute top-2 right-2 bg-background" onClick={() => setPhoto(null)}>
                    <Trash2 /> Verwijderen
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/40"
                >
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                  {uploading ? "Foto verwerken..." : "Foto maken of kiezen"}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <p className="text-xs text-muted-foreground">Fotografeer de situatie, geen mensen of kentekens. Locatiegegevens in de foto halen we eruit.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="desc">Korte omschrijving</Label>
              <Textarea id="desc" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="Bijvoorbeeld: twee matrassen naast de container" />
              <p className="text-right text-xs text-muted-foreground">{description.length}/300</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="note">Extra informatie voor de beoordelaar</Label>
              <Textarea id="note" value={reviewerNote} maxLength={500} onChange={(e) => setReviewerNote(e.target.value)} placeholder="Alleen zichtbaar voor de dienst die je melding behandelt" className="min-h-16" />
            </div>

            <Alert icon={<Eye />} title={VISIBILITY_LABEL[cat.defaultVisibility].title}>
              {VISIBILITY_LABEL[cat.defaultVisibility].text}
            </Alert>

            {needsAck && (
              <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <Checkbox checked={privacyAck} onChange={(e) => setPrivacyAck(e.target.checked)} className="mt-0.5" />
                Ik heb geen namen, herkenbare gezichten of andere onnodige persoonsgegevens toegevoegd.
              </label>
            )}
            {error && <Alert variant="danger">{error}</Alert>}
            <Button size="lg" onClick={() => setStep(3)} disabled={uploading || (needsAck && !privacyAck)}>
              Verder naar controleren <ArrowRight />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && cat && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid max-w-lg gap-6 px-4 py-6">
            <div className="grid gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">Klopt alles?</h1>
              <p className="text-muted-foreground">Controleer je melding en verstuur hem.</p>
            </div>
            <dl className="divide-y rounded-xl border">
              {[
                { label: "Wat", value: cat.name, edit: 0 as Step, icon: <CategoryIcon code={cat.code} size="sm" /> },
                { label: "Waar", value: address ?? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`, edit: 1 as Step },
                { label: "Omschrijving", value: description.trim() || "Geen", edit: 2 as Step },
                { label: "Foto", value: photo ? "1 foto toegevoegd" : "Geen", edit: 2 as Step },
                { label: "Wie ziet dit", value: VISIBILITY_LABEL[cat.defaultVisibility].title, edit: null },
                { label: "Wie pakt het op", value: cat.owner, edit: null },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 px-4 py-3">
                  <dt className="w-28 shrink-0 text-sm text-muted-foreground">{row.label}</dt>
                  <dd className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                    {row.icon}
                    <span className="truncate">{row.value}</span>
                  </dd>
                  {row.edit !== null && (
                    <button type="button" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setStep(row.edit!)}>
                      Wijzig
                    </button>
                  )}
                </div>
              ))}
            </dl>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button size="lg" onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />} Melding versturen
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Door te versturen ga je akkoord met de <Link href="/privacy" className="underline">spelregels</Link>. Valse meldingen worden verwijderd.
            </p>
          </div>
        </div>
      )}

      <Dialog open={!!acuteFor} onOpenChange={(o) => !o && setAcuteFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Is er nu direct gevaar?</DialogTitle>
            <DialogDescription>
              Bij gevaar voor mensen, brand of een misdrijf dat nu gebeurt: bel direct 112. StraatRadar wordt niet live bekeken door de meldkamer.
            </DialogDescription>
          </DialogHeader>
          <a href="tel:112" className={cn(buttonVariants({ variant: "destructive", size: "lg" }))}>
            <Phone /> Bel 112
          </a>
          <DialogFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setCategory(acuteFor);
                setAcuteFor(null);
                setStep(1);
              }}
            >
              Nee, geen direct gevaar. Ga verder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
