import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, CircleCheck, ClipboardList, Inbox, Lock, Repeat, Route } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Voor gemeenten en handhaving" };

export default function VoorGemeentenPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-4xl gap-6 px-4 pt-16 pb-14 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Zie waar je wijk aandacht nodig heeft. Voordat het een terugkerend probleem wordt.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground text-pretty">
            StraatRadar bundelt signalen van inwoners in één werkomgeving. Je team beoordeelt, wijst toe en sluit af. En je ziet welke plekken
            steeds terugkomen.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/pro/login" className={buttonVariants({ size: "lg" })}>
              Open het demodashboard <ArrowRight />
            </Link>
            <a href="mailto:info@straatradar.demo?subject=Pilot%20StraatRadar" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Plan een pilotgesprek
            </a>
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14">
            <div className="grid max-w-2xl gap-2">
              <h2 className="text-3xl font-semibold tracking-tight">Meldingen komen overal binnen. Behalve op één plek.</h2>
              <p className="text-muted-foreground">
                Telefoon, mail, sociale media en losse apps. Dubbele meldingen, geen locatie en geen overzicht van wat terugkeert. Je team
                reageert op incidenten in plaats van op patronen.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: Inbox, t: "Eén wachtrij", d: "Alleen de categorieën waarvoor je organisatie bevoegd is. Prioriteit en reactietermijnen per categorie." },
                { icon: ClipboardList, t: "Volledig dossier", d: "Bevestigingen, correcties, interne notities, statusgeschiedenis en een auditlog per melding." },
                { icon: Repeat, t: "Terugkerende plekken", d: "Hotspots per wijk, weekdag en tijdvak. Kleine aantallen worden onderdrukt om personen te beschermen." },
              ].map((f) => (
                <Card key={f.t}>
                  <CardContent className="grid gap-2 pt-5">
                    <f.icon className="size-5" />
                    <p className="font-medium">{f.t}</p>
                    <p className="text-sm text-muted-foreground">{f.d}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2">
          <div className="grid content-start gap-3">
            <h2 className="text-3xl font-semibold tracking-tight">Zo start je een pilot</h2>
            <ol className="grid gap-4">
              {[
                ["Kies één wijk en drie maanden", "We richten categorieën, routering en reactietermijnen in met je team."],
                ["Werk vanuit de wachtrij", "Medewerkers beoordelen, wijzen toe en sluiten af. Inwoners zien de status live."],
                ["Meet wat het oplevert", "Tijd tot beoordeling, aandeel opgepakt door de juiste dienst, dubbele meldingen en ervaren veiligheid."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="text-sm text-muted-foreground">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <Card>
            <CardContent className="grid gap-3 pt-6 text-sm">
              <p className="font-medium">Verantwoord vanaf dag één</p>
              {[
                [Lock, "Rolgebonden toegang met MFA. Een gemeentelijke licentie geeft geen toegang tot politiegegevens."],
                [BarChart3, "Rapportages met vaste definities en perioden. Elke export wordt gelogd."],
                [Route, "Geen automatische inzet. Meldingsvolume is geen criminaliteitscijfer en een mens beslist altijd."],
                [CircleCheck, "Bewaartermijnen per gegevenstype en anonimisering na afronding."],
              ].map(([Icon, t], i) => {
                const I = Icon as typeof Lock;
                return (
                  <p key={i} className="flex gap-2">
                    <I className="mt-0.5 size-4 shrink-0" /> {t as string}
                  </p>
                );
              })}
            </CardContent>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
