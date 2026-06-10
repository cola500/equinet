---
title: "Customer Demo Discovery — hästägare (kund)"
description: "Discovery-underlag för en framtida kunddemo (hästägare). Återanvänder full-app-picture-reviewns owner-kartläggning, identifierar gap mot provider-demon (kund saknar demo-mode och hemvy), och föreslår en Customer Demo MVP (4-6 skärmar), screenshot-paket och första UX-slices. Read-only, ingen implementation."
category: idea
status: draft
last_updated: 2026-06-05
sections:
  - Executive summary
  - Current customer journey
  - Gaps vs provider demo
  - Recommended customer demo flow
  - Screenshot package proposal
  - Open product decisions
  - Recommended first slices
tags:
  - ux
  - demo
  - customer
  - hästägare
  - discovery
related:
  - docs/ux/equinet-full-app-picture-2026-06.md
  - docs/ux/visual-audit/full-app-screenshots/manifest.md
  - docs/ux/provider-demo-ux-audit-2026-05.md
---

# Customer Demo Discovery — hästägare (kund)

> Discovery, inte beslut. Syftet är att skapa underlag för en **framtida kunddemo**
> (hästägare), genom att återanvända det som redan kartlagts i
> [full-app-picture-reviewen](./equinet-full-app-picture-2026-06.md) och låna arbetssättet
> från [provider-demo-UX-auditen](./provider-demo-ux-audit-2026-05.md) (Seven Dimensions-slicing,
> keep/simplify/move/remove, öppna frågor).
>
> **Read-only. Ingen implementation, ingen demo-mode-ändring.** Utgångspunkt:
> **kunden har idag inget demo-läge.** FACT = verifierat i kod/review. INFERENCE = bedömning.

---

## Executive summary

- **Grunden finns redan.** Provider-demon är byggd, trimmad och verifierad. Full-app-picture-reviewen
  kartlade dessutom **hela kund-/owner-sidan** (det som den första provider-auditen hoppade över):
  navigation, sidor, flöden, empty states och 17 captade kund-screenshots. Kunddemon kan därför stå på
  redan dokumenterad mark.
- **Men kunden har inget demo-läge (FACT).** `CustomerNav` släcks i demo (`Header.tsx`-villkoret
  `... && !demo`), demo-login är provider-only, och det finns ingen kund-demo-landning. En kunddemo är
  alltså **greenfield på demo-infrastruktur** (report §4.4).
- **Största strukturella gapet: ingen kund-hemvy (FACT).** Efter login skickas hästägaren via `/dashboard`
  till den **publika leverantörssökningen `/providers`** — inte en personlig start. Den enda
  onboarding-nudgen (`CustomerOnboardingChecklist`) ligger **bara** på `/customer/bookings`, som en ny
  ägare kanske aldrig når (report §6.4, §10 Q1).
- **Kund-värdet är däremot starkt och demobart med Lisas data.** Hitta leverantör → boka utan SMS → se
  bokningar → hästens vårdhistorik → dela med veterinär. Till skillnad från provider-sidans tre
  överlappande boknings­ytor är kund-sidan **naturligt enklare** (låg redundans, report §7.2).
- **Rekommendation:** en **5-skärmars Customer Demo MVP** kring ägarens "lugn i magen"-story
  (vårdhistorik + påminnelser + en-tapp-bokning), förankrad i en **lättviktig kund-hemvy** som fixar
  "landar-på-sök"-gapet.
- **Återanvänd allt som går:** nav-kartorna (§4.3), owner-sidinventeringen (§5.3–5.4), empty-state-katalogen
  (§8), owner-open-questions (§10) och de **17 redan captade kund-screenshotsen** — ingen ny capture krävs
  för själva discoveryn.

---

## 1. Vad kan återanvändas från full-app-picture?

| Tillgång | Var | Återanvändbart för kunddemon |
|---|---|---|
| **Navigation map (kund)** | report §4.3–4.4 | Direkt. Desktop flat-lista + mobil 3 flikar + "Mer"; ingen demo-nav finns idag. |
| **Owner/customer page-inventory** | report §5.3 (+ publika §5.4) | Direkt. 8 kundsidor + publika sök/boka/dela-ytor med syfte, states och flaggor. |
| **Empty states** | report §8 | Direkt. Kund-empties (bokningar, hästar, hästtidslinje, gruppbokningar, hjälp) är **starka** och citerade verbatim. |
| **Key flows (owner)** | report §6.1 (boka), §6.2 (hästprofil + dela) | Direkt. Steg-för-steg + friktion/buggar redan dokumenterade. |
| **Overlap matrix (owner)** | report §7.2 | Direkt. Visar att kund-sidan har **låg** redundans → enklare demo. |
| **Open questions (owner)** | report §10 (Q1, Q3, Q5) | Direkt. Hemvy, två boknings-backends, dela-länk-revoke. |
| **Screenshot inventory (kund)** | [manifest](./visual-audit/full-app-screenshots/manifest.md) | 17 kund-shots (8 desktop + 9 mobil) + publika sök/profil. Ingen re-capture för discovery. |
| **Arbetssätt** | [provider-demo-audit](./provider-demo-ux-audit-2026-05.md) | Seven Dimensions-slicing + keep/simplify/move/remove + screenshot-review-paket-mönstret. |

