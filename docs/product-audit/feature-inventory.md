---
title: Feature Inventory
description: Fullständig inventering av alla features i Equinet -- status, roller, belägg
category: product-audit
status: active
last_updated: 2026-03-25
sections:
  - Sammanfattning
  - Kärnfeatures (alltid aktiva)
  - Feature-fläggade features (ON som default)
  - Feature-fläggade features (OFF som default)
  - Integrationer
  - Admin
  - iOS-app
---

# Feature Inventory -- Equinet

> Inventering baserad på faktisk kod, routes, tester och databasschema per 2026-03-25.
> Status: **fungerande** / **delvis fungerande** / **oklart** / **ej fungerande**
> "Fungerande" = kod + tester + API + UI finns. Det betyder INTE att det är verifierat i produktion.

---

## Sammanfattning

| Kategori | Antal features | Fungerande | Delvis | Oklart | Ej fungerande |
|----------|---------------|------------|--------|--------|---------------|
| Kärnfeatures (alltid aktiva) | 14 | 10 | 3 | 1 | 0 |
| Feature-fläggade (ON) | 12 | 7 | 4 | 1 | 0 |
| Feature-fläggade (OFF) | 4 | 0 | 2 | 2 | 0 |
| Integrationer | 3 | 0 | 1 | 2 | 0 |
| Admin | 6 | 4 | 2 | 0 | 0 |
| iOS-app | 8 | 5 | 2 | 1 | 0 |
| **Totalt** | **47** | **26** | **14** | **5** | **0** |

---

## Kärnfeatures (alltid aktiva)

### 1. Registrering & Inloggning
- **Beskrivning**: Användare registrerar sig som kund eller leverantör. Email + lösenord via NextAuth v5.
- **Roll**: Kund, Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/(auth)/`, `src/app/api/auth/`, `src/domain/auth/AuthService.ts`
- **Belägg**: 20+ tester i AuthService, registrerings-/inloggningssidor, email-verifieringsflöde, lösenordsåterställning. E2E-tester loggar in framgångsrikt.
- **Oklart**: Email-utskick (SMTP) -- kräver konfigurerad SMTP-server. Oklart om verifierings-email faktiskt levereras i produktion.

### 2. Leverantörsprofil
- **Beskrivning**: Leverantör fyller i företagsinfo, adress, beskrivning, profilbild, tjänsteområde.
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/provider/profile/`, `src/app/api/provider/profile/`, `src/app/api/providers/[id]/`
- **Belägg**: GET/PUT routes med tester, UI-sida med formulärdialog, onboarding-checklista.

### 3. Tjänstehantering
- **Beskrivning**: Leverantör skapar/redigerar/tar bort tjänster (namn, pris, tid, rekommenderat intervall).
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/provider/services/`, `src/app/api/services/`
- **Belägg**: CRUD API med tester, UI-sida.

### 4. Tillgänglighetsschema
- **Beskrivning**: Leverantör sätter veckoschema (dag + tider) och undantag (lediga dagar, platser).
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/api/providers/[id]/availability-schedule/`, `src/app/api/providers/[id]/availability-exceptions/`
- **Belägg**: GET/PUT/POST/DELETE routes med tester. UI i provider/profile?tab=availability.

### 5. Bokning (kundskapad)
- **Beskrivning**: Kund bokar en tjänst hos en leverantör för ett specifikt datum/tid.
- **Roll**: Kund
- **Status**: **Fungerande**
- **Kod**: `src/app/api/bookings/`, `src/domain/booking/BookingService.ts`
- **Belägg**: 29.8 KB service, 49.4 KB tester. Overlapskontroll, tidsvalidering, statusövergångår (pending -> confirmed -> completed). E2E-tester för bokningsflöde.

