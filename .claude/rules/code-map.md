# Kodkarta -- Domän till filer

> Genererad 2026-04-12. Använd denna för att snabbt hitta rätt filer vid implementation, review eller felsökning.

## Domäner

### booking (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/booking/BookingService.ts`, `BookingSeriesService.ts`, `TravelTimeService.ts` |
| Repository | `src/infrastructure/persistence/booking/PrismaBookingRepository.ts` (impl), `IBookingRepository.ts` (interface), `MockBookingRepository.ts` (test), `BookingMapper.ts` |
| Routes | `src/app/api/bookings/route.ts` (GET/POST), `[id]/route.ts` (GET/PUT/DELETE), `[id]/reschedule/route.ts`, `[id]/payment/route.ts`, `[id]/receipt/route.ts`, `manual/route.ts` |
| Routes (serier) | `src/app/api/booking-series/route.ts`, `[id]/route.ts`, `[id]/cancel/route.ts` |
| Routes (native) | `src/app/api/native/bookings/route.ts`, `[id]/quick-note/route.ts`, `[id]/review/route.ts` |
| Routes (provider) | `src/app/api/provider/bookings/[id]/notes/route.ts`, `[id]/quick-note/route.ts` |
| UI (provider) | `src/app/provider/bookings/page.tsx`, `calendar/page.tsx`, `dashboard/page.tsx` |
| UI (kund) | `src/app/customer/bookings/page.tsx` |
| Komponenter | `src/components/calendar/ManualBookingDialog.tsx`, `src/components/provider/OnboardingChecklist.tsx` |
| Cron | `src/app/api/cron/booking-reminders/route.ts` |

### auth

| Lager | Filer |
|-------|-------|
| Service | `src/domain/auth/AuthService.ts`, `GhostMergeService.ts` |
| Repository | `src/infrastructure/persistence/auth/PrismaAuthRepository.ts`, `IAuthRepository.ts`, `MockAuthRepository.ts` |
| Routes | `src/app/api/auth/register/route.ts`, `login` (Supabase-hanterat), `forgot-password/route.ts`, `reset-password/route.ts`, `verify-email/route.ts`, `resend-verification/route.ts`, `session/route.ts`, `accept-invite/route.ts`, `native-session-exchange/route.ts` |
| Lib | `src/lib/auth-dual.ts` (getAuthUser), `src/lib/auth-server.ts`, `src/lib/admin-auth.ts` |
| UI | `src/app/(auth)/login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `verify-email/page.tsx`, `check-email/page.tsx`, `accept-invite/page.tsx` |

### payment

| Lager | Filer |
|-------|-------|
| Service | `src/domain/payment/PaymentService.ts`, `PaymentWebhookService.ts`, `createPaymentService.ts`, `createPaymentWebhookService.ts` |
| Gateway | `src/domain/payment/PaymentGateway.ts` (interface), `StripePaymentGateway.ts` (impl) |
| Webhook | `src/app/api/webhooks/stripe/route.ts` |
| Idempotens | `src/infrastructure/persistence/stripe/stripeWebhookEventRepository.ts` |
| Routes | `src/app/api/bookings/[id]/payment/route.ts` |

### subscription

| Lager | Filer |
|-------|-------|
| Service | `src/domain/subscription/SubscriptionService.ts` |
| Gateway | `src/domain/subscription/SubscriptionGateway.ts` (interface), `StripeSubscriptionGateway.ts` (impl) |
| Repository | `src/infrastructure/persistence/subscription/SubscriptionRepository.ts`, `ISubscriptionRepository.ts`, `MockSubscriptionRepository.ts` |
| Routes | `src/app/api/provider/subscription/checkout/route.ts`, `portal/route.ts`, `status/route.ts` |

### horse (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/horse/HorseService.ts` |
| Repository | `src/infrastructure/persistence/horse/HorseRepository.ts`, `IHorseRepository.ts`, `MockHorseRepository.ts` |
| Routes | `src/app/api/horses/route.ts` (GET/POST), `[id]/route.ts`, `[id]/notes/route.ts`, `[id]/timeline/route.ts`, `[id]/profile/route.ts`, `[id]/export/route.ts`, `[id]/stable/route.ts` |
| Routes (provider) | `src/app/api/provider/customers/[customerId]/horses/route.ts`, `[horseId]/route.ts`, `provider/horses/[horseId]/interval/route.ts` |
| Routes (native) | `src/app/api/native/customers/[customerId]/horses/route.ts`, `[horseId]/route.ts` |
| UI | `src/app/provider/horse-timeline/[horseId]/page.tsx`, `src/app/customer/horses/[id]/page.tsx` |