**Slutsats:** discoveryn behöver inte göra om kartläggningen — den **lutar sig mot** full-app-picture och
fokuserar på det som är *unikt* för en kunddemo (infrastruktur + hemvy + story).

---

## 2. Current customer journey (FACT, ur koden)

```
Register (?role=customer) → /check-email → Login → /dashboard → /providers (publik sök)
                                                         (ingen /customer/dashboard finns)
```

- **Entry/landning:** `/dashboard` (server-redirect) skickar `userType=customer` → **`/providers`**
  (publik leverantörssökning). Ingen personlig hemvy. (report §4.0, §6.4)
- **Navigation (full-läge, INGEN demo-variant):** (report §4.3)
  - Desktop (flat, ingen "Mer"): Hitta tjänster · Mina bokningar · Lediga tider · Gruppbokningar · Mina hästar · Hjälp · Min profil
  - Mobil (3 flikar + Mer): **[Sök][Bokningar][Hästar][Mer]**; Mer = Lediga tider · Gruppbokningar · Hjälp · Min profil (+ Stall, Admin villkorat)
  - Inga badges, **ingen meddelande-post i nav**, samma route får olika label per yta ("Hitta tjänster"/"Sök", "Mina hästar"/"Hästar").
- **Sidor (report §5.3):** `/customer/bookings`, `/customer/horses`, `/customer/horses/[id]` (hästprofil +
  vårdhistorik + dela), `/customer/profile`, `/customer/group-bookings`, `/customer/help`,
  `/customer/export`, `/customer/faq` (→ redirect till help).
- **Publika ytor (report §5.4):** `/providers` (sök), `/providers/[id]` (profil + boka), `/stables`
  (flagga av default), `/profile/[token]` (publik delad hästprofil för veterinär).
- **Boknings­flöde (report §6.1):** `/providers` → `/providers/[id]` → "Boka denna tjänst" →
  dialog (`DesktopBookingDialog`/`MobileBookingFlow`: välj typ → tid → häst → bekräfta) →
  `POST /api/bookings` → `/customer/bookings`. **Två backends:** Fast tid (`/api/bookings`) vs Flexibel
  (`/api/route-orders`).
- **Hästprofil/dela (report §6.2):** `/customer/horses/[id]` (Historik = genomförda bokningar + noteringar)
  → "Dela hästprofil" → 30-dagars token → publik `/profile/[token]`.
- **Feature-flaggor:** `stable_profiles` och `stripe_payments` är **av** default → stall-ytor och
  betala-knapp dolda (bra för en enkel demo).

---

## 3. Gaps vs provider demo

| Dimension | Provider demo (finns) | Customer (saknas) | Källa |
|---|---|---|---|
| **Demo-läge** | `DEMO_ALLOWED_PATHS`, demo-nav (4 flikar), `DemoLoginButton` (Eriks creds), demo-landning `/provider/calendar` | **Inget.** `CustomerNav` släcks i demo; ingen kund-demo-login; ingen kund-demo-landning | report §4.4 |
| **Hemvy/landning** | Landar på Kalender (rik arbetsyta) | Landar på **publik `/providers`-sök** — ingen personlig start; ingen `/customer/dashboard` | report §4.0, §6.4 |
| **Onboarding** | `OnboardingChecklist` på dashboard (syns direkt) | `CustomerOnboardingChecklist` **bara** på `/customer/bookings` (kanske aldrig sedd) | report §6.4 |
| **Seedad persona** | Erik fullseedad + inloggningsbar | **Lisa** finns med data (2 hästar, 4 bokningar) men är en **login-lös "ghost"** — vi satte ett **lokalt** lösenord bara för auditen; finns inte i seed | manifest, audit-noter |
| **Nav-konsistens** | Desktop/mobil enade (efter senaste fix) | Olika labels per yta, ingen demo-tab-uppsättning | report §4.3 |
| **Meddelanden** | Egen flik + badges | Ingen meddelande-post i kund-nav (lever per-bokning) | report §4.3 |

