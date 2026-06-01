---
title: "Provider Demo Visual UX Review"
description: "Claude Design visuell UX-review av leverantörsdemon i staging — screen-by-screen-observationer, top-5-risker, navigationsförenkling och rekommenderade slices."
category: guide
status: draft
last_updated: 2026-06-01
sections:
  - Screen-by-screen visual observations
  - Top 5 visual UX risks (ranked)
  - Recommended navigation simplification
  - Recommended first 3 UX slices
  - Quick wins vs larger redesign
  - Explicit answers
related:
  - docs/ux/visual-audit/provider-demo/claude-design-briefing-2026-06-01.md
  - docs/ux/visual-audit/provider-demo/implementation-triage-2026-06-01.md
---

# Equinet — Provider Demo Visual UX Review

*Senior product-design review of the provider-facing demo (staging), logged in as Erik Järnfot, farrier. Desktop 1440×900, mobile 390×844, Swedish UI. Brand: green, calm, practical, trustworthy. Brief: small slices, no full redesign, demo clarity, mobile matters.*

*Read assuming the populated case: the empty Dashboard counters and the empty 1 June calendar week are a **data** problem (all seeded bookings are in the past), not a layout problem. I assess structure as if upcoming bookings existed — and call out separately the few places where the emptiness itself is the risk.*

---

## 1. Screen-by-screen visual observations

### 1. Översikt / Dashboard (desktop + mobile)
- **Layout:** Clean, conventional, on-brand. Big "Välkommen tillbaka!", a row of three stat cards, a collapsible statistics block (two charts), and a "Snabblänkar" row. Spacing and card styling are calm and trustworthy — this part is genuinely polished.
- **Hierarchy problem:** The three biggest objects on the page are **"5", "0", "0"**. With no upcoming bookings the page's entire visual weight lands on two zeros. The eye reads *nothing is happening here* before it reads anything else. On mobile this is worse — each stat card is nearly a full screen tall, so the first two scrolls are giant zeros.
- **The two charts actively hurt.** "Bokningar per vecka" draws a **red line** that bumps to 1 and falls back to zero — red reads as alarm/loss, and it's the most saturated thing on the page. "Intäkter per månad" renders as an **empty grid with a flat baseline and no plotted data** — it looks broken, not empty. A viewer can't tell "no data yet" from "the chart failed to load."
- **Redundancy:** "Kommande bokningar" and "Nya förfrågningar" counters here are the *same* numbers shown on Bokningar and reachable in Kalender. The "Snabblänkar" row (Se bokningar · Kalender · Kundregister) is a third nav for things already in the top nav.
- **Net:** structurally fine, but in demo state it's a wall of zeros and one alarming red line. Lowest signal-to-space ratio of any screen.

### 2. Kalender / Calendar — week view (desktop + mobile)
- **Strongest workspace in principle, weakest render in practice.** "Vecka" is selected but the view shows **a single day column** (mån 1 juni, 07:00–16:00), framed by a **thick green border around the whole column** that reads as one giant selected event rather than an empty day. A first-time viewer sees a big green box, not "my week."
- The persistent tip banner ("Tryck direkt i kalendern för att skapa en bokning · OK") sits between the date and the grid, pushing the actual calendar down and adding chrome to an already-empty surface.
- View switcher (Dag / 3 dagar / Vecka / grid) and **+ Bokning** are clear and well-placed. The red "now" line at 17:00 is a nice touch.
- **Mobile:** the floating green **"Logga arbete" mic FAB** overlaps the grid and competes with + Bokning for "primary action" — two floating-ish actions, unclear which is primary.
- **Verdict:** the layout *potential* is real (this is where time, availability and manual booking live), but the current week-view-that-looks-like-one-day plus the empty week means it cannot currently carry a demo. It needs (a) future bookings and (b) a week that actually shows 7 columns.

