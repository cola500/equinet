---
slug: systeminstellningar
title: Systeminställningar
role: admin
section: System
keywords:
  - system
  - inställningar
  - feature flags
  - flaggor
  - hälsa
  - cron
  - databas
  - e-post
  - toggle
summary: Övervaka systemhälsa och hantera feature flags som styr vilka funktioner som är aktiva på plattformen.
---

Under System ser du:

- Systemhälsa -- databasstatus och svarstid
- Cron-status -- senaste påminnelsekörning

---

## Feature flags

Feature flags styr vilka funktioner som är aktiva. Varje flagga kan slås av och på i realtid.

- Röstloggning -- AI-baserad arbetsloggning
- Ruttplanering -- Ruttplaneringsverktyg
- Rutt-annonser -- Publicera ruttannonser
- Kundinsikter -- AI-genererade kundinsikter
- Besöksplanering -- Återbesöksplanering
- Gruppbokningar -- Gruppbokningsfunktionalitet (under utveckling)
- Affärsinsikter -- Utökad analytics-sida
- Självservice-ombokning -- Kunder kan boka om sina egna bokningar
- Återkommande bokningar -- Möjlighet att skapa återkommande bokningsserier
- Offlineläge -- PWA-stöd med offline-cachning av bokningar och rutter för leverantörer
- Följ leverantör -- Kunder kan följa leverantörer och få personliga ruttannonser
- Besöksplanering (kund) -- Kunder ser servicestatus-badges och kan sätta egna intervall

---

Flaggor kan slås av och på i realtid. Ändringar sparas i Redis och gäller omedelbart.

---

## Utveckling & Test

- E-post-toggle -- stäng av skarp e-postutskick (loggar istället). Användbart under utveckling och testning.
