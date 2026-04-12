# Kodkarta -- Domän till filer

> Genererad 2026-04-12. Använd denna för att snabbt hitta rätt filer vid implementation, review eller felsökning.

## Domäner

### account

| Lager | Filer |
|-------|-------|
| Service | `src/domain/account/AccountDeletionService.ts` |
| Routes | `src/app/api/account/route.ts` |

### accounting

| Lager | Filer |
|-------|-------|
| Service | `src/domain/accounting/AccountingGateway.ts`, `src/domain/accounting/FortnoxGateway.ts` |

### auth (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/auth/AuthService.ts`, `src/domain/auth/GhostMergeService.ts`, `src/domain/auth/mapAuthErrorToStatus.ts` |
| Repository | `src/infrastructure/persistence/auth/IAuthRepository.ts`, `src/infrastructure/persistence/auth/MockAuthRepository.ts`, `src/infrastructure/persistence/auth/PrismaAuthRepository.ts` |
| Routes | `src/app/api/auth/accept-invite/route.ts`, `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/native-session-exchange/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/resend-verification/route.ts`, `src/app/api/auth/reset-password/route.ts`, `src/app/api/auth/session/route.ts`, `src/app/api/auth/verify-email/route.ts` |

### booking (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/booking/BookingEventHandlers.ts`, `src/domain/booking/BookingEvents.ts`, `src/domain/booking/BookingSeriesService.ts`, `src/domain/booking/BookingService.ts`, `src/domain/booking/BookingStatus.ts`, `src/domain/booking/mapBookingErrorToStatus.ts`, `src/domain/booking/TravelTimeService.ts` |
| Repository | `src/infrastructure/persistence/booking/BookingMapper.ts`, `src/infrastructure/persistence/booking/IBookingRepository.ts`, `src/infrastructure/persistence/booking/MockBookingRepository.ts`, `src/infrastructure/persistence/booking/PrismaBookingRepository.ts` |
| Routes | `src/app/api/bookings/[id]/payment/route.ts`, `src/app/api/bookings/[id]/receipt/route.ts`, `src/app/api/bookings/[id]/reschedule/route.ts`, `src/app/api/bookings/[id]/route.ts`, `src/app/api/bookings/manual/route.ts`, `src/app/api/bookings/route.ts`, `src/app/api/native/bookings/[id]/quick-note/route.ts`, `src/app/api/native/bookings/[id]/review/route.ts`, `src/app/api/native/bookings/route.ts`, `src/app/api/provider/bookings/[id]/notes/route.ts`, `src/app/api/provider/bookings/[id]/quick-note/route.ts` |

### customer-insight

| Lager | Filer |
|-------|-------|
| Service | `src/domain/customer-insight/CustomerInsightService.ts` |

### customer-review (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/customer-review/CustomerReviewService.ts`, `src/domain/customer-review/mapCustomerReviewErrorToStatus.ts` |
| Repository | `src/infrastructure/persistence/customer-review/CustomerReviewRepository.ts`, `src/infrastructure/persistence/customer-review/ICustomerReviewRepository.ts`, `src/infrastructure/persistence/customer-review/MockCustomerReviewRepository.ts` |
| Routes | `src/app/api/customer-reviews/route.ts` |

### due-for-service

| Lager | Filer |
|-------|-------|
| Service | `src/domain/due-for-service/DueForServiceCalculator.ts`, `src/domain/due-for-service/DueForServiceLookup.ts`, `src/domain/due-for-service/DueForServiceService.ts` |
| Routes | `src/app/api/native/due-for-service/route.ts`, `src/app/api/provider/due-for-service/route.ts` |

### follow (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/follow/FollowService.ts`, `src/domain/follow/FollowServiceFactory.ts` |
| Repository | `src/infrastructure/persistence/follow/FollowRepository.ts`, `src/infrastructure/persistence/follow/IFollowRepository.ts`, `src/infrastructure/persistence/follow/MockFollowRepository.ts` |
| Routes | `src/app/api/follows/[providerId]/route.ts`, `src/app/api/follows/route.ts` |

