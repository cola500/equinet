---
title: "URL-konfigurationsmatris"
description: "Alla URL-config-platser i Equinet: vad de styr, var de ändras och vilka incidenter som inträffat vid felkonfiguration"
category: operations
status: active
last_updated: 2026-04-30
sections:
  - Matris
  - Checklista vid domänbyte
  - Historik
---

# URL-konfigurationsmatris

Equinet har flera separata ställen där URL-konfiguration sätts. Fel i ett enda led orsakar tysta leveransfel eller blockerade auth-flöden. Dokumentet listar alla platser, vad varje styr och var de ändras.

## Matris

| Konfigurationsplats | Vad den styr | Var ändras den | Incident om fel |
|--------------------|-------------|----------------|-----------------|
| **Vercel `APP_URL`** | Bas-URL för all email-genererade länk i appkoden (`process.env.APP_URL`). Används i password reset-mail, verifieringsmail, data retention-varningar. | Vercel Dashboard → Settings → Environment Variables | Password reset-länk pekar mot fel domän → 404. Verifierat S64-2026-04-30. |
| **Vercel `NEXT_PUBLIC_SUPABASE_URL`** | Supabase REST/auth-endpoint. Används i klient-bundle och CSP. | Vercel Dashboard → Settings → Environment Variables | Browser blockerar alla auth-anrop om CSP inte matchar. **Rotorsak till password reset-incidenten 2026-04-30** (CSP-hotfix commit `9410dd21`). |
| **Vercel `NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Supabase anon-nyckel för klientanrop. | Vercel Dashboard → Settings → Environment Variables | Alla Supabase-anrop från klient failar med 401. |
| **CSP `connect-src`** i `next.config.ts` | Vilka externa domäner browsern tillåts anropa. Måste inkludera Supabase-URL. Läses från `NEXT_PUBLIC_SUPABASE_URL`. | `next.config.ts` → `contentSecurityPolicy` → `connect-src` | Browser blockerar Supabase-anrop → tysta auth-fel. Hardkodad gammal URL var rotorsaken 2026-04-30. Nu läst från env. |
| **Supabase Site URL** | Fallback-redirect-URL efter login om `redirect_to` inte matchar allowlist. Används av Supabase egna mail-templaten. | [Supabase Dashboard → Auth → URL Configuration](https://supabase.com/dashboard/project/xybyzflfxnqqyxnvjklv/auth/url-configuration) | Användare redirectas till gammal domän efter email-bekräftelse. |
| **Supabase Redirect URLs allowlist** | Tillåtna `redirect_to`-värden vid magic link, OAuth och password reset via Supabase. `/auth/callback` måste vara listad. | [Supabase Dashboard → Auth → URL Configuration](https://supabase.com/dashboard/project/xybyzflfxnqqyxnvjklv/auth/url-configuration) | Magic link fungerar inte — callback-URL blockeras av Supabase. S64-6: `https://equinet-app.vercel.app/auth/callback` måste läggas till manuellt. |
| **iOS `AppConfig.swift` prodURL** | WKWebView start-URL i iOS-appen. | `ios/Equinet/Equinet/AppConfig.swift` → `prodURL` | iOS-app visar fel app vid domänbyte. |
| **Stripe webhook endpoint** | URL som Stripe POST:ar webhooks till. Måste matcha `/api/webhooks/stripe`. | [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks) | Betalningshändelser levereras inte → bokningar bekräftas aldrig. |
| **Resend domän-verifiering** | DKIM/SPF för avsändardomänen i `FROM_EMAIL`. | [Resend Dashboard → Domains](https://resend.com/domains) | Mail hamnar i skräppost eller avvisas av mottagarserver. |

## Checklista vid domänbyte

Vid byte från gammal till ny prod-domän — gå igenom ALLA punkter:

- [ ] **Vercel `APP_URL`** — uppdatera till ny domän
- [ ] **`NEXT_PUBLIC_SUPABASE_URL`** — ändras bara om Supabase-projektet byts ut (sällan)
- [ ] **CSP** — verifieras automatiskt via `NEXT_PUBLIC_SUPABASE_URL`, men kör en build och kontrollera CSP-headern
- [ ] **Supabase Site URL** — uppdatera till ny domän
- [ ] **Supabase Redirect URLs** — lägg till ny domän, behåll gammal tills alla sessioner har gått ut
- [ ] **iOS `AppConfig.swift` prodURL** — uppdatera och tagga ny iOS-release
- [ ] **Stripe webhook endpoint** — skapa ny, verifiera, ta bort gammal
- [ ] **Resend** — om avsändardomänen också byts: ny domän-verifiering

## Historik

| Datum | Incident | Rotorsak | Fix |
|-------|---------|----------|-----|
| 2026-04-30 | Password reset-mail levererades men användare kunde inte återställa lösenord. Tre försök, alla tystade. | `NEXT_PUBLIC_SUPABASE_URL` hade gammal URL → browser blockerade auth-anrop via CSP. `APP_URL` saknades i Vercel. | CSP läser nu från env-variabel (commit `9410dd21`). `APP_URL` tillagd i Vercel. CI-guard i prebuild (S64-4). |
