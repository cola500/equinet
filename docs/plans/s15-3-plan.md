---
title: "S15-3 Plan: Byt Vercel env"
description: "Peka Vercel Production env mot prod Supabase-projekt"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Bakgrund
  - Approach
---

# S15-3 Plan: Byt Vercel env

## Bakgrund

Vercel production hade NEXT_PUBLIC_SUPABASE_ANON_KEY fran PoC-projektet.
URL, DATABASE_URL och SERVICE_ROLE_KEY pekade redan pa prod.

## Approach

1. Identifiera vilka env-variabler som inte matchar prod
2. Uppdatera NEXT_PUBLIC_SUPABASE_ANON_KEY till prod-varde
3. Deploy och verifiera login + custom claims
