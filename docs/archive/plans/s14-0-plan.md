---
title: "S14-0: iOS-verifiering av Supabase Auth"
description: "Verifiera att iOS-appen fungerar med Supabase Auth efter Sprint 13-migrering"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Bakgrund
  - Approach
  - Verifieringspunkter
---

# S14-0: iOS-verifiering av Supabase Auth

## Bakgrund

Sprint 13 migrerade all auth till Supabase Auth, men iOS-appen verifierades aldrig
(bara webben via Playwright MCP). Denna story verifierar att iOS fungerar korrekt.

## Approach

1. Seeda Supabase public-schema med auth-matchande User-poster
2. Starta dev-server mot Supabase-projektet (zzdamokfeenencuggjjp)
3. Bygga och köra iOS-appen i simulator
4. Verifiera med mobile-mcp

## Verifieringspunkter

- [ ] Login via Supabase Swift SDK
- [ ] Dashboard med data (native)
- [ ] Alla tabs navigerar korrekt
- [ ] WebView-sidor autentiserade (session exchange)
- [ ] Native skärmar (kunder)
- [ ] Logout + re-login