### review + customer-review (kärndomäner)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/review/ReviewService.ts`, `src/domain/customer-review/CustomerReviewService.ts` |
| Repository | `src/infrastructure/persistence/review/ReviewRepository.ts`, `IReviewRepository.ts`, `MockReviewRepository.ts` |
| Repository (kundrecension) | `src/infrastructure/persistence/customer-review/CustomerReviewRepository.ts`, `ICustomerReviewRepository.ts`, `MockCustomerReviewRepository.ts` |
| Routes | `src/app/api/reviews/route.ts`, `[id]/route.ts`, `[id]/reply/route.ts`, `src/app/api/customer-reviews/route.ts`, `src/app/api/providers/[id]/reviews/route.ts` |
| UI | `src/app/provider/reviews/page.tsx` |

### follow (kärndomän)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/follow/FollowService.ts` |
| Repository | `src/infrastructure/persistence/follow/FollowRepository.ts`, `IFollowRepository.ts`, `MockFollowRepository.ts` |
| Routes | `src/app/api/follows/route.ts`, `[providerId]/route.ts` |

### group-booking

| Lager | Filer |
|-------|-------|
| Service | `src/domain/group-booking/GroupBookingService.ts` |
| Repository | `src/infrastructure/persistence/group-booking/GroupBookingRepository.ts`, `IGroupBookingRepository.ts`, `MockGroupBookingRepository.ts` |
| Routes | `src/app/api/group-bookings/route.ts`, `[id]/route.ts`, `[id]/match/route.ts`, `[id]/participants/[pid]/route.ts`, `available/route.ts`, `join/route.ts`, `preview/route.ts` |
| Routes (native) | `src/app/api/native/group-bookings/[id]/route.ts`, `[id]/match/route.ts`, `available/route.ts` |
| UI | `src/app/provider/group-bookings/page.tsx`, `[id]/page.tsx`, `src/app/customer/group-bookings/page.tsx`, `[id]/page.tsx`, `join/page.tsx`, `new/page.tsx` |

### stable

| Lager | Filer |
|-------|-------|
| Service | `src/domain/stable/StableService.ts`, `StableSpotService.ts`, `StableInviteService.ts` |
| Repository | `src/infrastructure/persistence/stable/PrismaStableRepository.ts`, `IStableRepository.ts`, `MockStableRepository.ts` |
| Repository (invites) | `src/infrastructure/persistence/stable-invite/PrismaStableInviteRepository.ts`, `IStableInviteRepository.ts`, `MockStableInviteRepository.ts` |
| Routes (auth) | `src/app/api/stable/profile/route.ts`, `invites/route.ts`, `invites/[id]/route.ts`, `spots/route.ts`, `spots/[spotId]/route.ts` |
| Routes (publik) | `src/app/api/stables/route.ts`, `[stableId]/route.ts`, `invites/[token]/route.ts`, `invites/[token]/accept/route.ts` |

### notification

| Lager | Filer |
|-------|-------|
| Service | `src/domain/notification/NotificationService.ts`, `PushDeliveryService.ts` |
| Routes | `src/app/api/notifications/route.ts`, `[id]/route.ts`, `unread-count/route.ts`, `src/app/api/admin/notifications/route.ts` |

### due-for-service

| Lager | Filer |
|-------|-------|
| Service | `src/domain/due-for-service/DueForServiceService.ts` |
| Routes | `src/app/api/provider/due-for-service/route.ts`, `src/app/api/customer/due-for-service/route.ts`, `src/app/api/native/due-for-service/route.ts` |
| UI | `src/app/provider/due-for-service/page.tsx` |

### voice-log

| Lager | Filer |
|-------|-------|
| Service | `src/domain/voice-log/VoiceInterpretationService.ts`, `VocabularyService.ts` |
| Routes | `src/app/api/voice-log/route.ts`, `confirm/route.ts` |

### customer-insight

| Lager | Filer |
|-------|-------|
| Service | `src/domain/customer-insight/CustomerInsightService.ts` |
| Routes | `src/app/api/provider/customers/[id]/insight/route.ts` (troligen) |

### municipality-watch