### 6. Manuell bokning (leverantör)
- **Beskrivning**: Leverantör skapar bokning at en kund (inkl. "spök-kunder" utan konto).
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/api/bookings/manual/`, `src/domain/booking/BookingService.ts`
- **Belägg**: POST route med tester. Stöd för `isManualBooking` + `createdByProviderId` i schema. Ghost-customer-logik i AuthService.

### 7. Bokningshantering (status)
- **Beskrivning**: Leverantör bekräftar, slutför eller avbokar bokningar. Kund kan avboka.
- **Roll**: Kund, Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/api/bookings/[id]/`, `src/domain/booking/BookingStatus.ts`
- **Belägg**: PUT/DELETE routes med tester. Statusövergångslogik testad. E2E-tester.

### 8. Hästhantering
- **Beskrivning**: Kund skapar hästprofiler med ras, födelseår, specialbehov, registreringsnummer.
- **Roll**: Kund
- **Status**: **Fungerande**
- **Kod**: `src/app/customer/horses/`, `src/app/api/horses/`, `src/domain/horse/HorseService.ts`
- **Belägg**: 12.7 KB service, 15.7 KB tester. CRUD API + UI-sida + tidslinje.

### 9. Kundregister (leverantör)
- **Beskrivning**: Leverantör ser alla sina kunder, kan lägga till manuella kunder, anteckningar, hästar.
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/provider/customers/`, `src/app/api/provider/customers/`
- **Belägg**: GET/POST/PUT/DELETE routes med tester. UI-sida med sök och filter.

### 10. Recensioner (kund -> leverantör)
- **Beskrivning**: Kund betygsätter leverantör (1-5 stjärnor + kommentar). Leverantör kan svara.
- **Roll**: Kund, Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/api/reviews/`, `src/domain/review/ReviewService.ts`
- **Belägg**: 6.5 KB service, 8.5 KB tester. CRUD + svar-funktionalitet. Publik endpoint för leverantörsprofil.

### 11. Kundrecensioner (leverantör -> kund)
- **Beskrivning**: Leverantör betygsätter kund efter bokning. Immutable.
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/api/customer-reviews/`, `src/domain/customer-review/CustomerReviewService.ts`
- **Belägg**: 3.1 KB service, 4.1 KB tester.

### 12. Leverantorssök (publik)
- **Beskrivning**: Sokmotorn för att hitta leverantörer baserat på plats, avstand, tjänst.
- **Roll**: Kund, Publik
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/providers/`, `src/app/api/providers/`
- **Belägg**: GET route returnerar leverantörer med avståndsfiltrering. UI med ProviderGrid.
- **Oklart**: Sokning kräver geocoding (Mapbox API). Utan seed-data eller riktiga leverantörer visas tom lista. Filtrering kan vara begränsad.

### 13. Notiser (in-app)
- **Beskrivning**: Användare får notiser om bokningar, ruttannonser, etc.
- **Roll**: Kund, Leverantör
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/api/notifications/`, `src/domain/notification/NotificationService.ts`
- **Belägg**: CRUD routes, unread-count endpoint. 17.1 KB service, 19.8 KB tester. UI i notifications-sida.
- **Oklart**: Push-notiser till iOS kräver APNs-konfiguration (feature flåg `push_notifications` är OFF). Web push via `PushSubscription` verkar vara stub.

### 14. Betalning & Kvitto
- **Beskrivning**: Betalning för bokning (mock/Stripe/Swish). Kvittogenerering.
- **Roll**: Kund
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/api/bookings/[id]/payment/`, `src/app/api/bookings/[id]/receipt/`, `src/domain/payment/`
- **Belägg**: PaymentService (5.5 KB), tester. Mock-provider fungerar. Stripe-integration finns men kräver konfiguration.
- **Oklart**: Swish-betalning verkar vara bara ett enum-värde, ingen faktisk integration. Stripe-webhook finns men oklart om fullt testad i prod.

---

## Feature-fläggade features (ON som default)

