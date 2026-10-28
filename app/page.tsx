import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CircleCheck,
  EyeOff,
  HelpCircle,
  MapPin,
  MousePointerClick,
  Send,
  ShieldCheck,
  UserX,
  Users,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { EmergencyBar } from "@/components/emergency";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon, StatusBadge } from "@/components/category";
import { CATEGORIES, GROUPS, GROUP_ORDER, CATEGORY_BY_CODE } from "@/lib/categories";
import { read } from "@/lib/server/store";
import { isPubliclyListed, toPublic } from "@/lib/server/reports";
import { isLive } from "@/lib/rules";
import { CITY_NAME } from "@/lib/areas";
import { cn, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function Home() {
  const db = read();
  const now = new Date();
  const live = db.reports.filter((r) => isPubliclyListed(r, now) && isLive(r, now));
  const latest = live.filter((r) => r.visibility === "public").slice(0, 3).map((r) => toPublic(r, db, null, now));
  const resolvedWeek = db.reports.filter(
    (r) => r.resolvedAt && now.getTime() - new Date(r.resolvedAt).getTime() < 7 * 86400_000,
  ).length;

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 md:grid-cols-[1.1fr_1fr] md:pt-20">
          <div className="grid gap-6">
            <Badge variant="outline" className="w-fit gap-1.5 py-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {live.length} actuele signalen in {CITY_NAME}
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              Zie wat er speelt in je straat. Meld het in een paar tikken.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground text-pretty">
              Een kapotte lantaarnpaal, een afvaldump of een plek die onveilig voelt. Met StraatRadar waarschuw je buren en
              ziet de verantwoordelijke dienst het direct.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/melden" className={buttonVariants({ size: "lg" })}>
                Melding maken <ArrowRight />
              </Link>
              <Link href="/kaart" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Bekijk de kaart
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">Geen account nodig. Eerst rondkijken mag altijd.</p>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="text-sm font-medium">Nu in de buurt</p>
              <Link href="/kaart" className="text-sm text-muted-foreground hover:text-foreground">
                Alles bekijken
              </Link>
            </div>
            <ul className="divide-y">
              {latest.map((r) => (
                <li key={r.id}>
                  <Link href={`/kaart?melding=${r.id}`} className="flex gap-3 px-5 py-4 hover:bg-muted/50">
                    <CategoryIcon code={r.category} />
                    <div className="grid min-w-0 flex-1 gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{CATEGORY_BY_CODE[r.category].name}</p>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{r.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.street ?? r.area} · {timeAgo(r.createdAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
              Demo-omgeving met fictieve meldingen.
            </div>
          </Card>
        </section>

        {/* Probleem */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16">
            <div className="grid max-w-2xl gap-3">
              <h2 className="text-3xl font-semibold tracking-tight text-balance">Je ziet het elke dag. Maar wie lost het op?</h2>
              <p className="text-muted-foreground">
                Problemen op straat blijven vaak weken liggen. Niet omdat niemand het ziet, maar omdat melden lastig is en je
                nooit hoort wat er gebeurt.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: HelpCircle, title: "Je weet niet waar je het kwijt kunt", text: "Gemeente, handhaving of wijkagent? Je zoekt een nummer en geeft het op." },
                { icon: Users, title: "Je weet niet of het al gemeld is", text: "Tien buren lopen langs dezelfde kapotte lamp en denken allemaal: iemand anders meldt het wel." },
                { icon: BellRing, title: "Je hoort nooit wat ermee gebeurt", text: "Je meldt iets en daarna blijft het stil. Volgende keer doe je het niet meer." },
              ].map((p) => (
                <Card key={p.title}>
                  <CardContent className="grid gap-2 pt-5">
                    <p.icon className="size-5 text-muted-foreground" />
                    <p className="font-medium">{p.title}</p>
                    <p className="text-sm text-muted-foreground">{p.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Plan */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16">
          <div className="grid max-w-2xl gap-3">
            <h2 className="text-3xl font-semibold tracking-tight">Zo werkt het. Drie stappen.</h2>
            <p className="text-muted-foreground">Een melding maken kost je minder tijd dan een foto delen.</p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              { icon: MousePointerClick, title: "Kies wat je ziet", text: "Tik op een van de vijftien duidelijke categorieën, van afval tot een dier in nood." },
              { icon: MapPin, title: "Bevestig de plek", text: "Je locatie staat al klaar. Klopt het niet? Schuif de kaart of zoek een adres." },
              { icon: Send, title: "Verstuur en volg", text: "Je krijgt een meldingsnummer en ziet live wanneer de dienst het oppakt en oplost." },
            ].map((s, i) => (
              <li key={s.title} className="grid gap-3 rounded-xl border p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <s.icon className="size-4 text-muted-foreground" />
                </div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <div>
            <Link href="/melden" className={buttonVariants({ size: "lg" })}>
              Melding maken <ArrowRight />
            </Link>
          </div>
        </section>

        {/* Gids: empathie en spelregels */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1fr_1.2fr]">
            <div className="grid content-start gap-3">
              <h2 className="text-3xl font-semibold tracking-tight text-balance">Een veilige straat zonder verdachtenlijst.</h2>
              <p className="text-muted-foreground">
                Je wilt dat problemen verdwijnen, niet dat buren elkaar beschuldigen. Daarom gelden er harde spelregels die we
                in de techniek hebben vastgelegd.
              </p>
              <Link href="/privacy" className="text-sm font-medium underline underline-offset-4">
                Lees de privacy en spelregels
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: MapPin, title: "Situaties, nooit personen", text: "Je meldt wat er is en waar. Namen, kentekens en telefoonnummers worden automatisch verwijderd." },
                { icon: UserX, title: "Geen account nodig", text: "Je kunt anoniem kijken en melden. Je naam wordt nooit getoond." },
                { icon: EyeOff, title: "Gevoelig blijft afgeschermd", text: "Hulpvragen en verdachte situaties gaan alleen naar de bevoegde dienst, niet op de openbare kaart." },
                { icon: ShieldCheck, title: "Eén persoon beslist niet", text: "Een melding telt pas als bevestigd als meerdere buren het ook zien." },
              ].map((g) => (
                <div key={g.title} className="grid gap-2 rounded-xl border bg-background p-5">
                  <g.icon className="size-5" />
                  <p className="font-medium">{g.title}</p>
                  <p className="text-sm text-muted-foreground">{g.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Categorieën */}
        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16">
          <div className="grid max-w-2xl gap-3">
            <h2 className="text-3xl font-semibold tracking-tight">Wat kun je melden?</h2>
            <p className="text-muted-foreground">Vijftien situaties in vier groepen. Zo komt je melding direct bij de juiste dienst.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {GROUP_ORDER.map((g) => (
              <Card key={g}>
                <CardContent className="grid gap-3 pt-5">
                  <div>
                    <p className="font-medium">{GROUPS[g].name}</p>
                    <p className="text-sm text-muted-foreground">{GROUPS[g].description}</p>
                  </div>
                  <ul className="grid gap-2">
                    {CATEGORIES.filter((c) => c.group === g).map((c) => (
                      <li key={c.code} className="flex items-center gap-2 text-sm">
                        <CategoryIcon code={c.code} size="sm" />
                        {c.name}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <EmergencyBar />
        </section>

        {/* Succes en inzet */}
        <section className="border-t">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2 md:items-center">
            <div className="grid gap-4">
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                Een straat waar problemen sneller verdwijnen, omdat iedereen meekijkt.
              </h2>
              <ul className="grid gap-3 text-sm">
                {[
                  "Je ziet in één oogopslag wat er speelt voordat je de deur uitgaat.",
                  "Je weet dat je melding bij de juiste dienst ligt en ziet wanneer het is opgelost.",
                  "Terugkerende problemen worden zichtbaar, zodat de gemeente de oorzaak kan aanpakken.",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                Wie niets meldt, houdt de kapotte lamp en de donkere tunnel. Een melding kost je tien seconden.
              </p>
            </div>
            <Card>
              <CardContent className="grid gap-4 pt-6">
                <p className="text-sm text-muted-foreground">Afgelopen 7 dagen in de demo</p>
                <p className="text-4xl font-semibold tracking-tight">{resolvedWeek}</p>
                <p className="text-sm">meldingen opgelost door de verantwoordelijke diensten of bevestigd verdwenen door buren.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link href="/melden" className={cn(buttonVariants(), "flex-1")}>
                    Melding maken
                  </Link>
                  <Link href="/logboek" className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>
                    Bekijk het logboek
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