### Vilka data behöver Lisa för en bra demo? (INFERENCE, baserat på sidornas datakällor)

| Yta | Datakrav | Varför |
|---|---|---|
| Mina bokningar | **≥1 kommande bekräftad** + några genomförda | Visa "nästa besök" + historik, inte tom vy |
| Mina hästar | 2 hästar (Molly, Storm) med ras/ålder/bild | Igenkänning + boknings-val |
| Hästprofil → Historik | Genomförda bokningar **+ 2-3 noteringar** (veterinär/hovslagare-kategori) per häst | Vårdhistorik-tidslinjen är differentiatorn (annars "Ingen historik att visa ännu.") |
| Påminnelse-värde | **1 häst "försenad"** (överskridet intervall) | Visa "Equinet säger till i tid"-poängen (om due-for-service exponeras för kund) |
| Dela med veterinär | (live i demon) klicka "Dela hästprofil" | Token genereras live → publik `/profile/[token]` |
| Meddelanden (valfritt) | 1 tråd med Erik om en bokning | Endast om messaging tas med (saknar idag nav-ingång för kund) |

> Lisa har redan 2 hästar + 4 bokningar med Erik i provider-seeden. För en **kund**-demo behöver Lisa bli
> en **seedad, inloggningsbar** kund (inte ghost) och få **populerad vårdhistorik** (noteringar) + minst en
> **kommande** bokning och gärna en **försenad** häst.

---

## 4. Recommended customer demo flow (MVP)

**Story (förslag):** *"Allt om min häst — och boka utan SMS."* Ägarens lugn-i-magen: samlad vårdhistorik,
påminnelser och en-tapp-bokning.

### MVP — 5 skärmar

| # | Skärm | Route | Status | Demo-poäng |
|---|-------|-------|--------|-----------|
| 1 | **Min start** (lättviktig hemvy) | `/customer/...` (NY) *eller* tills vidare `/customer/bookings` som de-facto hem | **saknas/ny** | "Nästa besök + mina hästar + hitta tjänst" — fixar "landar-på-sök"-gapet |
| 2 | **Hitta tjänster** | `/providers` | finns (publik) | Sök hovslagare/veterinär nära dig |
| 3 | **Leverantörsprofil + boka** | `/providers/[id]` → boknings-dialog | finns | **Wow:** boka direkt, inga SMS |
| 4 | **Mina bokningar** | `/customer/bookings` | finns | Bekräftelse + historik (+ påminnelse-känsla) |
| 5 | **Hästprofil + vårdhistorik** | `/customer/horses/[id]` | finns | **Differentiator:** samlad historik + "Dela med veterinär" |

**Valfri 6:e:** `Mina hästar`-listan (`/customer/horses`) som mellansteg, eller `Min profil`.

**Medvetet UTANFÖR MVP:** Gruppbokningar (nisch + "grupprequest"-Swenglish), Lediga tider/announcements,
Stall (flagga av), Export, Meddelanden (saknar kund-nav-ingång — ta bara med om en tråd seedas och nås).

### Keep / Simplify / Move / Remove (för en kunddemo)
- **KEEP:** Hitta tjänster, Leverantörsprofil+boka, Mina bokningar, Hästprofil+historik — bär hela storyn.
- **SIMPLIFY:** boknings­flödet till **en** mental modell (Fast tid) i demon; göm "Flexibel tid"-läget så
  inte två backends förvirrar (report §6.1, §10 Q3).
- **MOVE:** en "Min start"-hemvy framför sök som landning i demo.
- **REMOVE (från demon):** Gruppbokningar, Lediga tider, Stall, Export — ej del av kärnstoryn.

---

## 5. Screenshot package proposal

### Återanvänd (redan captat, full mode — manifest)
Kund (desktop+mobil): `bookings`, `horses`, `horse-profile`, `horse-share-dialog`, `profile`,
`group-bookings`, `help`, `export` (+ mobil `nav-mer-drawer`). Publikt: `providers-search`,
`provider-profile` (desktop+mobil). → **bas för 80% av paketet utan ny capture.**

### Gap att capta (när demo-data/hemvy finns)
- **Min start / kund-hemvy** (ny skärm) — finns ej än.
- **Boknings-dialogen öppen och populerad** (välj tid/häst/bekräfta) — fångades inte i full-app-runan.
- **Hästprofil med populerad vårdhistorik** (Lisas data behöver noteringar först).
- **Publik delad hästprofil `/profile/[token]`** — kräver genererad token (ej captad än).
- Allt ovan i **demo-läge** (när kund-demo-mode finns) för korrekt nav/landning.