### 15. Återkommande bokningar (`recurring_bookings`)
- **Beskrivning**: Leverantör skapar bokningsserier (t.ex. vär 6:e vecka).
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/api/booking-series/`, `src/domain/booking/BookingSeriesService.ts`
- **Belägg**: 3 API routes med tester, feature-fläggat både route-niva och service-niva (defense in depth). Mergat session 38.

### 16. Ruttplanering (`route_planning`)
- **Beskrivning**: Leverantör planerar rutter med stopp, optimerar ordning, skapar bokningar per stopp.
- **Roll**: Leverantör
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/provider/routes/`, `src/app/provider/route-planning/`, `src/app/api/routes/`, `src/app/api/route-orders/`
- **Belägg**: 11 API routes för rutter + ruttordrar. UI-sidor för ruttplanering + ruttlista. Optimeringsstod via OSRM.
- **Oklart**: Route-optimering kräver extern OSRM-tjänst. Kartvisning kräver Mapbox-token. Komplexitet gör det svårt att verifiera utan integration.

### 17. Ruttannonser (`route_announcements`)
- **Beskrivning**: Leverantör annonserar rutter; kunder som följer eller bevakar kommunen får notiser.
- **Roll**: Leverantör, Kund
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/announcements/`, `src/app/api/route-orders/announcements/`, `src/domain/notification/RouteAnnouncementNotifier.ts`
- **Belägg**: Publik sida för annonsering, notifier med dedup-tabell.
- **Oklart**: Beror på route_planning + follow_provider + municipality_watch för att ge fullt värde.

### 18. Kundinsikter (`customer_insights`)
- **Beskrivning**: AI-genererade insikter om kundens bokningsmönster.
- **Roll**: Leverantör
- **Status**: **Oklart**
- **Kod**: `src/app/api/provider/customers/[customerId]/insights/`, `src/domain/customer-insight/CustomerInsightService.ts`
- **Belägg**: 9.3 KB service, 8.9 KB tester. API route finns.
- **Oklart**: "AI-genererade" -- oklart om det använder extern AI-tjänst eller enkel statistik. Tester mockar bort externt anrop sa det går inte att veta om det faktiskt fungerar med en AI-provider.

### 19. Besöksplanering (`due_for_service`)
- **Beskrivning**: Visar hästar som snart behöver service baserat på intervall.
- **Roll**: Leverantör, Kund
- **Status**: **Fungerande**
- **Kod**: `src/app/provider/due-for-service/`, `src/app/api/provider/due-for-service/`, `src/app/api/customer/due-for-service/`
- **Belägg**: 4.5 KB service, 10.5 KB tester. Beräknar baserat på senaste bokning + intervall. Både leverantör- och kundvy.

### 20. Gruppbokningar (`group_bookings`)
- **Beskrivning**: Kunder skapar gemensamma bokningsförfrågan (t.ex. hovslagare till stället).
- **Roll**: Kund
- **Status**: **Fungerande**
- **Kod**: `src/app/customer/group-bookings/`, `src/app/api/group-bookings/`, `src/domain/group-booking/GroupBookingService.ts`
- **Belägg**: 7 API routes, 18.9 KB service, 19.2 KB tester. UI för skapa, ga med, hantera.

### 21. Affärsinsikter (`business_insights`)
- **Beskrivning**: Analys av intäkter, kundretention, tjänstefördelning.
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `src/app/provider/insights/`, `src/app/api/provider/insights/`
- **Belägg**: API route med tester. UI-sida. Feature-fläggad.

### 22. Sjalvservice-ombokning (`self_reschedule`)
- **Beskrivning**: Kund kan boka om bekräftade bokningar (med/utan leverantörsgodkännande).
- **Roll**: Kund
- **Status**: **Fungerande**
- **Kod**: `src/app/api/bookings/[id]/reschedule/`
- **Belägg**: PATCH route med tester. Provider-inställningår för godkännandekrav, maxantal ombokningar, tidslimit.

### 23. Följ leverantör (`follow_provider`)
- **Beskrivning**: Kund följer leverantör för att fa ruttannonser.
- **Roll**: Kund
- **Status**: **Fungerande**
- **Kod**: `src/app/api/follows/`, `src/domain/follow/FollowService.ts`
- **Belägg**: 1.8 KB service, 3.4 KB tester. GET/POST/DELETE routes.

### 24. Bevaka kommun (`municipality_watch`)
- **Beskrivning**: Kund bevakar en kommun + tjänstetyp för notiser när leverantör annonserar.
- **Roll**: Kund
- **Status**: **Fungerande**
- **Kod**: `src/app/api/municipality-watches/`, `src/domain/municipality-watch/MunicipalityWatchService.ts`
- **Belägg**: 1.8 KB service, 4.0 KB tester. GET/POST/DELETE routes.

### 25. Offlineläge (`offline_mode`)
- **Beskrivning**: PWA med offline-cachning, mutationsko, sync-motor.
- **Roll**: Leverantör (primäranvändare)
- **Status**: **Delvis fungerande**
- **Kod**: `src/lib/offline/`, `src/sw.ts`
- **Belägg**: Omfattande implementation: sync-engine, mutation-queue, circuit breaker, tab-koordinering. 11 entity types.
- **Oklart**: Komplexitet gör det svårt att verifiera. Härdning gjord (session 78) men inga E2E-tester för offline-scenarion. Service Worker kräver HTTPS för att fungera (ej localhost).

### 26. Hjalpcentral (`help_center`)
- **Beskrivning**: Inbyggd FAQ med sökbara artiklar för leverantör, kund och admin.
- **Roll**: Alla
- **Status**: **Fungerande**
- **Kod**: `src/app/provider/help/`, `src/app/customer/help/`, `src/lib/help/`
- **Belägg**: Sidor för både leverantör och kund. Artiklar i kod (ingen CMS).

---

## Feature-fläggade features (OFF som default)

### 27. Leverantörsprenumeration (`provider_subscription` / `stripe_subscriptions`)
- **Beskrivning**: Leverantör betalar månatlig avgift via Stripe.
- **Roll**: Leverantör
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/api/provider/subscription/`, `src/domain/subscription/SubscriptionService.ts`, `src/app/api/webhooks/stripe/`
- **Belägg**: 5.4 KB service, 8.1 KB tester. Checkout + portal + webhook routes. StripeSubscriptionGateway.
- **Oklart**: Kräver Stripe-konto med konfigurerade produkter/priser. Webhook-signaturverifiering finns men oklart om testad i prod.