### group-booking (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/group-booking/GroupBookingService.ts`, `src/domain/group-booking/mapGroupBookingErrorToStatus.ts` |
| Repository | `src/infrastructure/persistence/group-booking/GroupBookingRepository.ts`, `src/infrastructure/persistence/group-booking/IGroupBookingRepository.ts`, `src/infrastructure/persistence/group-booking/MockGroupBookingRepository.ts` |
| Routes | `src/app/api/group-bookings/[id]/match/route.ts`, `src/app/api/group-bookings/[id]/participants/[pid]/route.ts`, `src/app/api/group-bookings/[id]/route.ts`, `src/app/api/group-bookings/available/route.ts`, `src/app/api/group-bookings/join/route.ts`, `src/app/api/group-bookings/preview/route.ts`, `src/app/api/group-bookings/route.ts`, `src/app/api/native/group-bookings/[id]/match/route.ts`, `src/app/api/native/group-bookings/[id]/route.ts`, `src/app/api/native/group-bookings/available/route.ts` |

### horse (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/horse/HorseService.ts`, `src/domain/horse/mapHorseErrorToStatus.ts` |
| Repository | `src/infrastructure/persistence/horse/HorseRepository.ts`, `src/infrastructure/persistence/horse/IHorseRepository.ts`, `src/infrastructure/persistence/horse/MockHorseRepository.ts` |
| Routes | `src/app/api/horses/[id]/export/route.ts`, `src/app/api/horses/[id]/notes/[noteId]/route.ts`, `src/app/api/horses/[id]/notes/route.ts`, `src/app/api/horses/[id]/profile/route.ts`, `src/app/api/horses/[id]/route.ts`, `src/app/api/horses/[id]/stable/route.ts`, `src/app/api/horses/[id]/timeline/route.ts`, `src/app/api/horses/route.ts`, `src/app/api/provider/horses/[horseId]/interval/route.ts` |

### municipality-watch (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/municipality-watch/MunicipalityWatchService.ts`, `src/domain/municipality-watch/MunicipalityWatchServiceFactory.ts` |
| Repository | `src/infrastructure/persistence/municipality-watch/IMunicipalityWatchRepository.ts`, `src/infrastructure/persistence/municipality-watch/MockMunicipalityWatchRepository.ts`, `src/infrastructure/persistence/municipality-watch/MunicipalityWatchRepository.ts` |

### notification

| Lager | Filer |
|-------|-------|
| Service | `src/domain/notification/NotificationService.ts`, `src/domain/notification/PushDeliveryService.ts`, `src/domain/notification/RouteAnnouncementNotifier.ts`, `src/domain/notification/RouteAnnouncementNotifierFactory.ts` |
| Routes | `src/app/api/notifications/[id]/route.ts`, `src/app/api/notifications/route.ts`, `src/app/api/notifications/unread-count/route.ts` |

### payment

| Lager | Filer |
|-------|-------|
| Service | `src/domain/payment/mapPaymentErrorToStatus.ts`, `src/domain/payment/PaymentGateway.ts`, `src/domain/payment/PaymentService.ts`, `src/domain/payment/PaymentWebhookService.ts`, `src/domain/payment/StripePaymentGateway.ts` |

### provider-customer-note (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/provider-customer-note/ProviderCustomerNoteService.ts` |
| Repository | `src/infrastructure/persistence/provider-customer-note/IProviderCustomerNoteRepository.ts`, `src/infrastructure/persistence/provider-customer-note/MockProviderCustomerNoteRepository.ts`, `src/infrastructure/persistence/provider-customer-note/PrismaProviderCustomerNoteRepository.ts` |

### reminder

| Lager | Filer |
|-------|-------|
| Service | `src/domain/reminder/BookingReminderService.ts`, `src/domain/reminder/ReminderService.ts` |

### review (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/review/mapReviewErrorToStatus.ts`, `src/domain/review/ReviewService.ts` |
| Repository | `src/infrastructure/persistence/review/IReviewRepository.ts`, `src/infrastructure/persistence/review/MockReviewRepository.ts`, `src/infrastructure/persistence/review/ReviewRepository.ts` |
| Routes | `src/app/api/native/reviews/route.ts`, `src/app/api/reviews/[id]/reply/route.ts`, `src/app/api/reviews/[id]/route.ts`, `src/app/api/reviews/route.ts` |

### shared

| Lager | Filer |
|-------|-------|
| Service | `src/domain/shared/Location.ts`, `src/domain/shared/TimeSlot.ts` |

### stable (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/stable/StableInviteService.ts`, `src/domain/stable/StableInviteServiceFactory.ts`, `src/domain/stable/StableService.ts`, `src/domain/stable/StableServiceFactory.ts`, `src/domain/stable/StableSpotService.ts`, `src/domain/stable/StableSpotServiceFactory.ts` |
| Repository | `src/infrastructure/persistence/stable/IStableRepository.ts`, `src/infrastructure/persistence/stable/MockStableRepository.ts`, `src/infrastructure/persistence/stable/PrismaStableRepository.ts` |
| Routes | `src/app/api/stable/invites/[id]/route.ts`, `src/app/api/stable/invites/route.ts`, `src/app/api/stable/profile/route.ts`, `src/app/api/stable/spots/[spotId]/route.ts`, `src/app/api/stable/spots/route.ts`, `src/app/api/stables/[stableId]/route.ts`, `src/app/api/stables/invites/[token]/accept/route.ts`, `src/app/api/stables/invites/[token]/route.ts`, `src/app/api/stables/route.ts` |

