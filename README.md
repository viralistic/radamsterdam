# StraatRadar

Een real-time signaleringskaart voor de openbare ruimte. Inwoners waarschuwen elkaar voor afval, kapotte verlichting, onveilige plekken en obstakels. Gemeente, handhaving en (in een pilot) politie krijgen een werkomgeving om meldingen op te volgen en terugkerende plekken te herkennen.

Uitgangspunt: **de app registreert situaties en locaties, nooit vermoedelijk schuldige personen.**

## Snel starten

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. De demo maakt bij de eerste start fictieve meldingen aan in `.data/`. Opnieuw beginnen met verse demodata: `npm run seed:reset`.

| Wat | Waar |
| --- | --- |
| Startpagina voor inwoners | `/` |
| Live kaart | `/kaart` |
| Melding maken | `/melden` |
| Logboek en historie per wijk | `/logboek` |
| Mijn meldingen, profiel | `/mijn-meldingen`, `/profiel` |
| Pagina voor gemeenten | `/voor-gemeenten` |
| Professioneel dashboard | `/pro/login` |

### Demo-accounts voor het dashboard

Wachtwoord `straatradar`, MFA-code `246810`. Het inlogscherm toont alle accounts.

| Account | Rol | Ziet |
| --- | --- | --- |
| `sanne@gemeente.demo` | Medewerker gemeente | Wachtrij en dossiers van gemeentelijke categorieën |
| `joris@gemeente.demo` | Teamleider | Idem, plus bulkacties en CSV-export |
| `mila@handhaving.demo` | Medewerker handhaving | Geluid, overlast, brandgevaar, drugs |
| `kees@politie.demo` | Medewerker politie | Alleen veiligheidscategorieën van de pilot |
| `noor@outreach.demo` | Outreachteam | Hulpvragen voor mensen die buiten slapen |
| `fatima@gemeente.demo` | Analist | Alleen geaggregeerde rapportages, geen dossiers |
| `ruben@straatradar.demo` | Moderator | Misbruikrapportages en foto's |
| `lotte@gemeente.demo` | Beheerder organisatie | Gebruikers, instellingen, auditlog |
| `admin@straatradar.demo` | Platformbeheer | Platform, zonder inhoudelijke dossiers |

## Wat er in zit

**Inwoners**
- Live kaart met clusters, filters per groep, alleen bevestigd, alleen recent, eigen locatie en een lijst van wat in beeld is.
- Melden in vier stappen: categorie, locatie (verschuifbare kaart, adres zoeken via PDOK), optioneel foto en toelichting, controleren. Bij veiligheidscategorieën eerst de 112-check.
- Bevestigen (nog aanwezig of weg), corrigeren (locatie, categorie, dubbel) en misbruik rapporteren.
- Logboek met filters en historie per wijk, Mijn meldingen met status, profiel met gevolgde gebieden, meldingsvoorkeuren en gegevens verwijderen.
- Geen account nodig: een anoniem, ondertekend apparaat-ID.

**Professionals**
- Inloggen met wachtwoord en MFA, sessies van 8 uur.
- Overzicht met KPI's die altijd een periode en definitie tonen.
- Wachtrij met filters, prioriteit, reactietermijnen en bulkacties (nooit voor gevoelige meldingen).
- Dossier: oorspronkelijke tekst, publieke weergave, tijdlijn met interne notities, oppakken, toewijzen, doorzetten naar een andere organisatie, afsluiten met reden, heropenen, dubbele meldingen koppelen, moderatie van foto's en rapportages.
- Hotspots per vak van circa 250 meter, per weekdag en tijdvak, met trend en onderdrukking van kleine aantallen.
- Rapportages per categorie en wijk, CSV-export zonder persoonsgegevens.
- Gebruikers en rollen, auditlog, instellingen per categorie (geldigheid, zichtbaarheid, routering).

## Regels in de code

Alle regels staan server-side. De interface verbergt knoppen, maar de API beslist.

