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
| B1 | Bokningspåminnelser 24h (e-post + in-app, opt-out) | Klart |
| B3 | Affärsinsikter (tjänsteanalys, tidsanalys, kundretention, KPIs) | Klart |
| B4 | No-show-spårning (status, UI, kundregister, insikter) | Klart |

---

## B-kategori -- Medelstor insats

### ~~B1: Bokningspåminnelser~~ (Implementerad 2026-02-17)

Implementerad i session 30. E-postpåminnelser 24h före bokning med checklista, in-app-notifikation, unsubscribe via HMAC-token, opt-out via profil. Cron kör 06:00 UTC dagligen.

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

### ~~B3: Affärsinsikter (utökade)~~ (Implementerad 2026-02-17)

Implementerad i session 32. Ny sida `/provider/insights` med:
- KPI-kort (avbokningsgrad, no-show-grad, snittbokningsvärde, unika kunder, manuella bokningar)
- Populäraste tjänster (horisontell BarChart med intäkt per tjänst)
- Tidsanalys (heatmap: dag x timme)
- Kundretention (LineChart: nya vs återkommande kunder per månad)
- Period-selector (3/6/12 månader)
- Feature flag: `business_insights`

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
Nästa:       B2 (ombokning) -- stor UX-förbättring, kräver migration
Framtida:    C1, C2, C3 -- planera efter feedback
```

---

*Skapad: 2026-02-17, uppdaterad: 2026-02-17 (B1, B3, B4 implementerade)*
