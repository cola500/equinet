---
title: "Design Package — Customer Home 01 (hästledd kundhemvy)"
description: "Självbärande designpaket till Claude Design för hästägarens nya hemvy. Innehåller 3 lågupplösta wireframe-koncept (hästcentrerad / blandad / action-first), befintliga kund-screenshots som referens, och en färdig prompt. Read-only — ingen implementation."
category: idea
status: draft
last_updated: 2026-06-05
sections:
  - Syfte
  - Produktkontext
  - Målgrupp och story
  - Vad ingår
  - Så använder du paketet
  - Frågor Claude Design ska besvara
related:
  - docs/ux/customer-home-vision-2026-06.md
  - docs/ux/customer-home-implementation-triage-2026-06.md
  - docs/ux/customer-demo-discovery-2026-06.md
---

# Design Package — Customer Home 01

Självbärande underlag för en Claude Design-bedömning av **hästägarens nya hemvy**. Vi vill **inte**
implementera ännu — vi vill låta Claude Design väga 2–3 wireframe-koncept för en **hästledd** kundhemvy.

## Syfte

Bestämma vilket hem-koncept som bäst passar en svensk hästägare som loggar in ~1 gång/vecka, innan något
byggs. Paketet är komplett i sig: wireframes + referens-screenshots + en färdig prompt.

## Produktkontext

Equinet är en AI-stödd boknings- och koordineringsplattform för hästtjänster (hovslagare, hästveterinär,
hästterapeut) i Sverige. Svenskt UI. Varumärkeston: praktisk, pålitlig, lugn — inte lekfull eller flashig.
Primärfärg grön (mörk skogsgrön), serif-rubriker (DM Serif Display) över Inter-brödtext, shadcn/ui.

**Vald riktning:** providerns hem = **Kalendern**; kundens hem = **Hästarna**. Idag saknar kunden helt en
hemvy — efter login landar hästägaren på den **publika leverantörssökningen**, vilket är fel mentala modell.

## Målgrupp och story

**Hästägare** (ex. Lisa, 2 hästar: Molly + Storm), lågfrekvent inloggning. Hennes första fråga:

> **"Hur mår mina hästar — behöver jag göra något?"**

Hemmet ska besvara det på under 2 sekunder: är någon häst **försenad** för besök (agera), och när är
**nästa** inbokat (lugn). Boka och sök är handlingar som *följer av* en hästs status — inte hemmet i sig.

## Vad ingår

| Fil | Innehåll |
|---|---|
| `wireframes.md` | 3 lågupplösta koncept (A hästcentrerad · B blandad · C action-first) med mobil-ASCII, desktop-notering, styrkor/svagheter/risker och datakrav |
| `claude-design-prompt.md` | Färdig engelsk prompt — klistra in och bifoga screenshots |
| `screenshots/` | 9 befintliga kund-/publika screenshots som **referens för Equinets visuella språk** (inte förslag) |

### Screenshots (referens — befintligt UI, inte nya förslag)

| # | Fil | Visar |
|---|-----|-------|
| 1 | `screenshots/01-customer-bookings-mobile.png` | Mina bokningar (mobil) — dagens bokningslista |
| 2 | `screenshots/02-customer-horses-mobile.png` | Mina hästar (mobil) — hästkort + due-badge |
| 3 | `screenshots/03-horse-profile-mobile.png` | Hästprofil + vårdhistorik (mobil) |
| 4 | `screenshots/04-customer-bookings-desktop.png` | Mina bokningar (desktop) |
| 5 | `screenshots/05-customer-horses-desktop.png` | Mina hästar (desktop) |
| 6 | `screenshots/06-horse-profile-desktop.png` | Hästprofil + vårdhistorik (desktop) |
| 7 | `screenshots/07-provider-search-mobile.png` | Hitta tjänster / leverantörssök (mobil) |
| 8 | `screenshots/08-provider-profile-mobile.png` | Leverantörsprofil + boka (mobil) |
| 9 | `screenshots/09-horse-share-dialog-mobile.png` | "Dela hästprofil" med veterinär (dialog) |

> Bilderna visar **befintliga ytor** vi vill återanvända data och komponenter från (hästkort, due-badge,
> bokningskort). De är inte hem-förslag — wireframes.md är förslagen.

## Så använder du paketet

1. Öppna `claude-design-prompt.md`, klistra in hela prompten i en Claude Design-session.
2. Bifoga `wireframes.md` (eller klistra in) + de 9 screenshotsen som referens.
3. Be Claude Design välja koncept/hybrid och föreslå en första MVP-slice.

## Frågor Claude Design ska besvara

1. Vilket koncept (A/B/C **eller hybrid**) passar bäst en lågfrekvent svensk hästägare?
2. Vad **måste** synas ovanför folden på mobil?
3. Hur undviker vi "dashboard-känsla" och behåller en lugn, hästnära känsla?
4. Hur hanteras tom data (0 hästar / 0 bokningar) och många hästar?
5. Vilken **första implementation-slice** (minimal) rekommenderas?
6. Vilka screenshots/data behövs innan implementation?

> Bredare underlag (om designern vill borra): [vision](../../../customer-home-vision-2026-06.md),
> [implementation-triage](../../../customer-home-implementation-triage-2026-06.md),
> [discovery](../../../customer-demo-discovery-2026-06.md),
> [full-app-picture](../../../equinet-full-app-picture-2026-06.md).