### 28. Kundinbjudan (`customer_invite`)
- **Beskrivning**: Leverantör bjuder in manuellt skapade kunder att skapa konto.
- **Roll**: Leverantör
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/api/provider/customers/[customerId]/invite/`, `src/app/(auth)/accept-invite/`
- **Belägg**: POST route + accept-invite-sida. Invite-token i databasen.
- **Oklart**: Kräver SMTP för email-utskick. Inbjudningslanken måste testas end-to-end.

### 29. Push-notiser (`push_notifications`)
- **Beskrivning**: Skicka push-notiser till iOS-appen via APNs.
- **Roll**: Alla
- **Status**: **Oklart**
- **Kod**: `src/app/api/device-tokens/`, `src/domain/notification/PushDeliveryService.ts`
- **Belägg**: DeviceToken-modell i schema. POST/DELETE för token-registrering. PushDeliveryService.
- **Oklart**: Kräver Apple Developer-konto, APNs-certifikat, konfigurerade env-variabler. Ingen uppenbar integration med Apple Push Notification Service i koden.

### 30. Stallprofiler (`stable_profiles` / `stable_management`)
- **Beskrivning**: Stallägare skapar profil, publicerar lediga platser, bjuder in medlemmar.
- **Roll**: Stallägare
- **Status**: **Oklart**
- **Kod**: `src/app/stable/`, `src/app/api/stable/`, `src/app/api/stables/`, `src/domain/stable/`
- **Belägg**: 9 API routes, domantjänst (1.7 KB service, 3.1 KB tester), UI-sidor för dashboard/profil/platser/inbjudningar. Feature-fläggat i layout.
- **Oklart**: Liten service (1.7 KB) och fa tester. Oklart om stall-till-hast-koppling (horseId.stableId) fungerar som tankt. Aldrig ON i produktion.

---

## Integrationer

### 31. Fortnox (fakturering)
- **Beskrivning**: Synka fakturor till Fortnox bokföringssystem.
- **Roll**: Leverantör
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/api/integrations/fortnox/`, `src/domain/accounting/FortnoxGateway.ts`
- **Belägg**: OAuth-flöde (connect/callback/disconnect), sync-route, FortnoxGateway.
- **Oklart**: Kräver Fortnox API-nyckel. Tokens krypteras med AES-256-GCM. Ingen uppenbar E2E-test.

