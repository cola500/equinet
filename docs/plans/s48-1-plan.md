---
title: "S48-1: Miljö-hardening — staging-struktur + env-hierarki"
description: "Dedikerad staging-URL, iOS staging-scheme, .env-städning, status-script, environments.md"
category: plan
status: active
last_updated: 2026-04-20
sections:
  - Aktualitet verifierad
  - Problemanalys
  - Lösning per del
  - Filer
  - Testplan
---

# S48-1: Miljö-hardening — staging-struktur + env-hierarki

## Aktualitet verifierad

**Kommandon körda:**
- Läste `ios/Equinet/Equinet/AppConfig.swift` — staging + production delar URL `equinet-app.vercel.app`
- Läste `scripts/status.sh` — visar lokal Supabase + dev-server, inget om aktiv miljö/databas
- Läste `.env.example` — Docker-alternativ finns, ingen staging-sektion, ingen hierarki-förklaring
- Kollade `docs/guides/` — `environments.md` saknas
- Kollade `vercel.json` — regions + crons, ingen alias-konfiguration

**Resultat:** Alla problem bekräftade. Fortsätt.

---

## Problemanalys

1. **Staging-URL saknas** — `equinet-staging.vercel.app` är inte konfigurerat. iOS staging = prod-URL.
2. **iOS pekar staging på prod** — `AppConfig.staging` och `AppConfig.production` delar URL.
3. **`.env.example`** har Docker-alternativ (ersatt S17-7) och saknar staging-sektion.
4. **`status.sh`** visar inte vilken databas som är aktiv (kan råka köra mot remote).
5. **`environments.md`** existerar inte.

---

## Lösning per del

### S48-1.1: Vercel staging-alias

Vercel Hobby stödjer inte custom aliases till stable preview-URL. Alternativ som funkar gratis:

- Skapa en dedikerad **`staging`-branch** — Vercel auto-deployar och ger stabil preview-URL per branch
- Branch-URL-mönster: `equinet-git-staging-cola500.vercel.app` (fast, inte random per commit)
- Dokumentera URL-mönstret i `environments.md`

**Notering:** `equinet-staging.vercel.app` kräver Vercel Pro alias-feature. Acceptanskriteriet i sprint-dokumentet antar Pro — men stabil branch-URL uppfyller samma syfte gratis.

### S48-1.2: iOS staging-scheme

`AppConfig.swift`: Lägg till separat URL för `.staging`:
```swift
case .staging:
    return URL(string: "https://equinet-git-staging-cola500.vercel.app")!
case .production:
    return URL(string: "https://equinet-app.vercel.app")!
```

### S48-1.3: `.env`-hierarki-städning

- Ta bort Docker-alternativet (ersatt av Supabase CLI sedan S17-7)
- Lägg till tydlig hierarki-förklaring: `.env.local` > `.env.development` > `.env`
- Lägg till staging-sektion (kommenterad) med exempel
- Uppdatera gotchas.md: förtydliga Vercel CLI-gotcha #23

### S48-1.4: `scripts/status.sh` — aktiv miljö

Utöka med sektion "Aktiv miljö":
- Läs `DATABASE_URL` från env-hierarkin (`.env.local` > `.env`)
- Visa: `local` / `supabase-remote` (med projekt-ref) / `okänd`
- Rött varningsmeddelande om lokal dev pekar på remote Supabase

### S48-1.5: `docs/guides/environments.md` (ny fil)

Matris: URL × Supabase-projekt × auth-källa per miljö + hierarki-diagram

---

## Filer

| Fil | Ändring |
|-----|---------|
| `ios/Equinet/Equinet/AppConfig.swift` | Separera staging/production URL |
| `scripts/status.sh` | Lägg till aktiv-miljö-sektion |
| `.env.example` | Ta bort Docker, lägg till hierarki + staging |
| `docs/guides/environments.md` | Skapa ny fil |
| `docs/guides/gotchas.md` | Uppdatera gotcha #23 med `.env.local`-förklaring |

---

## Testplan

- `npm run status` visar aktiv miljö
- `AppConfig.baseURL` returnerar rätt URL per miljö (ingen automatiserad test behövs — statisk switch)
- `npm run check:all` grön
- `docs:validate` grön