### Paket-förslag
Skapa **`docs/ux/visual-audit/review-packages/customer-demo-01/`** som speglar provider-paketet
(`README.md` + `claude-design-prompt.md` + `screenshots/` med 8-12 omdöpta bilder + index-tabell med
"why included"). Bygg det **efter** att demo-data + ev. hemvy finns, annars blir bilderna tomma/missvisande.

---

## 6. Open product decisions

> Flera ärvs direkt från full-app-picture §10; de kund-kritiska samlade här.

1. **Kund-hemvy:** bygga en lättviktig kund-start, eller behålla `/providers` som landning? (report §10 Q1)
   — *Detta är den enskilt största kund-UX-frågan och påverkar onboarding-synlighet.*
2. **Kund-demo-läge:** ska kunden få ett eget demo-mode (CustomerNav i demo + kund-`DemoLoginButton` +
   demo-landning)? — *Kärn-enablern; utan den finns ingen kunddemo.*
3. **Demo-mål (kund):** sälja ägar-värdet (vårdhistorik + boka utan SMS) vs visa bredd? (report §10 Q8)
4. **Två boknings-backends:** ska Fast/Flexibel synas för ägaren i demo, eller en modell? (report §10 Q3)
5. **Meddelanden för kund:** lyfta in i nav eller behålla per-bokning? Avgör om messaging är med i demon.
6. **Påminnelser/due-for-service för kund:** exponera i demon? (Stark demo-poäng — "vi säger till i tid".)
7. **`stable_profiles` / `stripe_payments`:** behålla av i kunddemon? (INFERENCE: ja, enklare.)
8. **Dela-länk revoke:** polera bort/återkalla-gapet innan dela-flödet demas? (report §10 Q5)

---

## 7. Recommended first slices

> Värdeordnat. Slice 1 är **enabler** (utan den finns ingen kunddemo).

| Slice | Leverans | Beroende | Värde |
|---|---|---|---|
| **1 (MVP-enabler) — Customer demo mode + seedad Lisa** | Kund-`DemoLoginButton`, CustomerNav synlig i demo, demo-landning, seedad inloggningsbar Lisa med populerad data (kommande bokning, vårdhistorik, försenad häst) | — | Gör en kunddemo *möjlig* |
| **2 — Customer start page / lightweight home** | En enkel kund-hemvy: nästa bokning + mina hästar + "Hitta tjänster"-CTA; flytta onboarding-nudgen hit | Slice 1 | Fixar "landar-på-sök"-gapet; ger demon en start |
| **3 — Clearer booking journey** | En mental modell i demo (göm Flexibel), inline login-gate istället för toast-redirect, fix av hårdkodade Göteborg-koordinater | Slice 1 | Tar bort huvudfriktionen i wow-momentet |
| **4 — Horse profile polish** | Populerad vårdhistorik, "Dela"-knapp även på häst-listkortet, revoke/lista aktiva dela-länkar | Slice 1 (data) | Stärker differentiatorn + stänger privacy-gap |
| **5 — Customer mobile nav review** | Demo-tab-uppsättning + label-paritet (samma route, samma label desktop/mobil) | Slice 1 | Konsistens (samma typ av fix som provider-nav fick) |
| **6 — Customer screenshot review package** | `review-packages/customer-demo-01/` för Claude Design (speglar provider-demo-01) | Slice 1-2 + data | Underlag för designgranskning |

**Föreslagen MVP-väg:** Slice **1 → 2 → 3** ger en visningsbar kunddemo; Slice 4-6 polerar och paketerar.

---

## Nästa steg

Detta är discovery. Innan implementation: ta **Open product decisions** (särskilt 1 + 2) till ett
produktbeslut, kör ev. Seven Dimensions-refinement på "kund-hemvy"-epiken
([story-refinement.md](../../.claude/rules/story-refinement.md)), och formalisera Slice 1 som backlog-rad.
Ingen kod ändras förrän besluten är tagna.

> Källor: [full-app-picture-2026-06](./equinet-full-app-picture-2026-06.md) (§4.3-4.4, §5.3-5.4, §6, §7.2, §8, §10),
> [screenshot-manifest](./visual-audit/full-app-screenshots/manifest.md),
> [provider-demo-ux-audit-2026-05](./provider-demo-ux-audit-2026-05.md).
