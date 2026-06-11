---
title: "Wiki: Home"
description: "Draft för GitHub Wiki-startsidan -- portal till Equinets utvecklardokumentation. Frontmattern strippas vid publicering."
category: guide
status: draft
last_updated: 2026-06-11
tags: [wiki, onboarding]
related:
  - docs/wiki-drafts/wiki-structure-proposal.md
  - docs/INDEX.md
sections:
  - Vad är Equinet?
  - Jag vill...
  - Sidor i denna wiki
  - Source of truth
---

# Equinet -- utvecklarwiki

> **Source of truth är repo-dokumentationen i [`docs/`](https://github.com/cola500/equinet/blob/main/docs/INDEX.md).**
> Denna wiki är en navigerbar portal som sammanfattar och länkar -- vid konflikt gäller alltid repo-docs.

## Vad är Equinet?

Equinet är en bokningsplattform som kopplar samman hästägare med tjänsteleverantörer
(hovslagare, veterinärer, equiterapeuter). Webbapp i Next.js 16 + en hybrid iOS-app
(SwiftUI + WKWebView), med Supabase (PostgreSQL + Auth) och Vercel som driftplattform.

- **Stack:** Next.js 16 (App Router), TypeScript, Prisma, Supabase Auth + RLS, shadcn/ui, Stripe
- **Arkitektur:** DDD-Light -- routes → domain services → repositories
- **Språk:** Svenska i UI och docs, engelska i kod
- **Demo:** https://equinet-staging.johanlindengard.com

Längre version: [The Equinet Story](https://github.com/cola500/equinet/blob/main/docs/the-equinet-story.md) · [Roadmap](https://github.com/cola500/equinet/blob/main/docs/roadmap.md)

## Jag vill...

| ...göra detta | Börja här |
|---------------|-----------|
| Sätta upp lokal utvecklingsmiljö | [[Developer Onboarding]] |
| Förstå hur systemet hänger ihop | [[Architecture Overview]] |
| Veta vad lokal/staging/prod är och hur deploy funkar | [[Environments and Deployments]] |
| Köra en migration eller förstå databasen | [[Database and Migrations]] |
| Seeda demo-data eller förstå demo-läget | [[Demo Data and Seed]] |
| Slå på/av en feature flag | [[Feature Flags]] |
| Skriva en ny API-route enligt konventionerna | [[API Conventions]] |
| Förstå betalningsflödet (Stripe) | [[Payments]] |
| Jobba med ruttplanering / leverantörens arbetsdag | [[Routes and Provider Workday]] |
| Jobba med stall- och hästdomänen | [[Stable and Horse Domain]] |
| Veta vilka tester och gates som måste vara gröna | [[CI Testing and Quality Gates]] |
| Hantera en incident eller ändra env-variabler | [[Operations Runbooks]] |
| Felsöka något konstigt | [[Troubleshooting]] |

## Sidor i denna wiki

**Getting Started:** [[Developer Onboarding]] · [[App Overview]]
**System:** [[Architecture Overview]] · [[Database and Migrations]] · [[Feature Flags]] · [[API Conventions]]
**Domäner:** [[Payments]] · [[Routes and Provider Workday]] · [[Stable and Horse Domain]]
**Leverans:** [[Environments and Deployments]] · [[Demo Data and Seed]] · [[CI Testing and Quality Gates]]
**Support:** [[Operations Runbooks]] · [[Troubleshooting]]

## Source of truth

| Behov | Repo-dokument |
|-------|---------------|
| Docs-index (allt) | [`docs/INDEX.md`](https://github.com/cola500/equinet/blob/main/docs/INDEX.md) |
| Arbetssätt & konventioner | [`CLAUDE.md`](https://github.com/cola500/equinet/blob/main/CLAUDE.md) |
| Setup & kommandon | [`README.md`](https://github.com/cola500/equinet/blob/main/README.md) |
| Databasschema | [`prisma/schema.prisma`](https://github.com/cola500/equinet/blob/main/prisma/schema.prisma) |
| Vanliga fallgropar | [`docs/guides/gotchas.md`](https://github.com/cola500/equinet/blob/main/docs/guides/gotchas.md) |
| Lärdomar över tid | [`docs/retrospectives/`](https://github.com/cola500/equinet/blob/main/docs/retrospectives/README.md) |