### 3. Bokningar / Bookings — list (desktop + mobile)
- **The most functional screen, and the densest.** Status filter pills (Alla 18 · Väntar 0 · Bekräftade 8 · Genomförda 10 · Ej infunna 0 · Avbokade 2) are excellent — instant, scannable, the single clearest "filter my work" affordance in the app.
- **But the desktop page is an enormous vertical scroll** — 18 tall cards, each repeating Bokningsdetaljer / Kundinformation / Diskussionsregister / action row. The full-width single column wastes the 1440px canvas and makes the page feel endless. This is the screen that most reads "admin app," exactly the perception the IA audit warns about.
- Each card carries three action buttons (Markera som genomförd · Ej infunnit · Avboka) plus customer email/phone — good for work, heavy for a demo overview.
- **Mobile:** filter pills wrap to three rows (acceptable), but the mic FAB overlaps the first card's "Logga arbete" action, and the card is tall enough that one booking ≈ one screen.
- **Verdict:** great as a *filtered list*, redundant as a *primary tab* — it shows the same bookings the calendar would, with none of the calendar's spatial/time value.

### 4. Kunder / Customers (desktop)
- **Quietly the best-executed screen.** Search field + Alla/Aktiva/Inaktiva filter, then a calm list of customer rows: avatar, name, email, booking count, "Senast" date, a horse-count chip (1 häst / 2 hästar), chevron. Clear hierarchy, good density, on-brand, trustworthy. "Lägg till kund" is correctly placed top-right.
- Minor: rows are quite tall with a lot of internal whitespace — could show ~30% more per screen — but this is polish, not a problem.
- **Verdict:** demo-ready as-is. Shows the "repeat-customer / horse history" value cleanly.

### 5. Mina tjänster / Services (desktop)
- **On-brand and clean.** Card grid, each service with name, "Aktiv" badge, description, Pris / Varaktighet / Återbesök, and a Redigera button. "Lägg till tjänst" top-right.
- Minor inconsistency: cards with only two attributes (Hovslagarbedömning, Akutbesök) leave the Redigera button floating higher than the three-attribute cards, so the bottom edge is ragged. A consistent card min-height would tidy this.
- **Verdict:** solid, demo-ready. This is the foundation screen (no services → no bookings) and it looks the part.

### 6. Insikter / Insights (desktop)
- **The richest, most "product-mature" screen — and it's hidden in "Mer" on desktop.** Six metric cards (Total intäkt 11 300 kr, Avbokningsgrad 10 %, No-show-grad 0 %, Snittbokningsvärde 1 130 kr, Unika kunder 9, Manuella bokningar 5 %), a popular-services bar chart, a day×time heatmap, and a new-vs-returning retention line chart. With real history it's genuinely impressive.
- Tension: this is the surface that most "sells the product," yet desktop buries it under Mer while mobile promotes it to a primary tab. The placement is exactly inverted from its demo value.
- Minor: the heatmap and the 6-card row are information-dense; fine for an analytics page, but it's the highest cognitive load in the app — appropriate here, not elsewhere.
- **Verdict:** strong. The issue is *placement*, not design.

### 7. Meddelanden / Messages (desktop)
- **Lowest polish, two trust problems.** (1) The content is **centered in a narrow column with a vast empty right two-thirds** of the screen — it looks unfinished/unstyled next to every other full-width screen. (2) A message preview literally reads **"Du: 3B.2 smoke-test"** — a QA/test string leaking into the demo. That single line will undermine trust faster than any layout issue; a viewer reads it as "this is a half-built test environment."
- **Verdict:** the test-data string is a must-fix before any demo. The centered-column layout is a quick polish fix (left-align or two-pane).

### 8 & 9. "Mer" menu (desktop dropdown + mobile drawer)
- Desktop dropdown (MITT FÖRETAG → Insikter · Hjälp · Min profil) is clean and correct.
- **Mobile is the clearest "developer-built" signal in the whole demo:** the bottom tab bar carries **8 items** (Översikt · Kalender · Bokningar · Kunder · Meddelanden · Insikter · Tjänster · Mer) crammed edge-to-edge with tiny ~9px labels — "Meddelanden" and "Bokningar" are barely legible and the touch targets are well under the comfortable 44px. This is the single most important visual fix for a mobile-first audience.

---

## 2. Top 5 visual UX risks (ranked)

