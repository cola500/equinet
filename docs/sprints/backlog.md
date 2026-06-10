---
title: "Produktbacklog"
description: "Kanonisk backlog för Equinet. Alla kända stories, uppgifter och beslut. status.md pekar hit; roadmap.md är den strategiska vyn."
category: sprint
status: active
last_updated: 2026-06-07
tags: [backlog, roadmap, planning]
sections:
  - Aktiva produktspår
  - Kräver PO-beslut
  - Blockerare
  - Live-betalningar (Production Readiness)
  - Plattformshärdning (pre-live)
  - Betalning
  - Kritiskt
  - Sökning och discovery
  - Kvalitet och säkerhet
  - Kodeffektivitet (tech debt)
  - Offline PWA-stabilitet
  - Agent-navigering
  - Pattern-katalog
  - iOS
  - Due-for-service
  - Dagens rutt (uppföljning)
  - Features som kräver arbete innan lansering
  - Messaging-epic (post-launch)
  - Process & tech-debt (vid tillfälle)
  - Parking lot
  - Vid lansering
  - Arkiv / Done
  - Research
---

# Produktbacklog

> **Kanonisk backlog.** `docs/sprints/status.md` pekar hit (ingen duplicering där).
> `docs/roadmap.md` är den strategiska vyn. Prioritetsordning inom varje kategori.
> Senast genomgången: **2026-06-07** (backlog-hygien — konsolidering + arkiv).

---

## Aktiva produktspår

Vad vi faktiskt driver just nu (allt annat nedan är kö, parkerat eller arkiv):