### 32. Stripe (betalning + prenumeration)
- **Beskrivning**: Betalning per bokning + månatlig prenumeration för leverantörer.
- **Roll**: Kund (bokning), Leverantör (prenumeration)
- **Status**: **Oklart**
- **Kod**: `src/app/api/webhooks/stripe/`, `src/app/api/bookings/[id]/payment/`, `src/domain/payment/`, `src/domain/subscription/`
- **Belägg**: Webhook-route, PaymentService, SubscriptionService, StripeSubscriptionGateway. Mock-provider som fallback.
- **Oklart**: Kräver STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, konfigurerade priser. Betalning har `provider: 'mock'` som default.

### 33. Mapbox (geocoding + kartor)
- **Beskrivning**: Adressökning, kartrendering, avståndsberäkning.
- **Roll**: System
- **Status**: **Oklart**
- **Kod**: `src/app/api/geocode/`, `src/lib/geo/`
- **Belägg**: Geocode route, Haversine-beräkning. Kartkomponenter.
- **Oklart**: Kräver MAPBOX_ACCESS_TOKEN. Utan token fungerar varken sok, kartor eller avståndsfiltrering.

---

## Admin

### 34. Anvandarhantering
- **Beskrivning**: Admin listar, söker och hanterar användare (blockera, ändra roll).
- **Roll**: Admin
- **Status**: **Fungerande**
- **Kod**: `src/app/admin/users/`, `src/app/api/admin/users/`
- **Belägg**: GET/PATCH routes med tester. UI-sida med sök och filter.

### 35. Bokningsövervakning
- **Beskrivning**: Admin ser alla bokningar i systemet.
- **Roll**: Admin
- **Status**: **Fungerande**
- **Kod**: `src/app/admin/bookings/`, `src/app/api/admin/bookings/`
- **Belägg**: GET/PATCH routes. UI-sida.

### 36. Feature Flag-hantering
- **Beskrivning**: Admin slår av/pa feature flags via dashboard.
- **Roll**: Admin
- **Status**: **Fungerande**
- **Kod**: `src/app/admin/system/`, `src/app/api/admin/system/`
- **Belägg**: UI med toggle för varje flägga. Skriver till databas.

### 37. Recensionsmoderation
- **Beskrivning**: Admin kan ta bort olämpliga recensioner.
- **Roll**: Admin
- **Status**: **Fungerande**
- **Kod**: `src/app/admin/reviews/`, `src/app/api/admin/reviews/`
- **Belägg**: GET/DELETE routes.

### 38. Leverantörsverifiering
- **Beskrivning**: Admin granskar och godkänner leverantörers legitimationer.
- **Roll**: Admin
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/admin/verifications/`, `src/app/api/admin/verification-requests/`
- **Belägg**: GET/PUT routes. UI-sida.
- **Oklart**: Verifieringsstatuser (pending/approved/rejected) finns men oklart hur det påverkar leverantörens synlighet.

### 39. Buggrapporter
- **Beskrivning**: Användare rapporterar buggar; admin hanterar dem.
- **Roll**: Alla -> Admin
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/api/bug-reports/`, `src/app/admin/bug-reports/`
- **Belägg**: POST (användare), GET/PATCH (admin). BugReportFab-komponent i layout.
- **Oklart**: Fälande meddelande-flöde. Admin får ingen notis om nya rapporter.

