---
title: "Customer Home — 3 Wireframe Concepts (low-fi)"
description: "Tre lågupplösta wireframe-koncept för en hästledd kundhemvy: A hästcentrerad, B blandad, C action-first. Mobil-ASCII, desktop-notering, styrkor/svagheter/risker och datakrav per koncept."
category: idea
status: draft
last_updated: 2026-06-05
sections:
  - Gemensamma byggstenar
  - Koncept A - Hästcentrerad
  - Koncept B - Blandad
  - Koncept C - Action-first
  - Jämförelse
related:
  - docs/ux/customer-home-implementation-triage-2026-06.md
---

# Customer Home — 3 Wireframe Concepts

> Lågupplösta koncept, mobil-först (~390px). Syftet är att jämföra *struktur och hierarki*, inte visuell
> finish. Alla tre använder samma befintliga data (se Gemensamma byggstenar) — skillnaden är **vad som
> leder** vyn.

## Gemensamma byggstenar (befintlig data/hooks)

| Byggsten | Datakälla (FACT) |
|---|---|
| Hästar (bild, ras, ålder) | `useHorses()` → `/api/horses` |
| Försenat/nästa-due per häst (`overdue`/`upcoming`/`ok`, dagar) | `useDueForService()` → `/api/customer/due-for-service` |
| Nästa/senaste bokning | `useSWR("/api/bookings")` (filtrera per häst för "i kortet") |
| Due-badge | `DueStatusBadge` (extraheras till delad komponent) |
| Tom-läge | `CustomerOnboardingChecklist` (finns) / enkel empty |

Ingen ny endpoint eller datamodell krävs i något koncept.

---

## Koncept A — Hästcentrerad home

Hästkorten **är** hemmet. Varje kort bär sin status + nästa/senaste besök. Inget separat larm-block.

### Mobil
```
┌─────────────────────────────┐
│ Hej Lisa                    │
│                             │
│ ┌─────────────────────────┐ │
│ │ [foto]  Molly           │ │
│ │  Welsh ponny · 8 år     │ │
│ │  🔴 Försenad 5 dgr      │ │
│ │  Senast: Omskoning 2 apr│ │
│ │  Nästa: —               │ │
│ │  [ Boka ]  [ Visa häst ]│ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ [foto]  Storm           │ │
│ │  Sv. varmblod · 12 år   │ │
│ │  🟢 Allt bra            │ │
│ │  Senast: Verkning 1 maj │ │
│ │  Nästa: 9 juni          │ │
│ │  [ Boka ]  [ Visa häst ]│ │
│ └─────────────────────────┘ │
│ + Lägg till häst            │
│ [ Hitta tjänster ]          │
└─────────────────────────────┘
```
**Desktop:** samma kort i 2–3 kolumners grid; ingen toppbanner.
**Styrkor:** renaste matchningen mot mentala modellen ("mina hästar"); status + åtgärd bor där hästen bor;
skalar 1–N hästar; minimal ny komponent (förstärkta hästkort).
**Svagheter:** den mest akuta signalen kan **begravas** om man har många hästar (måste skanna alla kort);
ingen "totalt sett, vad är viktigast nu?".
**Risker:** korten blir tunga (mycket text per kort); "nästa bokning" syns inte samlat; tomt-läge måste bära
hela skärmen.
**Data/hooks:** `useHorses` (primär) + `useDueForService` (status i kort) + `/api/bookings` (nästa/senaste
per häst).

---

## Koncept B — Blandad home (häst-ledd med attention strip)

En smal "behöver uppmärksamhet"-rad överst (det akuta), sedan hästgrid. Hemmet är fortfarande häst-lett.