1. **Mobile bottom tab bar is overloaded (8 tabs).** Tiny labels, sub-44px targets, "developer-built" read on the exact device the audience uses. Highest-impact, highest-visibility, and the audience is mobile-first. **#1 by a clear margin.**
2. **Test/placeholder data on screen ("3B.2 smoke-test" in Messages).** A demo lives or dies on trust; a visible QA string says "unfinished." Cheap to fix, disproportionate damage if not.
3. **Dashboard reads as a wall of zeros + one alarming red line, and the revenue chart looks broken.** The intended "home" makes the strongest negative first impression. Risk is amplified because it's the current start page.
4. **Triple redundancy of bookings (Översikt + Bokningar + Kalender) reads as "complex admin," not "makes my job easier."** Same counters, same bookings, three places — the core IA risk, and it's visible the moment you click between the first three tabs.
5. **Calendar week view renders as a single bordered column.** The surface meant to be the hero looks empty and almost single-day, so its strength is invisible in the demo. (Partly data, partly the thick full-column green border.)

---

## 3. Recommended navigation simplification

Principle: **one primary place to *do the work* (Calendar), one to *see everything* (Bookings, demoted), and supporting surfaces in "Mer."** Same set everywhere — kill the desktop↔mobile inconsistency.

### Desktop — primary nav (5, down from 6 + Mer)
```
Kalender · Bokningar · Kunder · Mina tjänster · Meddelanden        [ Mer ▾ ]
```
- **Kalender first** (it becomes the workspace; see Q-A).
- **Mer ▾** contains: Översikt (as a slim summary) · Insikter · Hjälp · Min profil.
- Insikter stays in Mer on desktop **but gets a clear entry point** from the slim Översikt summary (it's the sell — link to it, don't bury it silently).