| Lager | Filer |
|-------|-------|
| Service | `src/domain/municipality-watch/MunicipalityWatchService.ts` |
| Repository | `src/infrastructure/persistence/municipality-watch/MunicipalityWatchRepository.ts`, `IMunicipalityWatchRepository.ts`, `MockMunicipalityWatchRepository.ts` |
| Routes | `src/app/api/municipality-watches/route.ts`, `[id]/route.ts` |

### reminder

| Lager | Filer |
|-------|-------|
| Service | `src/domain/reminder/ReminderService.ts`, `BookingReminderService.ts` |
| Cron | `src/app/api/cron/booking-reminders/route.ts`, `send-reminders/route.ts` |

### account

| Lager | Filer |
|-------|-------|
| Service | `src/domain/account/AccountDeletionService.ts` |
| Routes | `src/app/api/account/route.ts` (DELETE) |

---

## Tvärgående infrastruktur

| Vad | Fil |
|-----|-----|
| Auth helper | `src/lib/auth-dual.ts` (getAuthUser -- stödjer både cookie och Bearer JWT) |
| Auth server | `src/lib/auth-server.ts` |
| Admin auth | `src/lib/admin-auth.ts` (requireAdmin) |
| API handler wrapper | `src/lib/api-handler.ts` (withApiHandler -- auth + rate limit + error handling) |
| Rate limiting | `src/lib/rate-limit.ts` (Upstash Redis) |
| Prisma client | `src/lib/prisma.ts` |
| Supabase server | `src/lib/supabase/server.ts` |
| Supabase browser | `src/lib/supabase/browser.ts` |
| Logger (server) | `src/lib/logger.ts` |
| Logger (klient) | `src/lib/client-logger.ts` |
| Feature flags (server) | `src/lib/feature-flags.ts` |
| Feature flags (metadata) | `src/lib/feature-flag-definitions.ts` (klient-safe) |
| Feature flags (klient) | `src/components/providers/FeatureFlagProvider.tsx` |
| Email | `src/lib/email/index.ts`, `templates.ts` |
| Validering | Zod-scheman i respektive route-filer |

## UI-sidor

### Provider (leverantör)

| Sida | Fil |
|------|-----|
| Dashboard | `src/app/provider/dashboard/page.tsx` |
| Bokningar | `src/app/provider/bookings/page.tsx` |
| Kalender | `src/app/provider/calendar/page.tsx` |
| Kunder | `src/app/provider/customers/page.tsx` |
| Tjänster | `src/app/provider/services/page.tsx` |
| Profil | `src/app/provider/profile/page.tsx` |
| Recensioner | `src/app/provider/reviews/page.tsx` |
| Ruttplanering | `src/app/provider/route-planning/page.tsx` |
| Annonsering | `src/app/provider/announcements/page.tsx` |
| Dags för besök | `src/app/provider/due-for-service/page.tsx` |
| Insikter | `src/app/provider/insights/page.tsx` |
| Gruppbokningar | `src/app/provider/group-bookings/page.tsx` |
| Hjälpcentral | `src/app/provider/help/page.tsx` |
| Hästtidslinje | `src/app/provider/horse-timeline/[horseId]/page.tsx` |
| Export | `src/app/provider/export/page.tsx` |

### Kund

| Sida | Fil |
|------|-----|
| Bokningar | `src/app/customer/bookings/page.tsx` |
| Hästar | `src/app/customer/horses/[id]/page.tsx` |
| Gruppbokningar | `src/app/customer/group-bookings/page.tsx` |
| Hjälpcentral | `src/app/customer/help/page.tsx` |
| FAQ | `src/app/customer/faq/page.tsx` |
| Export | `src/app/customer/export/page.tsx` |

### Admin

| Sida | Fil |
|------|-----|
| Användare | `src/app/admin/users/page.tsx` |
| Bokningar | `src/app/admin/bookings/page.tsx` |
| Recensioner | `src/app/admin/reviews/page.tsx` |
| Verifieringar | `src/app/admin/verifications/page.tsx` |
| Notifikationer | `src/app/admin/notifications/page.tsx` |
| System | `src/app/admin/system/page.tsx` |
| Audit log | `src/app/admin/audit-log/page.tsx` |
| Buggrapporter | `src/app/admin/bug-reports/page.tsx` |
| Integrationer | `src/app/admin/integrations/page.tsx` |