### Mobil
```
┌─────────────────────────────┐
│ Hej Lisa                    │
│ ┌─────────────────────────┐ │
│ │ ⚠ Behöver uppmärksamhet │ │  ← attention strip
│ │ 🔴 Molly försenad 5 dgr │ │     (overdue + upcoming)
│ │    [ Boka omskoning ]   │ │
│ │ 🟢 Nästa: Storm 9 juni  │ │
│ └─────────────────────────┘ │
│ MINA HÄSTAR                 │
│ ┌─────────┐ ┌─────────┐     │
│ │[foto]   │ │[foto]   │     │  ← kompakt hästgrid
│ │Molly 🔴 │ │Storm 🟢 │     │
│ └─────────┘ └─────────┘     │
│ + Lägg till häst            │
│ [ Hitta hjälp ]             │
└─────────────────────────────┘
```
**Desktop:** attention strip full bredd överst; hästgrid 3–4 kol under.
**Styrkor:** akut signal **överst oavsett antal hästar**, men hemmet är ändå häst-lett; "allt grönt" → strip
visar bara "Nästa: …" = lugn; tydlig väg till boka/hitta.
**Svagheter:** två zoner att designa; risk för **dubblering** (strip + kort visar samma häst) om de inte
hålls komplementära (strip = åtgärd, kort = översikt).
**Risker:** strip kan kännas som "notiser/dashboard" om den blir för lång → cappa till topp 2–3 + "+N till".
**Data/hooks:** `useDueForService` (strip) + `/api/bookings` (nästa) + `useHorses` (grid).

---

## Koncept C — Action-first home

Leder med **vad som behöver göras**, inte med hästarna. Hästöversikt längre ned.

### Mobil
```
┌─────────────────────────────┐
│ Hej Lisa                    │
│ ATT GÖRA                    │
│ ┌─────────────────────────┐ │
│ │ 🔴 Molly behöver         │ │  ← åtgärdskort först
│ │    omskoning (5 dgr sen) │ │
│ │    [ Boka hjälp ]        │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 🟢 Nästa besök           │ │
│ │    Storm · 9 juni        │ │
│ │    [ Visa ]              │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 📋 Följ upp historik     │ │
│ │    2 nya anteckningar    │ │
│ └─────────────────────────┘ │
│ MINA HÄSTAR  (länk →)       │  ← hästar längre ned, kompakt
│ [Molly] [Storm]             │
└─────────────────────────────┘
```
**Desktop:** åtgärdskort i en kolumn/rad överst; hästöversikt som sekundär sektion.
**Styrkor:** snabbast till handling; "att göra"-listan är väldigt tydlig för en stressad ägare; bra när det
finns akuta saker.
**Svagheter:** **svagast hästnära känsla** — leder med uppgifter, inte hästar (risk för "to-do/dashboard"-
känsla, vilket vi vill undvika); när **allt är lugnt** (inga åtgärder) blir toppen tom/tråkig och hästarna —
det egentliga värdet — hamnar långt ned.
**Risker:** "dashboard-känsla" (uttryckligen oönskad); tomt-läge när inget behöver göras; prioriterings­logik
för "att göra" blir mer komplex.
**Data/hooks:** `useDueForService` (åtgärder) + `/api/bookings` (nästa) + ev. notes-signal
(`/api/horses/[id]/notes`) + `useHorses` (sekundär).

---

## Jämförelse (sammanfattning för Claude Design)

| Kriterium | A Hästcentrerad | B Blandad | C Action-first |
|---|:--:|:--:|:--:|
| Matchar "mina hästar = hem" | ★★★ | ★★★ | ★ |
| Akut signal syns direkt | ★ | ★★★ | ★★★ |
| Lugn känsla när allt är bra | ★★★ | ★★★ | ★ |
| Undviker dashboard-känsla | ★★★ | ★★ | ★ |
| Minst att bygga (MVP) | ★★★ | ★★ | ★★ |
| Skalar många hästar | ★★ | ★★★ | ★★ |

> Detta är inte en rekommendation — det är underlaget Claude Design ska väga. (Internt lutar
> [visionen](../../../customer-home-vision-2026-06.md) mot **B**, med **A** som minimal fallback och **C**
> avrådd som hem pga dashboard-känslan — men låt designern göra sin egen bedömning.)