### Mobile — bottom tab bar (4 + Mer, down from 8)
```
┌──────────────────────────────────────────────┐
│  Kalender   Bokningar   Kunder   Meddelanden   ⋯ Mer │
│    [▦]         [▤]        [👤]       [💬]      [···] │
└──────────────────────────────────────────────┘
```
- Four legible tabs at ≥44px + Mer. This alone removes the strongest "developer-built" signal.
- **Mer drawer (mobile)** holds, grouped: *Hem* → Översikt (slim) · Insikter · Mina tjänster · Hjälp · Min profil.
- Note the deliberate change: **Tjänster and Insikter leave the mobile primary row** (they're setup/analysis, not daily work) and **Översikt leaves the primary row entirely**. This resolves the documented desktop/mobile inconsistency by making mobile a strict subset of one shared model.

### Why this set
Daily provider work on a phone in a stable is: *what's my day (Kalender), what's the full list (Bokningar), who is this (Kunder), what did they say (Meddelanden).* Everything else is setup (Tjänster), analysis (Insikter), or account (Profil/Hjälp) — correctly one tap deeper.

---

## 4. Recommended first 3 UX slices (small, independent, value-ordered)

**Slice 1 — Trim the mobile tab bar to 4 + Mer, and unify desktop/mobile nav.**
Pure config/IA change in the nav components, no new screens. Removes the #1 and #4 risks (overloaded bar + inconsistency) and is the most visible quality jump for a mobile-first audience. Highest value, lowest effort, no data dependency. **Do this first.**

**Slice 2 — Make Calendar the start page + demote Bookings; slim Översikt into a summary in "Mer."**
Land the provider in "here's my week" instead of a wall of zeros. Bookings stays full-featured but moves to a secondary list. Slim Översikt to: priority action + 2–3 KPIs + a clear "Öppna kalendern" / "Se insikter" link. Directly addresses the core redundancy risk (#4) and the zero-wall risk (#3). Depends on Slice 1 being in place so Calendar genuinely carries the load. **(Requires seeding future bookings — see note below.)**

**Slice 3 — Trust & empty-state pass (cheap, high-credibility).**
Three small fixes that punch above their cost: (a) purge test strings like "3B.2 smoke-test" from demo data; (b) give Insikter and Bokningar a real "så här blir det med data" empty state (match the quality of the Tjänster empty state); (c) fix the empty revenue chart so "no data" reads as *intentional* ("Ingen intäkt än för perioden") rather than broken. Removes risk #2 and de-fangs the empty surfaces.

> **Hard dependency for the demo to work at all:** seed **future-dated bookings**. Slices 2–3 assume Calendar and Dashboard are populated. Without upcoming bookings the hero surface stays empty regardless of layout — this is the prerequisite, not a slice.

---

## 5. Quick wins vs larger redesign

### Quick wins (hours, no architecture change, low risk)
- **Purge test/QA strings** from demo seed data ("3B.2 smoke-test"). *(Trust, #2.)*
- **Recolor the dashboard chart:** make "completed" the dominant on-brand green and de-emphasize cancellations; never let red be the loudest mark on the home page. *(#3.)*
- **Empty-chart copy:** replace the flat empty revenue grid with "Ingen intäkt registrerad för perioden" so it reads intentional. *(#3.)*
- **Dismiss/auto-hide the Calendar tip banner** after first use so it stops adding chrome to an empty surface.
- **Resolve the mic "Logga arbete" FAB overlap** on Calendar/Bookings mobile (offset above the bottom bar; pick one primary action per screen).
- **Consistent Service card min-height** so the Redigera buttons align. *(Polish, #5/services.)*
- **Left-align or constrain the Messages layout** so it doesn't read as an unfinished centered column. *(#7.)*

### Medium (a few hours, local, some component work)
- **Mobile tab bar 8 → 4 + Mer** and unify with desktop. *(Slice 1.)*
- **Calendar week view that shows 7 columns** and renders an empty day as faint guides, not a thick green full-column border. *(#5.)*
- **Slim Översikt** into a summary strip; remove duplicated counters. *(Slice 2.)*
- **Real empty states** for Bokningar and Insikter. *(Slice 3b.)*

### Larger redesign ideas (defer — out of scope for demo slices)
- Reposition Insikter as a first-class "business health" surface with a dashboard-style entry (it's your best sell, currently buried).
- Merge Översikt fully into Calendar (start = week + a collapsible summary header), retiring the dashboard as a standalone tab. *Bigger IA bet — validate Slice 2 first.*
- A genuine two-pane Messages (list + thread) instead of a card stack.

---

## 6. Explicit answers

### A) Should Calendar become the provider demo start page? — **Yes.**
It's the only surface that answers "what's my day/week?" spatially, and it's a functional superset of Bookings (status changes, notes, reviews — plus reschedule, availability and manual booking that exist *nowhere else*). Landing on the calendar says "this runs my work"; landing on Översikt says "here are some counters." **Caveat:** this only pays off if the demo has **future-dated bookings** and the week view shows a real week. Empty, it's worse than the dashboard. So: yes — *contingent on seeding upcoming bookings and fixing the single-column week render.*

### B) Should Bookings move to "More"? — **No — demote it, don't bury it.**
Bookings has the best filtering UX in the app (the status pills) and farriers genuinely think in lists, not just grids. Hiding it in "Mer" trades one redundancy problem for a findability problem. **Keep it as a secondary primary tab** (present, but no longer co-equal with Calendar) on both desktop and mobile. Make Calendar the place you *work* and Bookings the place you *scan/filter*. Reserve "Mer" for Översikt-summary, Insikter, Tjänster (mobile), Profil, Hjälp.

### C) Should Overview be simplified? — **Yes — slim it hard, or fold it into Calendar.**
In demo state Översikt is mostly duplicated counters plus charts that look empty or alarming — its only *unique* value is statistics, and Insikter does that better. Cut it to a summary: one priority-action prompt, 2–3 KPIs, and explicit links onward to Calendar and Insikter; move it into "Mer" as "Hem/Sammanfattning." If you want to go further (a larger bet), retire it as a standalone tab and let Calendar's header carry the summary. Either way it should **not** be the start page and should **not** repeat the bookings counters.

---

### One-line summary
**Seed future bookings, trim the mobile bar to 4 + Mer, make Calendar the home, slim Översikt, and scrub the test strings — five small, independent moves that turn a broad "admin app" demo into a calm "this runs my week" story without touching the brand or rebuilding anything.**
