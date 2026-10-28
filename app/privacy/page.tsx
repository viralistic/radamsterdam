import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { EmergencyBar } from "@/components/emergency";
import { RETENTION } from "@/lib/server/retention";

export const metadata: Metadata = { title: "Privacy en spelregels" };

const RULES = [
  ["Je meldt situaties, geen personen", "Noem geen namen, kentekens of telefoonnummers. Die halen we automatisch weg uit openbare teksten."],
  ["Geen herkenbare foto's van mensen", "Foto's zijn privé tot een moderator ze heeft goedgekeurd. Locatiegegevens in de foto verwijderen we al op je telefoon."],
  ["Gevoelige meldingen blijven afgeschermd", "Hulpvragen voor iemand die buiten slaapt en verdachte situaties gaan alleen naar de bevoegde dienst. Overlast en een onveilig gevoel tonen we alleen met een globale locatie."],
  ["Eén persoon beslist niet", "Je kunt je eigen melding niet bevestigen. Per persoon telt één stem. Misbruikrapportages gaan naar een moderator."],
  ["Geen gezichtsherkenning", "We identificeren nooit automatisch personen en maken geen verdachtenlijsten."],
  ["Valse meldingen worden verwijderd", "Discriminatie, intimidatie en bewust valse meldingen zijn niet toegestaan."],
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
        <div className="grid gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy en spelregels</h1>
          <p className="text-muted-foreground">
            StraatRadar registreert situaties en plekken in de openbare ruimte. Niet wie er was. Zo blijft de kaart een hulpmiddel voor
            buren en geen openbare verdachtenlijst.
          </p>
        </div>
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">De spelregels</h2>
          <ul className="grid gap-3">
            {RULES.map(([t, d]) => (
              <li key={t} className="rounded-xl border p-4">
                <p className="font-medium">{t}</p>
                <p className="text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Wat we bewaren</h2>
          <div className="overflow-hidden rounded-xl border text-sm">
            {[
              ["Anoniem apparaat-ID", "Om je eigen meldingen te tonen en dubbele stemmen te voorkomen. Geen naam, e-mail of telefoonnummer."],
              ["Locatie van een melding", "Alleen de plek die je zelf bevestigt. We volgen je locatie niet op de achtergrond."],
              ["Foto's", `Privé opgeslagen en na ${RETENTION.mediaDays} dagen verwijderd.`],
              ["Details van meldingen", `Na afronding ${RETENTION.reportDetailDays} dagen, gevoelige meldingen ${RETENTION.sensitiveDetailDays} dagen. Daarna blijven alleen categorie, wijk, tijd en status over.`],
              ["Toegangslogboek professionals", `Wie wat heeft bekeken, gewijzigd of geëxporteerd. ${RETENTION.auditDays / 365} jaar bewaard.`],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 border-b p-4 last:border-0 sm:grid-cols-[200px_1fr]">
                <p className="font-medium">{k}</p>
                <p className="text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Je kunt je gegevens altijd zelf verwijderen via Profiel. Je meldingen blijven dan anoniem staan.</p>
        </section>
        <EmergencyBar />
      </main>
      <SiteFooter />
    </>
  );
}
