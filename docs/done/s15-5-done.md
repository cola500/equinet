---
title: "S15-5 Done: Penetrationstest av nya auth-flodet"
description: "Pentest av Supabase Auth + RLS i produktion -- inga kritiska fynd"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lardomar
---

# S15-5 Done: Penetrationstest av nya auth-flodet

## Acceptanskriterier

- [x] Security-reviewer pa auth-relaterade routes
- [x] IDOR-test: provider kan inte na annan providers data (RLS)
- [x] Privilege escalation: customer kan inte bli provider/admin
- [x] JWT-manipulation: Supabase avvisar manipulerade tokens
- [x] Rate limiting: 429 efter ~34 login-forsok
- [x] Session-hantering: JWT client-side, ingen cookie-exponering
- [x] OWASP ZAP baseline: 0 FAIL, 6 WARN (alla kanda)
- [x] Dokumenterat i docs/security/pentest-2026-04-post-migration.md

## Definition of Done

- [x] Fungerar som forvantat
- [x] Inga kritiska eller hoga sarbarheter
- [x] Rapport dokumenterad

## Reviews

- Kordes: security-reviewer (auth routes + middleware), OWASP ZAP (automatisk skanning)

## Lardomar

1. **RLS ar kraftfullt men kravande**: Varje tabell som jointas behover egna policies.
   Saknade policies ger null-data (inte felmeddelanden).

2. **Supabase inbyggd rate limiting**: ~34 misslyckade login-forsok fore 429.
   Separat fran app-level Upstash rate limiting.

3. **CSP unsafe-inline ar oundvikligt pa Vercel/Next.js**: SRI fungerar inte
   (CDN andrar hashar). Dokumenterat sedan S68.