- **Statussen** (`lib/rules.ts`): vers, bevestigd (2 onafhankelijke buren, melder telt niet), in behandeling, opgelost, verlopen, ingetrokken, in beoordeling. Eén stem per persoon.
- **Verlopen** per categorie, van 2 uur (verdachte situatie) tot actueel tot opgelost (verlichting), met een maximum van 30 dagen zonder bevestiging. Een verlopen veiligheidsmelding toont expliciet dat dit niet betekent dat het veilig is.
- **Buren lossen op** met 3 stemmen "weg" na de laatste bevestiging, behalve bij veiligheid en hulp: daar beslist alleen de dienst.
- **Misbruik**: 3 rapportages verbergen een melding tot een moderator beslist.
- **Zichtbaarheid** (`lib/categories.ts`): openbaar, openbaar met afgeronde locatie (circa 150 meter) en neutrale tekst, of alleen voor de bevoegde dienst (verdachte situatie, iemand slaapt buiten).
- **Privacy**: e-mail, telefoonnummers en kentekens worden uit publieke tekst gehaald, huisnummers worden niet getoond, foto's worden in de browser opnieuw gecodeerd (geen EXIF of GPS), zijn privé en alleen via tijdelijk ondertekende links bereikbaar, en worden pas na moderatie publiek.
- **Toegang** (`lib/roles.ts`, `lib/server/reports.ts`): least privilege per rol en per organisatie. Inzage in gevoelige dossiers, wijzigingen en exports gaan naar het auditlog.
- **Bewaartermijnen** (`lib/server/retention.ts`): foto's 90 dagen, details 365 dagen (gevoelig 90), identiteit bij bevestigingen 365 dagen, auditlog 2 jaar.
- **Geen automatische inzet**: hotspots zijn een hulpmiddel. De interface zegt expliciet dat meldingsvolume geen criminaliteitscijfer is.

## Architectuur

```
app/            Next.js App Router: pagina's en API-routes (app/api)
components/     UI in shadcn-stijl, kaart (Leaflet + markercluster), inwoner- en pro-onderdelen
lib/            Domeinlogica die client en server delen: categorieën, regels, rollen, typen
lib/server/     Opslag, authenticatie, autorisatie, analyses, bewaartermijnen, demodata
db/schema.sql   Productieschema voor PostgreSQL + PostGIS
tests/          Vitest: statusregels, privacy, toegang, hotspots
```

- **Live updates**: Server-Sent Events op `/api/stream`, met polling als terugval.
- **Opslag in de demo**: een JSON-bestand en een mediamap in `DATA_DIR` (standaard `.data/`). Prima voor een demo of klikbaar prototype, niet voor productie met meerdere servers.
- **Kaart**: CARTO Positron-tegels op OpenStreetMap. Adres zoeken via de PDOK Locatieserver.

### API

| Methode | Endpoint | Functie |
| --- | --- | --- |
| GET | `/api/reports?scope=live\|log` | Meldingen zoeken en filteren |
| POST | `/api/reports` | Melding maken |
| GET, DELETE | `/api/reports/:id` | Melding ophalen, eigen melding intrekken |
| POST | `/api/reports/:id/confirmations` | Bevestigen of corrigeren |
| POST | `/api/reports/:id/flags` | Misbruik rapporteren |
| GET | `/api/areas/history` | Geaggregeerde historie van een wijk |
| GET, DELETE | `/api/me` | Eigen meldingen, gegevens verwijderen |
| PUT | `/api/me/preferences` | Gebieden en meldingsvoorkeuren |
| POST, GET | `/api/media`, `/api/media/:id` | Foto uploaden, ondertekend ophalen |
| POST, DELETE | `/api/pro/session`, `/api/pro/session/mfa` | Inloggen met MFA, uitloggen |
| GET, PATCH | `/api/pro/reports` | Wachtrij, bulkacties |
| GET, PATCH | `/api/pro/reports/:id` | Dossier, alle acties op een melding |
| GET | `/api/pro/analytics/summary\|hotspots\|report` | Overzicht, hotspots, rapportages |
| GET | `/api/pro/export` | CSV-export (gelogd) |
| GET | `/api/pro/audit` | Auditlog |
| GET, POST, PATCH | `/api/pro/users` | Gebruikers en rollen |
| GET, PUT | `/api/pro/settings` | Instellingen |

## Checks

```bash
npm run lint    # TypeScript
npm test        # Vitest
npm run build   # Productiebuild
```

## Naar productie

Deze versie is een werkend MVP voor fase 1 en 2 uit het conceptplan. Voor een echte pilot:

1. Vervang `lib/server/store.ts` door een repository op `db/schema.sql` (PostgreSQL + PostGIS) en verplaats foto's naar private object storage.
2. Vervang de demo-login door een identiteitsprovider (OIDC) met echte MFA. Zet `STRAATRADAR_DEMO=false` en een sterke `SESSION_SECRET`.
3. Verplaats rate limiting naar Redis of de API-gateway en live updates naar een gedeelde realtime service.
4. Voeg pushberichten toe via de mobiele app (Expo, APNs, FCM). De voorkeuren worden nu al opgeslagen.
5. Bepaal met de deelnemende organisaties de verwerkingsverantwoordelijke, de grondslag en de bewaartermijnen, en voer een DPIA uit.
6. Politiekoppelingen en routevoorstellen (fase 3) pas met een pilotpartner en een juridische grondslag.

Alle meldingen, adressen en personen in de demo zijn fictief.
