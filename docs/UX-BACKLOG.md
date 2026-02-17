# UX-förbättringar -- Backlog

> Idéer från UX-analys 2026-02-17, jämförelse mot branschledande bokningsappar (Booksy, Acuity, Calendly).
> A-kategori implementerades i session 30. B- och C-kategori sparas här för framtida implementation.

---

## Implementerat

| # | Feature | Status |
|---|---------|--------|
| A1 | Dashboard-trendgrafer (bokningar/vecka + intäkter/månad) | Klart |
| A2 | Kund-onboarding-checklista (4 steg) | Klart |
| A3 | Delad EmptyState-komponent (4 vyer) | Klart |
| A4 | Förbättrade Quick Actions + klickbara KPI-kort | Klart |
| B4 | No-show-spårning (status, UI, kundregister, insikter) | Klart |

---

## B-kategori -- Medelstor insats

### B1: Bokningspåminnelser

**Problem:** Kunder glömmer bokningar, vilket leder till no-shows och förlorad intäkt.

**Lösning:** Automatiska påminnelser 24h och 1h före besök via e-post (och eventuellt SMS).

**Branschdata:**
- Booksy rapporterar 20% färre avbokningar med påminnelser
- Branschsnittet visar upp till 80% reduktion av no-shows med automatiska påminnelser

**Insats:** Medel -- kräver schemalagd job (cron/Vercel Cron), e-postmallar, opt-out-inställning.

**Beroenden:** E-postsystem måste vara aktiverat i produktion.

---

### B2: Självservice-ombokning

**Problem:** Kunder som vill boka om måste kontakta leverantören manuellt. Tar tid för båda parter.

**Lösning:** Kunder kan boka om sin bokning direkt i appen -- välj ny tid från leverantörens tillgängliga tider.

**Regler:**
- Ombokning tillåts upp till X timmar innan (konfigurerbart per leverantör)
- Leverantören kan välja att godkänna ombokning eller låta den ske direkt
- Max antal ombokningar per bokning (t.ex. 2)

**Insats:** Medel -- ny UI-vy, API-endpoint, bokningshistorik-spårning.

---

### B3: Affärsinsikter (utökade)

**Problem:** Leverantörer ser bara grundläggande siffror. Saknar insikt i trender, populära tjänster och kundmönster.

**Lösning:** Utökad analytics-sida med:
- Populäraste tjänster (bokningsfrekvens per tjänst)
- Bästa tider/dagar (heatmap över bokningar)
- Kundretention (andel återkommande kunder)
- Intäktsprognos baserat på bokade jobb

**Insats:** Medel-Stor -- kräver aggregerings-queries, nya UI-komponenter, eventuellt caching.

**Not:** Dashboard-graferna (A1) ger en grundnivå. B3 bygger vidare med djupare analys.

---

### ~~B4: No-show-spårning~~ (Implementerad 2026-02-17)

Implementerad i session 31. 27 filer, 1815 tester. Inkluderar:
- `no_show`-status i state machine (confirmed -> no_show, terminal)
- "Ej infunnit"-knapp i bokningslista + kalendervy
- Orange badge per kund i kundregistret (varning vid 2+)
- No-show-data i AI-kundinsikter
- Rate limiting tillagd i bookings/[id] (pre-existing fix)

---

## C-kategori -- Större insats

### C1: Återkommande bokningar

**Problem:** Kunder med regelbundna besök (t.ex. hovvård var 6:e vecka) måste manuellt boka varje gång.

**Lösning:**
- Skapa en "serie" -- välj intervall (varje X veckor/månader), antal tillfällen
- Automatisk generering av bokningar i leverantörens kalender
- Möjlighet att avboka enskilda tillfällen utan att avbryta serien

**Insats:** Stor -- ny datamodell (BookingSeries), schemalagd generering, komplex avbokning/ombokning-logik.

**Beroenden:** B2 (ombokning) bör finnas först.

---

### C2: Väntlista

**Problem:** När alla tider är bokade har kunden inget sätt att visa intresse. Leverantören missar potentiella bokningar.

**Lösning:**
- "Ställ dig i kö"-knapp på fullbokade tider
- Automatisk notifiering när en tid blir ledig
- Leverantören ser väntlistans storlek per tidsslot

**Insats:** Stor -- ny datamodell (WaitlistEntry), event-driven notifiering vid avbokning, race condition-hantering.

---

### C3: Kalendersynk

**Problem:** Leverantörer och kunder har sina bokningar på ett ställe (Equinet) men resten av sitt schema i Google Calendar/Outlook.

**Lösning:**
- Export: iCal-feed (URL som kan prenumereras på)
- Import: Läs leverantörens externa kalender och blockera tider automatiskt (tvåvägssynk)

**Insats:** Stor -- iCal-generering (enklare), OAuth + API-integration för tvåvägssynk (komplex).

**Rekommendation:** Börja med envägs iCal-export (1-2 dagars arbete). Tvåvägssynk i senare fas.

---

## Prioriteringsförslag

```
Nästa:       B1 (påminnelser) -- störst impact på no-shows
Sedan:       B3 (affärsinsikter) -- bygger på A1-graferna
Sedan:       B2 (ombokning) -- stor UX-förbättring, kräver migration
Framtida:    C1, C2, C3 -- planera efter feedback
```

---

*Skapad: 2026-02-17, uppdaterad: 2026-02-17 (B4 implementerad)*
