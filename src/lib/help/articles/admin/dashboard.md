---
slug: dashboard
title: Dashboard
role: admin
section: Översikt
keywords:
  - dashboard
  - KPI
  - statistik
  - översikt
  - trender
  - intäkter
  - bokningar
  - användare
  - leverantörer
summary: Admin-dashboarden visar KPI-kort, trendgrafer och snabblänkar för att ge en överblick över plattformens status.
---

Admin-panelen nås via /admin och kräver att din användare har admin-behörighet. Sidan är skyddad med både middleware och per-route kontroller.

---

## KPI-kort

Startsidan visar fyra klickbara KPI-kort:

- Användare -- totalt, kunder, leverantörer, nya denna månad
- Bokningar -- totalt, per status (väntande/bekräftade/genomförda/avbokade), genomförda denna månad
- Leverantörer -- totalt, aktiva, verifierade, väntande verifieringar
- Intäkter -- totalt genomfört belopp, belopp denna månad

---

## Trendgrafer

- Bokningar per vecka (senaste 8 veckorna) -- linjediagram med genomförda och avbokade
- Intäkter per månad (senaste 6 månaderna) -- stapeldiagram

---

## Onboarding-checklista

Checklistan visar status för nya leverantörers onboarding:

- Fyll i företagsprofil
- Lägg till minst en tjänst
- Sätt öppettider
- Verifiera e-postadress

---

## Snabblänkar

Snabblänkar till vanliga åtgärder som att skapa ny bokning, lägga till tjänst med mera.
