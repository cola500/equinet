---
title: "S22-2: Tom-state-forbattringar"
description: "Forbattra empty states pa nyckel-sidor med CTA och onboarding-aterlankning"
category: plan
status: active
last_updated: 2026-04-11
sections:
  - Oversikt
  - Approach
  - Filer
---

# S22-2: Tom-state-forbattringar

## Översikt

Nya leverantörer som navigerar till tjänster, bokningar eller tillgänglighet ska se tydligare tom-states med CTA och aterlank till onboarding.

## Approach

1. **Tjänster** (`/provider/services`): Befintlig empty state ar bra. Lagg till "Tillbaka till kom igang"-lank nar allComplete === false.
2. **Bokningar** (`/provider/bookings`): Befintlig empty state ar bra. Lagg till "Tillbaka till kom igang"-lank nar allComplete === false.
3. **Tillgänglighet** (profil): Schemat visar alltid defaults -- ingen empty state. Lagg till en guide-text ovanfor schemat: "Stall in vilka tider du ar tillgänglig sa att kunder kan boka."

Implementation: Fetcha onboarding-status med SWR/fetch i tjänster och bokningar, visa lank villkorligt. For tillgänglighet: lagg till informationstext.

## Filer

| Fil | Ändring |
|-----|---------|
| `src/app/provider/services/page.tsx` | Lagg till onboarding-lank i empty state |
| `src/app/provider/bookings/page.tsx` | Lagg till onboarding-lank i empty state |
| `src/app/provider/profile/page.tsx` | Lagg till guide-text for tillganglighets-sektionen |