### subscription (kärndomän, repository obligatoriskt)

| Lager | Filer |
|-------|-------|
| Service | `src/domain/subscription/StripeSubscriptionGateway.ts`, `src/domain/subscription/SubscriptionGateway.ts`, `src/domain/subscription/SubscriptionService.ts`, `src/domain/subscription/SubscriptionServiceFactory.ts` |
| Repository | `src/infrastructure/persistence/subscription/ISubscriptionRepository.ts`, `src/infrastructure/persistence/subscription/MockSubscriptionRepository.ts`, `src/infrastructure/persistence/subscription/SubscriptionRepository.ts` |
| Routes | `src/app/api/provider/subscription/checkout/route.ts`, `src/app/api/provider/subscription/portal/route.ts`, `src/app/api/provider/subscription/status/route.ts` |

### voice-log

| Lager | Filer |
|-------|-------|
| Service | `src/domain/voice-log/VocabularyService.ts`, `src/domain/voice-log/VoiceInterpretationService.ts` |
| Routes | `src/app/api/voice-log/confirm/route.ts`, `src/app/api/voice-log/route.ts` |

---

## Tvärgående infrastruktur

| Vad | Fil |
|-----|-----|
| Auth helper | `src/lib/auth-dual.ts` |
| Auth server | `src/lib/auth-server.ts` |
| API handler wrapper | `src/lib/api-handler.ts` |
| Rate limiting | `src/lib/rate-limit.ts` |
| Prisma client | `src/lib/prisma.ts` |
| Supabase server | `src/lib/supabase/server.ts` |
| Supabase browser | `src/lib/supabase/browser.ts` |
| Logger (server) | `src/lib/logger.ts` |
| Logger (klient) | `src/lib/client-logger.ts` |
| Feature flags (server) | `src/lib/feature-flags.ts` |
| Feature flags (metadata) | `src/lib/feature-flag-definitions.ts` |
| Feature flags (klient) | `src/components/providers/FeatureFlagProvider.tsx` |
| Email | `src/lib/email/index.ts` |

## UI-sidor

### Provider (leverantör)

| Sida | Fil |
|------|-----|
| announcements/[id] | `src/app/provider/announcements/[id]/page.tsx` |
| announcements/new | `src/app/provider/announcements/new/page.tsx` |
| announcements | `src/app/provider/announcements/page.tsx` |
| bookings | `src/app/provider/bookings/page.tsx` |
| calendar | `src/app/provider/calendar/page.tsx` |
| customers | `src/app/provider/customers/page.tsx` |
| dashboard | `src/app/provider/dashboard/page.tsx` |
| debug | `src/app/provider/debug/page.tsx` |
| due-for-service | `src/app/provider/due-for-service/page.tsx` |
| export | `src/app/provider/export/page.tsx` |
| group-bookings/[id] | `src/app/provider/group-bookings/[id]/page.tsx` |
| group-bookings | `src/app/provider/group-bookings/page.tsx` |
| help/[slug] | `src/app/provider/help/[slug]/page.tsx` |
| help | `src/app/provider/help/page.tsx` |
| horse-timeline/[horseId] | `src/app/provider/horse-timeline/[horseId]/page.tsx` |
| insights | `src/app/provider/insights/page.tsx` |
| profile | `src/app/provider/profile/page.tsx` |
| reviews | `src/app/provider/reviews/page.tsx` |
| route-planning | `src/app/provider/route-planning/page.tsx` |
| routes/[id] | `src/app/provider/routes/[id]/page.tsx` |
| routes | `src/app/provider/routes/page.tsx` |
| services | `src/app/provider/services/page.tsx` |
| settings/integrations | `src/app/provider/settings/integrations/page.tsx` |
| verification | `src/app/provider/verification/page.tsx` |
| voice-log | `src/app/provider/voice-log/page.tsx` |

### Kund