- **Live-betalningar** — härda Stripe test-mode → live. Öppna trådar i [Live-betalningar](#live-betalningar-production-readiness) + [Plattformshärdning](#plattformshärdning-pre-live). Enda hårda blockern är **Stripe företagsverifiering** (ägare: Stripe/Johan), inte kod.
- **Demovärdig webb / staging** — Dagens rutt levererat (MVP + riktig körsträcka + demo-seed), CI-gate på staging-PR:er aktiv. Kvar: besöksplats-modell → Stall-epic (discovery).

**Vilande tills beslut/blocker löses** (ej aktivt drivna): Messaging-epic, Fortnox-fakturering, native kundupplevelse, ruttplanering live (Mapbox-token), provider subscription. Se [Kräver PO-beslut](#kräver-po-beslut).

---

## Kräver PO-beslut

Samlade produkt-/strategibeslut som väntar på Johan. Tills beslut: inget arbete startas.

| Beslut | Fråga | Påverkar |
|--------|-------|----------|
| `provider_subscription` | Vilken prismodell? Stripe subscription-infrastruktur är klar. | Monetarisering |
| `stable_profiles` | Behålla eller ta bort? Aldrig testad med riktiga användare. | Feature-yta, underhåll |
| `demo_mode` | Behövs efter lansering, eller kan släckas? | Demo-spår |
| `supabase_auth_poc` | PoC klar sedan S10 → ta bort flaggan? (kandidat: arkivera) | Städning |
| Mapbox-token | Köpa konto/token för att aktivera `route_planning` + `route_announcements` (kod klar)? | Ruttplanering live |
| Fortnox API-access | Ansöka om access för fakturerings-integration? | Fortnox-spår |
| Seven Dimensions + teater-metodik (R8) | Behåll / förenkla / ta bort? Process-metodik-eval; fönstret (S55) passerat. Din process-kompass. | Arbetssätt |

> Process-/tech-lead-beslut (inte PO) ligger under [Process & tech-debt](#process--tech-debt-vid-tillfälle): t.ex. `gh-pr-merge`-wrapper (enforcement eller bort) och versionering av `.claude/skills`.

---

## Blockerare (väntar på Johan)

| Story | Blockerare | Effort |
|-------|-----------|--------|
| Push live (APNs) | Apple Developer 99 USD | Config, 15 min |
| Stripe live-mode | Stripe företagsverifiering | Config, 15 min |
| Swish aktivering | Stripe företagsverifiering | 1 rad kodändring |
| Uppgradera till Vercel Pro | $20/mån — Hobby tillåter inte kommersiellt bruk | Config, 5 min |

---

## Live-betalningar (Production Readiness)

> Öppna trådar inför **live-betalningar**. Härstammar från betalnings-hardening-spåret — se [wrap-up-retro](../retrospectives/2026-06-06-payment-hardening-wrapup.md).

| Item | Storlek | Beskrivning | Trigger |
|------|---------|-------------|---------|
| Checkout Sessions Spike | S | Utvärdera Stripe Checkout Sessions (`ui_mode=elements`) mot nuvarande direkt-PaymentIntents. Se [spike-doc](../architecture/spike-stripe-checkout-sessions.md). Mer färdigt checkout-stöd, mindre egen kod. | Före production payments |
| Stripe Idempotency Keys | S | Idempotency key på `StripePaymentGateway.initiatePayment`. Varje Betala-klick skapar idag ny PaymentIntent via upsert → övergivna PIs; dubbelklick = två PIs. | Före live |
| Restricted Stripe Keys | S | Byt `sk_` → restricted key (`rk_`) med least-privilege per miljö. En komprometterad `rk_` gör mindre skada. | Före live (test + prod) |
| 3DS Verification | M | Lägg `https://hooks.stripe.com` i CSP `frame-src` och testa 3DS-kort (SCA). Testkortet `4242` är non-3DS; riktiga EU-kort triggar ofta 3DS i `hooks.stripe.com`-iframe. | Före live med riktiga kort |

## Plattformshärdning (pre-live)

> Tvärgående robusthet inför produktion — se [wrap-up-retro](../retrospectives/2026-06-06-payment-hardening-wrapup.md).

| Item | Storlek | Beskrivning | Trigger |
|------|---------|-------------|---------|
| Service Worker Update Strategy | M | Säkerställ att ny SW tar över efter deploy (skipWaiting-prompt eller versions-trigger). Browser fastnade på gammal SW efter deploy → risk att fixar inte når användare. | Nästa SW-bugg, eller före prod |
| Payment Security Review | M | Formell oberoende säkerhetsgranskning av hela betalflödet (IDOR, server-side amount, webhook-signatur, ownership, idempotens). | Före production payments |
| Production Monitoring | M | Alerting/observability för betalningar (failed payments, webhook-fel, dedup-anomalier) via Sentry/loggar + larm. | Vid/före live |
| Fixa fire-and-forget i AuthService + övriga notifiers | 1-2h | `AuthService.requestPasswordReset` skickar `emailService.sendPasswordReset(...).catch(() => {})` och returnerar direkt. På Fluid Compute kan instansen termineras innan fetch slutförs → mail skickas aldrig. **Bevis 2026-04-30**: 2 av 3 password-reset-mail nådde aldrig Resend. Fix: `await waitUntil(...)` från `@vercel/functions` eller blockerande `await`. Audit alla `.catch(() => {})` i `src/`. |
| CI-guard: kräv icke-tom APP_URL i prod-build | 1-2h | `APP_URL` saknades i Vercel prod-env i månader → email-länkar pekade på localhost. `scripts/check-prod-env.ts` verifierar att vars finns men inte att de har värde. Lägg till non-empty-check i `prebuild` när `VERCEL_ENV=production` (APP_URL, DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, RESEND_API_KEY, STRIPE_SECRET_KEY). |

---

## Betalning

| Story | Effort | Beroende |
|-------|--------|----------|
| Swish i Payment Element | 1 rad + test | Stripe företagsverifiering |
| Provider subscription (monetarisering) | 1-2 veckor | Prissbeslut (se Kräver PO-beslut) |
| Fortnox-integration (fakturering) | 2-3 veckor | Fortnox API-access (se Kräver PO-beslut) |

## Kritiskt

| Story | Effort | Varför kritiskt |
|-------|--------|----------------|
| GDPR data retention policy + cron | 1 dag | Lagkrav. Radering av gammal data, definierade lagringsperioder. |

---

## Sökning och discovery

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| **providerCategory på Provider** (strukturerad tjänstekategori) | 1-2 dagar | Schemaändring: `providerCategory String?` på `Provider` (t.ex. "hovslagare", "veterinär", "tränare"). Leverantören väljer i profilformuläret. `serviceType`-filtret i `ProviderRepository` söker primärt i fältet — inte synonymhack mot tjänstenamn. Löser rotorsaken till att "Alingsås Hovservice" inte hittades **och** ersätter `SERVICE_CATEGORY_TERMS`-workarounden (hotfix 2026-04-24). Kräver: Prisma-migration + profilformulär-UI + seed-data + repo-filter + RLS-audit + ta bort `SERVICE_CATEGORY_TERMS`. *(Konsoliderar tidigare dubblett "category-fält på Service" från status.md.)* |

## Kvalitet och säkerhet

| Story | Effort | Prioritet |
|-------|--------|-----------|
| Leaflet CSS lazy-load (licensrisk) | 15 min | `leaflet.css` importeras i layout.tsx (alltid). Flytta till `RouteMapVisualization.tsx` (lazy). Eliminerar Hippocratic-licenserad kod från sidor som inte använder ruttplanering. Se `docs/security/license-audit-2026-04-15.md`. |
| E-postverifiering Resend i prod (S17-5 / S22-3) | 0.5 dag | **Blockerad** — kräver domänverifiering eller Resend Pro. Gratis-konto tillåter bara eget e-post. Verifiera leverans i prod. |
| BDD integrationstester — horses, booking-series, bookings POST, group-bookings join | 1 dag | Kärndomäner saknar integration: Horses (8 routes), Booking-series (3), `POST /api/bookings`, `POST /api/group-bookings/join` (Serializable). 18/181 routes har integration. Audit: [bdd-coverage-audit-2026-04-25.md](../research/bdd-coverage-audit-2026-04-25.md). |
| Hårdkodad fel domän i `data-retention-warning.ts` | 10 min | `src/lib/email/templates/data-retention-warning.ts:4` fallback `https://equinet.vercel.app` (utan `-app`). Använd `process.env.APP_URL \|\| 'http://localhost:3000'` som övriga templates. |
| Help-data drift protection | 15-30 min | CI-validation som regenererar `articles-data.ts` och diffar mot committed version. Bevisat behov efter PR #333 (staging hade tom hjälpsektion pga `.vercelignore` + build-time-generator). Story: [help-data-drift-protection.md](../stories/help-data-drift-protection.md). |
| Audit hårdkodade framtida datum i tester (time-bomb-audit) | 30 min–1h | Booking-series-fail (fixad 2026-05-14) hade rotorsak i hårdkodat `firstBookingDate: "2026-05-01"`. Risk: fler test-fixtures har samma time-bomb. `grep -rE '"20[2-3][0-9]-..."' src/**/*.test.ts e2e/**`, byt till dynamiska datum, ev. ESLint-regel/pre-commit-check. |
| URL-konfigurationsmatris | 30 min | `docs/operations/url-configuration.md`: alla URL-config-platser (Vercel `APP_URL`, Supabase Site URL + Redirect URLs, Stripe webhook, Resend-domän, iOS prod-URL). Vi har bränt oss på trippel-miss. |
| Städa Vercel env-variabler med literal `\\n` på slutet | 15 min | `NEXT_PUBLIC_SUPABASE_URL`/`..._ANON_KEY` i prod har literal `\\n`-suffix → `vercel env pull` ger trasiga lokala anrop. Fix via UI. |
| recurring_bookings E2E-verifiering | 1 dag | Medel. |
| group_bookings E2E + UX-review | 2-3 dagar | Medel. |
| E2E: fixa skippade tester | 1-2 veckor | Låg prioritet. |
| withApiHandler resterande routes (~131 st) | Löpande | Opportunistiskt. |
| Zod `.strict()` på mobile-token | 30 min | Saknas på request body. |
| console.* i legacy docs | 0.5 dag | Låg prioritet. |
| horses-CRUD coverage-gap (S43-1) | 1-2h | `page.test.tsx` täcker bara form-nivå; delete-bekräftelsedialog, edit-flöde och `handleDelete`/`handleAddHorse` fetch-logik otestade. MSW-mockad page-test eller tunn E2E-smoke. Slå ev. ihop med BDD-coverage-item. |
| due-for-service `filter=upcoming`-test saknas (S43-2) | 15 min | Integration-test täcker `overdue` + `all` men inte `filter=upcoming` (route-URL:en dokumenterar parametern). |

## Kodeffektivitet (tech debt)

### Content-as-code (~4 000 rader)

| Fil | Rader | Problem | Lösning | Effort |
|-----|-------|---------|---------|--------|
| `src/lib/help/articles.provider.ts` | 1335 | Hjälpartiklar hårdkodade i TS | Flytta till markdown, läs vid build | 0.5 dag |
| `src/lib/help/articles.customer.ts` | 788 | Samma | Samma | Ingår ovan |

### Stora filer (>500 rader)

| Fil | Åtgärd | Effort |
|-----|--------|--------|
| 10+ filer runt 520-620 rader | Gränsfall, åtgärda vid nästa ändring | Löpande |

## Offline PWA-stabilitet

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| Kund-offline (fas 4) | 1-2 dagar | **Parkerad** (2026-04-17) — fokus på leverantörens upplevelse. Se [Parking lot](#parking-lot). |

## Agent-navigering (kodkarta)

> **Hypotes:** Domänkarta i `.claude/rules/code-map.md` sparar 3-5 sökningar/uppgift. Steg 0 klart (20 domäner, 169 routes).

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| Feature flag → fil-mapping | 1h | Vilka filer berörs av varje flagga. Grep-baserat. |
| Domän-metadata i koden | 2h | JSDoc överst i varje Service: routes, repos, flagga. |

## Pattern-katalog (djupdokumentera guldkorn)

> Mönster (2026-04-17) som är smartare än vanligt men bara finns som kod. ~1 dags docs-arbete totalt. Full motivering i chat-retro 2026-04-17.

| Story | Effort | Värde |
|-------|--------|-------|
| Dubbelt skyddslager (auth + RLS) som pattern | 1h | Defense in depth. Framtida integrationer följer samma tänk. |
| AI Service-mönster (generic) | 1h | 2 AI-features med samma struktur (Zod-output, prompt-injection-skydd, rate limiting). |
| Gateway abstraction (Payment/Accounting/...) | 1h | Interface + impl för utbytbara tredjeparter. Konkret vid Fortnox. |
| Circuit breaker (generaliserat) | 30 min | Finns i sync-engine, kan generaliseras. |
| Feature flag prioritet (env > DB > code) | 30 min | Missförstås ofta. |
| Optimistic UI med revert (iOS + webb-port) | 30 min | Pattern från iOS, kan porteras till webb. |
| Fire-and-forget notifier (utöka rad) | 15 min | Varför pattern existerar. |
| E2E-spec-taggning för cleanup | 15 min | Rad i patterns.md. |

---

## iOS

> *(S29-stories i sprint 29: iOS Polish + mobile-mcp-verifiering.)*

### iOS-migrering (6 kvarvarande provider WebView-skärmar)

| Skärm | Bakom flagga | Komplexitet | Beroende |
|-------|-------------|-------------|----------|
| Röstloggning | voice_logging | Hög (Speech + AI) | Inget |
| Annonsering | route_announcements | Medel | Inget |
| Business insights | business_insights | Medel | Inget |
| Ruttplanering | route_planning | Hög | Mapbox-token |
| Gruppbokningar | group_bookings | Hög | Inget |
| Hjälpcentral | help_center | Låg | Inget |

**Kundskärmar (alla WebView):** Bokningar, hästar, gruppbokningar, profil, FAQ, hjälp, export.

### iOS övrigt

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| Native schema-redigering | 1 dag | AvailabilitySchedule + AvailabilityException redigeras idag i WebView. Provider använder dagligen. |
| iOS Snapshot-tester | 0.5-1 dag | Swift Snapshot Testing över 15 native-vyer. Fångar visuella regressioner. |
| iOS auth-polish (S48-0 review-follow-up) | 2-3h | 7 minor-fynd: HTTPCookieStorage domän-scope-verifiering, re-exchange vid JWT-rotation, cookie-rensning i logout, defensiv domän-filter, refresh-token i header, utökade mock-tester, user-facing fallback vid exchange-fel. Alla defense-in-depth/UX-polish. |
| Live Activity för pågående bokning (iOS 16+) | 1-1.5 dag | Lock Screen + Dynamic Island. Wow-feature. *(Parking lot-kandidat.)* |
| Siri Shortcut "Nästa bokning" | 0.5 dag | NSUserActivity + App Intent. *(Parking lot-kandidat.)* |
| LoginError `emailNotConfirmed` eget fall | 30 min | S34-3: ger "fel e-post/lösenord" istället för "verifiera din e-post". |
| LoginError `.cancelled` URLError | 30 min | S34-3: mappas till `.networkUnavailable` men kan triggas av app-navigering. |
| ios-learnings + patterns från S34 | 30 min | `.confirmationDialog`, `LoginError`-enum, `URLError`-catch-ordning, mailto-encoding → `.claude/rules/ios-learnings.md`. |
| iOS native-flöde-audit via mobile-mcp (S42-4) | 1-1.5h | 13 native-flöden, visuell baseline. Pre-launch-värde för iOS. Avbruten från S42. |
| iOS XCUITest smoke-svit | 2-3 dagar | Plan finns ([ios-xcuitest-bootstrap.md](../plans/ios-xcuitest-bootstrap.md)). Login + 3 native-flöden. Post-launch. |

## Due-for-service (uppföljning)

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| Proaktiv push-notifikation vid förfallna hästar | 45 min | Daglig cron `/api/cron/due-for-service-notify` → push via `PushDeliveryService` + `DueForServiceLookup`. Infrastrukturen finns. Teateranalys 2026-04-25 (GAP 4). |
| UX: "Boka"-knappen i förfallna-listan | 30 min | Förifyll häst + tjänst i kalendern/manuell-bokningsdialog istället för bara länk. Sprint 60 review-fynd. |

## Dagens rutt (uppföljning)

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| Besöksplats-modell (→ Stall-epic) | Discovery | Dagens rutt använder i demon kundens **hemkoordinat** som proxy för **besöksplats**. Korrekt modell: stall-/besöksadress kopplad till häst/bokning (en kund kan ha hästar på olika stall). Hör hemma i kommande **Stall-epic/discovery**, inte i Dagens rutt. Demo-förbehåll dokumenterat i [verifieringsdokumentet](../discovery/dagens-rutt-verifiering-2026-06.md). |
| Provider booking-detaljvy (`/provider/bookings/[id]`) | 0.5-1 dag | Ingen per-bokning-detaljvy för leverantör finns idag (`/provider/bookings` är en listvy, ingen `[id]`-route) → stoppkortet i Dagens rutt kan **inte** länka till bokningsdetaljer. När en sådan vy byggs: gör stoppkortet klickbart dit (`stop.id` = bookingId finns redan i `today-route`-svaret). Medvetet **ej byggt** i "Navigera"-slicen 2026-06-07. |
| Hydration mismatch (React #418) på Dagens rutt | <0.5 dag | `/provider/today` loggar konsolfel **React #418 (hydration mismatch)** vid laddning. Sannolik orsak: datumsträngen ("tisdag 9 juni") renderas olika på server vs klient (locale/tidszon vid SSR). Påverkar inte stall-/ruttdata — funktionellt grönt — men bör städas (t.ex. rendera datumet client-only via `useEffect`/`suppressHydrationWarning`, eller stabilisera locale-formattering). Upptäckt vid staging-verifiering av stall-RLS 2026-06-09, se `docs/ux/visual-audit/stall-route-provider/`. |

> Klart i Dagens rutt-spåret: MVP, riktig körsträcka, demo-seed, OSRM-dedup — se [Arkiv / Done](#arkiv--done).

## Features som kräver arbete innan lansering

| Flagga | Problem | Effort |
|--------|---------|--------|
| route_planning | Kräver Mapbox-token | Konto + token + verifiering 1-2 dagar |
| route_announcements | Beroende av route_planning | Löses med route_planning |
| business_insights | Behöver realistisk data | Polish + seed-data 1-2 dagar |
| offline_mode | Komplex, inga E2E-tester | E2E + stabilisering 1-2 veckor |
| follow_provider | Värde vid volym | Verifiering vid skalning |
| municipality_watch | Värde vid volym | Verifiering vid skalning |
| stable_profiles | Aldrig testad i prod | **Beslut behövs** — hanteras via [Stall-epic](#stall-epic-post-launch). Skyddar enbart stallägar-flödet (profiler, spots, invites, nav); häst → stalltillhörighet är numera grundfunktion utan flagga. |

## Messaging-epic (post-launch)

> Slicad enligt Seven Dimensions 2026-04-18. Separat från leverantör↔leverantör-epic. Se [epic-messaging.md](../ideas/epic-messaging.md).

| Slice | Effort | Beskrivning |
|-------|--------|-------------|
| Slice 1 (MVP): per bokning, text, polling | 4-5 dagar | Ny Conversation/Message-domän, inkorg + tråd-vy, push. 80% av värdet. Post-launch. |
| Slice 2: bilagor (bild) | 1-2 dagar | Supabase Storage. Efter Slice 1 mätt. |
| Slice 3: realtid | 1-2 dagar | Ersätt polling med Supabase Realtime. Nice-to-have. |
| Slice 4: röstmeddelanden | 2-3 dagar | Återanvänd SpeechRecognizer (S8). |
| Slice 5: förfrågningar före bokning | 2-3 dagar | Kräver triage/spam-skydd-beslut. |
| Leverantör ↔ leverantör community (separat epic) | 2-3 sprintar | Nätverkseffekt (remisser, vikarier). Utforska efter messaging-epic validerats. |

**Messaging-polish (minor, post-MVP):** aria-label på ProviderNav-badge (15 min), pending-state på MessagingSection-knapp (15 min), pagination för långa trådar (1-2h), leverantörs-läskvitto (1h), typing indicator (2-3h).

## Stall-epic (post-launch)

> Slicad enligt Seven Dimensions 2026-06-07. Se [epic-stall.md](../ideas/epic-stall.md). **Discovery-fynd:** Stable-foundation (modell, stallägar-flöde, invites, spots, `Horse.stableId`) är **redan byggd** men avstängd bakom flaggan `stable_profiles`. Effort skiljer på *aktivera* (befintlig kod) och *bygga* (nytt).

| Slice | Effort | Beskrivning |
|-------|--------|-------------|
| ~~Slice 1 (grundbyggsten): häst → stalltillhörighet + namn på profil~~ **LEVERERAD 2026-06-07** | 2-4h (aktivera) | Bröts först ut till flaggan `horse_stable_link`; PO befordrade till grundfunktion → flaggan borttagen, alltid aktiv. Stallägar-flödet förblir av bakom `stable_profiles`. Demo-stall i seed. |
| Slice 2: stallprofil synlig (skapa stall, se hästar i stallet) | 0.5 dag (aktivera) | Aktivera befintlig stallägar-kod efter verifieringsrunda. |
| Slice 3: medlemskap + inbjudningar med godkännande | Medel (bygga) | Medlems-entitet + ansök/godkänn-flöde saknas idag. |
| Slice 4 (kärnvärde): gemensamt leverantörsbesök | Störst (bygga) | Stall-koppla `GroupBookingRequest`; flera hästar till ett besök. Det enda genuint nya. |
| Slice 5: roller/multi-admin, synlighet, häst i flera stall | Medel (bygga) | Schemaändring: single owner → roller; single `stableId` → m2m. |

## Process & tech-debt (vid tillfälle)

| Item | Effort | Beskrivning |
|------|--------|-------------|
| Review-matris: auth-UI-gap (S47-0) | 15 min | `src/components/auth/**/*.tsx` matchar bara `ui-component` → saknar security-reviewer trots säkerhets-yta. Lägg rad i `.claude/rules/review-matrix.md`. |
| Docs-sync: environments.md + .env.local-gotcha | 30-45 min | environments.md säger Docker PostgreSQL men vi använder Supabase CLI sedan S17-7. Dokumentera `.env.local`-fallgropen. |
| Versionera `.claude/skills/` (ta bort gitignore-rad) | 1-2h | 13 skills är otracked/osynkade. Granska kvalitet → ta bort `.gitignore`-rad → committa. Trade-off: förlorar per-dev-anpassade skills. *(Process-beslut.)* |
| `gh pr merge`-wrapper: enforcement eller bort | 30-45 min | `scripts/gh-pr-merge.sh` är git-alias-baserat (social norm), triggar inte per default. **Välj ett:** (A) gör self-merge omöjligt via hook/alias-shadowing, eller (B) ta bort scriptet. *(Process-beslut.)* |
| Konsolidera meta-rules-filer | 2-4h | 5 filer (team-workflow, autonomous-sprint, tech-lead, parallel-sessions, auto-assign, ~1200 rader) dokumenterar samma tema. Ingen refereras från CLAUDE.md Snabbreferens. Slå ihop, arkivera resten till `docs/archive/rules/`. *(Process-beslut.)* |
| MessagingDialog öppnar ej i headless Playwright (S50-0) | 30 min | `onClick` triggas men `open`-state flippar ej i headless. API-kedjan funkar → inte prod-blocker. Undersök `--headed` + verkliga browsers. |
| iOS WebView login-bypass för mobile-mcp (S50-0) | 45 min | WKWebView `<input type=password>` = `SecureTextField`, XCUITest kan inte skriva. Utforska: pre-seed session via API + deep link, biometri-bypass, Keychain AutoFill. Utan detta kan iOS login-flöde inte E2E-testas. |

---

## Parking lot

> Idéer som inte drivs nu. Återaktiveras vid behov/efterfrågan.

| Idé | Varför parkerad |
|-----|-----------------|
| Kund-offline (fas 4) | Parkerad 2026-04-17 — kunder har oftast nät, leverantörer är mobila. Återaktivera vid offline-klagomål eller expansion till sämre täckning. |
| Live Activity / Siri Shortcut (iOS) | Wow-features, ej kärnvärde. Återaktivera om demo-/marknadsföringsvärde behövs. |
| Leverantör ↔ leverantör community | Annan persona, annan moderering. Efter messaging-epic validerats. |
| Mät modellval per story (Opus/Sonnet/Haiku) | Metric-dimension i generate-metrics.sh. Efter 10+ stories/modell. |
| MFA-verify minor-fynd (security polish, post-S51-0) | MFA-admin är shippat. 6 minors (distinkta audit-log-strängar för success/failure, submit-disable efter 429, test-assertions på AdminAuditLog, m.fl.). Ej blockerande. Återaktivera om MFA-spåret/forensik prioriteras. |
| Granska "redan fixat"-rate grep-pattern | Metrics-process-justering. Vilande metrics-kadens. |
| S42-3 Full-suite flake-rapport | Flake-baseline, vilande sedan S42. Återaktivera vid flaky-test-problem. |
| Audit hårdkodade framtida datum i tester (time-bomb-audit) | Teknisk kvalitet, ej aktivt. Bevarad från main vid reconcile 2026-06-10. Pre-existing booking-series-fail (fixad 2026-05-14) hade rotorsak i hårdkodat `firstBookingDate: "2026-05-01"` som tickade ner till "förflutet" och bröt 8 tester. Risk: fler test-fixtures kan ha samma time-bomb. Åtgärd vid tillfälle: `grep -rE '"20[2-3][0-9]-[0-1][0-9]-[0-3][0-9]"' src/**/*.test.ts e2e/**`, byt till dynamiska datum där schemat har relativ validering, ev. ESLint/pre-commit-varning. Återaktivera om time-bomb-fail dyker upp igen. |

## Vid lansering

> Görs vid lansering, inte före (ingen trafik/extern klient ännu).

| Item | Effort | Motivering |
|------|--------|------------|
| Rate limit alerting → Sentry | 30 min | Ingen trafik ännu. |
| Log aggregation (Axiom/Logtail) | 0.5 dag | Sentry räcker för MVP. |
| Skew protection / rolling releases | 15 min | Kräver Vercel Pro. |
| CORS headers | 15 min | Inga externa klienter ännu (iOS same-origin via WKWebView). |
| A11y-testning (axe-core + Playwright) | 1 dag | WCAG 2.1 AA. |
| iOS accessibility audit (VoiceOver + Dynamic Type) | 0.5-1 dag | NFR-relevant. |
| Supabase Realtime | 1-2 dagar | Live-uppdatering via WebSocket, ersätter SWR-polling. |
| MFA för admin | 1 dag | Supabase TOTP. Kritiskt vid leverantör #2. |
| Lasttestning + prestandabaseline | 1-3 dagar | Vet inte om performance försämras vid volym. |

---

## Arkiv / Done

> Verifierat genomförda items, borttagna från aktiv backlog. Format: item — datum/sprint — bevis/PR.

### 2026-06 (Dagens rutt + betalnings-hardening)

| Item | När | Bevis |
|------|-----|-------|
| Dagens rutt MVP (vy + karta + kalenderingång) | 2026-06-07 | PR #367 |
| Dagens rutt: riktig körsträcka (OSRM) | 2026-06-07 | PR #367 |
| **Dubbel OSRM-call i Dagens rutt** | 2026-06-07 | **PR #370** — geometrin återanvänds via `precomputedRoutePath`-prop, 2→1 anrop. |
| CI quality gates på staging-PR:er + skip av tunga E2E | 2026-06-07 | PR #368 |
| CI: postgres-service bort från lint + type-check | 2026-06-07 | PR #370 |
| Geokoda demo-kunder + 3-stopps demodag | 2026-06-07 | PR #369 (slice 3) — [verifiering](../discovery/dagens-rutt-verifiering-2026-06.md) |
| Decouple Stripe webhook-verifiering från subscription-provider | 2026-06-06 | `StripeWebhookVerifier.ts`, `SUBSCRIPTION_PROVIDER=stripe` krävs ej längre. Config-cleanup klar (deploy `pp7wc26ne`). |
| Pre-existing booking-series-fail (8 tester, time-bomb) | 2026-05-14 | Dynamiskt datum istället för hårdkodat `2026-05-01`. Pre-push utan `--no-verify`. |
| Coverage-gap-krav för S43-2 batch-rapport | S43-2 | Uppfyllt; behålls som process-krav. |

### Tidigare (genomgång 2026-04-11)

| Item | Sprint | Bevis |
|------|--------|-------|
| Vercel Analytics | S9 | `@vercel/analytics` i package.json |
| Dependabot (+ auto-merge för patch) | S17 / S24-4 | `.github/dependabot.yml` + workflow |
| Supabase Auth (PoC + full migrering Fas 0-3) | S10-S13 | login/claims/RLS, dual-auth, NextAuth bort, iOS Swift SDK |
| RLS-migrering slice 1-6 | S14 | 28 policies, 7 domäner, 24 bevistester. Slice 7 struken — [arkitekturbeslut](../architecture/rls-roadmap.md#arkitekturbeslut-2026-04-11) |
| Voice logging polish | S7-5/S8-3 | Done-fil |
| customer_insights AI-spike | S8-2 | Riktig Anthropic API |
| Sonnet 4.5 → 4.6 | S9-4 | `claude-sonnet-4-6` alias |
| Confirm-route → withApiHandler | S17 | confirm/route.ts |
| Due-for-service iOS | S4 | Klar |
| Staging-databas / schema-isolation | S9-7 | Bekräftad |
| Preview-miljö ANTHROPIC_API_KEY | S17 | Konfigurerat |
| Stripe webhook idempotens + SubscriptionService guards | S21-1 | StripeWebhookEvent dedup, TERMINAL_STATES |
| Auth på /api/routing + blockera test-endpoints | S21-2 | getAuthUser + ALLOW_TEST_ENDPOINTS |
| Auth-routes cleanup (getClientIP, .strict(), 503) | S21-3 | 6 routes |
| Uptime-monitoring + Stripe webhook alerting | S21-4 | Betterstack + Stripe alerts docs |
| CSP pinning + HSTS preload + rate limiting | S21-5 | Pinnad CSP, preload |
| native-session-exchange Zod-validering | S21-3 | refreshToken via Zod |
| Onboarding-wizard (welcome + tom-states) | S22-1/2 | Live |
| Branch protection på GitHub | S22-4 | PR + CI obligatoriskt |
| Backup RPO/RTO + incident response-plan | S22-4 | `backup-policy.md`, `incident-runbook.md` |
| Smoke-test registreringsflödet | S22-5 | 25/25 gröna |
| Preview deploy-skydd | — | Vercel Auth via privat repo |
| BookingService refactoring (986→~600) | S24-1 | BookingValidation + DependencyFactory |
| ManualBookingDialog steg-split (752→~300) | S24-2 | Steg-komponenter |
| Haiku alias + Cron HMAC + CSP report-to | S24-3 | Säkerhetsfixar |
| CustomerCard tabs-extraktion (660→202) | S25-1 | Sektioner extraherade |
| PrismaBookingRepository gemensamma selects | S25-2 | Namngivna konstanter |

### Process & infra (verifierat klart 2026-06-07)

> Flyttade hit från "Arkiv / Kandidat" efter PO-review — koden/jobben finns redan.

| Item | Bevis |
|------|-------|
| Miljö-hardening-sprint (S48-kandidat) | `equinet-staging.johanlindengard.com` + separat Supabase + iOS staging-scheme + env-hierarki |
| Migrationstest på ren DB i CI | `migration-from-scratch`-jobbet i `quality-gates.yml` (`prisma migrate reset` från scratch) |
| Plan-commit-gate: hook + rule (S43-1) | `scripts/check-plan-commit.sh` + dokumenterat i CLAUDE.md |
| Sprint-avslut-gate: hook (S43→S44) | `scripts/check-sprint-closure.sh` |
| gh-pr-merge-wrapper (S47-4) | `scripts/gh-pr-merge.sh` + `check-own-pr-merge.sh` (enforcement/bort-beslutet bor i Process & tech-debt) |

### Superseded

| Item | Ersatt av |
|------|-----------|
| Tech-lead-review av sprint-avslut (hook, S45) | `scripts/check-sprint-closure.sh` (sprint-avslut-gate) — ingen separat tech-lead-hook behövs |

---

## Research

| Ämne | Status |
|------|--------|
| RLS med Prisma + Supabase | Klar (docs/research/rls-spike.md) |
| Voice logging AI-koppling | Klar (docs/research/voice-logging-spike.md) |
| Swish integration | Klar — Stripe + Swish rekommenderat |
| Parallella sessioner | Guide klar (docs/guides/parallel-sessions.md) |
| Supabase Auth (ersätta NextAuth) | Klar — PoC (S10), migrering (S11-S13) |
</content>