---

## iOS-app

### 40. Native Dashboard
- **Beskrivning**: SwiftUI-dashboard med statistik, väntande bokningar, prioriterade åtgärder.
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `ios/Equinet/Equinet/NativeDashboardView.swift`, `src/app/api/native/dashboard/`
- **Belägg**: Aggregerat API-anrop, SharedDataManager-cache. Klart session 99.

### 41. Native Bokningår (kalender)
- **Beskrivning**: SwiftUI-kalendervy med bokningar, scroll-paging.
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `ios/Equinet/Equinet/NativeCalendarView.swift`, `src/app/api/native/bookings/`
- **Belägg**: Kalendermodeller, ViewModel, klart session 99b.

### 42. Native Kunder
- **Beskrivning**: SwiftUI-kundlista med sok, hästhantering, anteckningar.
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `ios/Equinet/Equinet/NativeCustomersView.swift`, `src/app/api/native/customers/`
- **Belägg**: ViewModel (21 tester), klart session 100.

### 43. Native Tjänster
- **Beskrivning**: SwiftUI-tjänstehantering med CRUD.
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `ios/Equinet/Equinet/NativeServicesView.swift`, `src/app/api/native/services/`
- **Belägg**: ViewModel (17 tester), klart session 101.

### 44. Native Profil
- **Beskrivning**: SwiftUI-profilvy med personlig info, företagsinfo, installningar.
- **Roll**: Leverantör
- **Status**: **Fungerande**
- **Kod**: `ios/Equinet/Equinet/NativeProfileView.swift`, `src/app/api/native/provider/profile/`
- **Belägg**: ViewModel (13 tester), klart session 107.

### 45. Native Mer-flik
- **Beskrivning**: Navigationsmeny med 11 alternativ, feature flag-filtrering.
- **Roll**: Leverantör
- **Status**: **Delvis fungerande**
- **Kod**: `ios/Equinet/Equinet/NativeMoreView.swift`
- **Belägg**: 12 tester, feature flag-filtrering via UserDefaults-cache. Klart session 104.
- **Oklart**: Många menyalternativ laddar WebView-sidor -- beroende på att webbsidorna fungerar.

### 46. Rostloggning (voice-log)
- **Beskrivning**: Leverantör pratar in arbetsnoteringar som tolkas av AI.
- **Roll**: Leverantör
- **Status**: **Delvis fungerande**
- **Kod**: `src/app/provider/voice-log/`, `src/app/api/voice-log/`, `src/domain/voice-log/VoiceInterpretationService.ts`, `ios/Equinet/Equinet/SpeechRecognizer.swift`
- **Belägg**: 16.4 KB service, 21.9 KB tester. iOS SpeechRecognizer med 12 tester. API routes för post + confirm.
- **Oklart**: Kräver AI-tjänst (OpenAI?) för tolkning. Oklart om faktisk AI-integration är konfigurerad.

### 47. Kalendersynk (EventKit)
- **Beskrivning**: Synkar bokningar till iOS-kalender.
- **Roll**: Leverantör
- **Status**: **Fungerande** (kod finns, 7 tester)
- **Kod**: `ios/Equinet/Equinet/CalendarSyncManager.swift`
- **Belägg**: 7 tester i CalendarSyncManager. Mapping bookingId -> eventIdentifier.
- **Oklart**: Kräver EventKit-tillstand på enheten.

---

## Features som INTE är implementerade (men som schema/modeller antyder)

- **Swish-betalning**: Enum-värde i Payment.provider men ingen integration
- **Web Push (browser)**: PushSubscription-modell finns men ingen VAPID-implementation
- **Flerspråkighet**: Hårdkodad svenska overallt, ingen i18n-setup
- **SMS-notiser**: NotificationDelivery har 'sms' som möjlig kanal men ingen SMS-gateway