| Sida | Fil |
|------|-----|
| bookings | `src/app/customer/bookings/page.tsx` |
| export | `src/app/customer/export/page.tsx` |
| faq | `src/app/customer/faq/page.tsx` |
| group-bookings/[id] | `src/app/customer/group-bookings/[id]/page.tsx` |
| group-bookings/join | `src/app/customer/group-bookings/join/page.tsx` |
| group-bookings/new | `src/app/customer/group-bookings/new/page.tsx` |
| group-bookings | `src/app/customer/group-bookings/page.tsx` |
| help/[slug] | `src/app/customer/help/[slug]/page.tsx` |
| help | `src/app/customer/help/page.tsx` |
| horses/[id] | `src/app/customer/horses/[id]/page.tsx` |
| horses | `src/app/customer/horses/page.tsx` |
| profile | `src/app/customer/profile/page.tsx` |

### Admin

| Sida | Fil |
|------|-----|
| audit-log | `src/app/admin/audit-log/page.tsx` |
| bookings | `src/app/admin/bookings/page.tsx` |
| bug-reports/[id] | `src/app/admin/bug-reports/[id]/page.tsx` |
| bug-reports | `src/app/admin/bug-reports/page.tsx` |
| help/[slug] | `src/app/admin/help/[slug]/page.tsx` |
| help | `src/app/admin/help/page.tsx` |
| integrations | `src/app/admin/integrations/page.tsx` |
| notifications | `src/app/admin/notifications/page.tsx` |
| page.tsx | `src/app/admin/page.tsx` |
| reviews | `src/app/admin/reviews/page.tsx` |
| system | `src/app/admin/system/page.tsx` |
| testing-guide | `src/app/admin/testing-guide/page.tsx` |
| users | `src/app/admin/users/page.tsx` |
| verifications | `src/app/admin/verifications/page.tsx` |


## Feature flag -> fil-mapping

> Vilka filer berörs om en flagga ändras? Genererat via grep.

### `voice_logging`

- `src/app/api/voice-log/confirm/route.ts`
- `src/app/api/voice-log/route.ts`
- `src/app/provider/bookings/page.tsx`
- `src/app/provider/calendar/page.tsx`
- `src/app/provider/dashboard/page.tsx`
- `src/components/layout/ProviderNav.tsx`

### `route_planning`

- `src/app/api/native/announcements/[id]/cancel/route.ts`
- `src/app/api/route-orders/[id]/bookings/route.ts`
- `src/app/api/route-orders/[id]/route.ts`
- `src/app/api/route-orders/announcements/route.ts`
- `src/app/api/route-orders/available/route.ts`
- `src/app/api/route-orders/my-orders/route.ts`
- `src/app/api/route-orders/route.ts`
- `src/app/api/routes/[id]/route.ts`
- `src/app/api/routes/[id]/stops/[stopId]/route.ts`
- `src/app/api/routes/my-routes/route.ts`
- `src/app/api/routes/route.ts`
- `src/app/provider/dashboard/page.tsx`
- `src/components/layout/ProviderNav.tsx`

### `route_announcements`

- `src/app/announcements/page.tsx`
- `src/app/api/native/announcements/[id]/detail/route.ts`
- `src/app/api/native/announcements/route.ts`
- `src/components/layout/ProviderNav.tsx`

### `customer_insights`

- `src/app/api/provider/customers/[customerId]/insights/route.ts`

### `due_for_service`

- `src/app/api/customer/due-for-service/route.ts`
- `src/app/api/customer/horses/[horseId]/intervals/route.ts`
- `src/app/api/native/due-for-service/route.ts`
- `src/app/api/provider/due-for-service/route.ts`
- `src/app/customer/horses/[id]/page.tsx`
- `src/components/layout/ProviderNav.tsx`
- `src/domain/notification/RouteAnnouncementNotifierFactory.ts`
- `src/hooks/useDueForService.ts`

### `group_bookings`

- `src/app/api/group-bookings/[id]/match/route.ts`
- `src/app/api/group-bookings/[id]/participants/[pid]/route.ts`
- `src/app/api/group-bookings/[id]/route.ts`
- `src/app/api/group-bookings/available/route.ts`
- `src/app/api/group-bookings/join/route.ts`
- `src/app/api/group-bookings/preview/route.ts`
- `src/app/api/group-bookings/route.ts`
- `src/app/api/native/group-bookings/[id]/match/route.ts`
- `src/app/api/native/group-bookings/[id]/route.ts`
- `src/app/api/native/group-bookings/available/route.ts`
- `src/components/layout/CustomerNav.tsx`
- `src/components/layout/ProviderNav.tsx`

### `business_insights`

- `src/app/api/native/insights/route.ts`
- `src/app/provider/insights/page.tsx`
- `src/components/layout/ProviderNav.tsx`

### `self_reschedule`

- `src/app/api/bookings/[id]/reschedule/route.ts`
- `src/app/provider/profile/page.tsx`

### `recurring_bookings`

- `src/app/api/booking-series/[id]/cancel/route.ts`
- `src/app/api/booking-series/[id]/route.ts`
- `src/app/api/booking-series/route.ts`
- `src/app/provider/profile/page.tsx`
- `src/components/booking/RecurringSection.tsx`
- `src/components/calendar/ManualBookingDialog.tsx`
- `src/domain/booking/BookingSeriesService.ts`

### `offline_mode`

- `src/app/provider/debug/page.tsx`
- `src/components/calendar/ManualBookingDialog.tsx`
- `src/components/provider/InstallPrompt.tsx`
- `src/components/provider/OfflineBanner.tsx`
- `src/components/providers/SWRProvider.tsx`
- `src/hooks/useDebugLogger.ts`
- `src/hooks/useMutationSync.ts`
- `src/hooks/useOfflineGuard.ts`
- `src/hooks/usePendingMutation.ts`

### `follow_provider`

- `src/app/api/follows/[providerId]/route.ts`
- `src/app/api/follows/route.ts`
- `src/app/api/route-orders/route.ts`
- `src/app/providers/[id]/page.tsx`
- `src/app/providers/page.tsx`

### `municipality_watch`

- `src/app/api/municipality-watches/[id]/route.ts`
- `src/app/api/municipality-watches/route.ts`
- `src/app/api/route-orders/route.ts`
- `src/app/customer/profile/page.tsx`
- `src/domain/notification/RouteAnnouncementNotifierFactory.ts`

### `provider_subscription`

- `src/app/api/provider/subscription/checkout/route.ts`
- `src/app/api/provider/subscription/portal/route.ts`
- `src/app/api/provider/subscription/status/route.ts`
- `src/app/provider/profile/page.tsx`
- `src/domain/subscription/SubscriptionServiceFactory.ts`

### `customer_invite`

- `src/app/api/auth/accept-invite/route.ts`
- `src/app/api/provider/customers/[customerId]/invite/route.ts`
- `src/app/api/provider/customers/[customerId]/merge/route.ts`

### `push_notifications`

- `src/app/api/device-tokens/route.ts`
- `src/domain/notification/PushDeliveryService.ts`

### `help_center`

- `src/app/customer/help/[slug]/page.tsx`
- `src/app/customer/help/page.tsx`
- `src/app/provider/help/[slug]/page.tsx`
- `src/app/provider/help/page.tsx`
- `src/app/provider/profile/page.tsx`
- `src/app/provider/route-planning/page.tsx`
- `src/app/provider/voice-log/page.tsx`
- `src/components/layout/CustomerNav.tsx`
- `src/components/layout/ProviderNav.tsx`

### `stable_profiles`

- `src/app/api/horses/[id]/stable/route.ts`
- `src/app/api/stable/invites/[id]/route.ts`
- `src/app/api/stable/invites/route.ts`
- `src/app/api/stable/profile/route.ts`
- `src/app/api/stable/spots/[spotId]/route.ts`
- `src/app/api/stable/spots/route.ts`
- `src/app/api/stables/[stableId]/route.ts`
- `src/app/api/stables/invites/[token]/accept/route.ts`
- `src/app/api/stables/invites/[token]/route.ts`
- `src/app/api/stables/route.ts`
- `src/app/customer/profile/page.tsx`
- `src/app/stable/invites/page.tsx`
- `src/app/stable/layout.tsx`
- `src/app/stables/[stableId]/page.tsx`
- `src/app/stables/page.tsx`
- `src/components/customer/horses/HorseInfoSection.tsx`
- `src/components/layout/CustomerNav.tsx`
- `src/components/layout/Header.tsx`

### `stripe_payments`

- `src/app/api/bookings/[id]/payment/route.ts`
- `src/app/customer/bookings/page.tsx`

### `demo_mode`

- `src/app/provider/debug/page.tsx`
- `src/app/provider/export/page.tsx`
- `src/app/provider/profile/page.tsx`
- `src/app/provider/reviews/page.tsx`
- `src/app/provider/routes/page.tsx`
- `src/app/provider/services/page.tsx`
- `src/app/provider/settings/integrations/page.tsx`
- `src/app/provider/verification/page.tsx`
- `src/components/layout/Header.tsx`

### `supabase_auth_poc`

- `src/app/api/v2/test-auth/route.ts`

