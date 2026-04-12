---
title: "Native Recensioner (SwiftUI) -- Design Spec"
description: "Migrera leverantörens recensionsvy från WebView till native SwiftUI med svar/ta bort-funktionalitet"
category: ios-native
status: draft
last_updated: 2026-03-17
sections:
  - Context
  - Feature Inventory
  - Arkitektur
  - API
  - Modeller
  - ViewModel
  - Vy
  - Integration
  - Testning
  - Verifiering
tags: [ios, swiftui, native, reviews, migration]
related:
  - docs/plans/ios-webview-inventory.md
  - docs/retrospectives/2026-03-14-native-ios-dashboard.md
---

# Native Recensioner (SwiftUI) -- Design Spec

## Context

Recensioner ar en av de sista Tier 1-skarmarna (alltid synliga) som fortfarande laddas via WebView. Den ar beskriven som "quick win" i inventeringen -- read-mostly med lag-medel komplexitet. Leverantörer (hovslagare, ridlarare) använder den for att se kundrecensioner och svara pa dem. Ofta i falt med smutsiga hander, sa faltanpassning ar viktigt.

### Mal

Migrera `/provider/reviews` fran WebView till native SwiftUI. Ge snabbare laddning, battre UX i falt, och offline-cache for lasning.

---

## Feature Inventory

| # | Feature | Webb | Native | Beslut |
|---|---------|------|--------|--------|
| 1 | Snittbetyg + antal i header | averageRating + totalCount | Ja | **Native** |
| 2 | Recensionslista (nyast forst) | ReviewList med Card | SwiftUI List | **Native** |
| 3 | Paginering (10 per sida) | page state + "Visa fler" | Ja, load more | **Native** |
| 4 | Stjarnbetyg (readonly) | StarRating-komponent | SF Symbols stjarnor | **Native** |
| 5 | Kundnamn + tjanstnamn | customer + booking.service | Ja | **Native** |
| 6 | Kommentar | Text i Card | Ja | **Native** |
| 7 | Leverantorssvar + datum | Gron box | Native styling | **Native** |
| 8 | Svara-knapp (oppnar sheet) | Dialog med VoiceTextarea | Sheet med TextField | **Native** |
| 9 | Ta bort svar | Delete-knapp i svarsbox | Swipe-action + bekraftelse | **Native** |
| 10 | Statusbadge (besvarad/obesvarad) | -- (saknas pa webben) | Orange/gron badge | **Native** (forbattring) |
| 11 | Pull-to-refresh | -- (saknas pa webben) | .refreshable | **Native** (forbattring) |
| 12 | VoiceTextarea (rost-till-text) | Web Speech API | -- | **Skip** (framtida iteration) |
| 13 | PendingSyncBadge (offline-status) | Visas vid svar | -- | **Skip** |
| 14 | useOfflineGuard | Blockerar mutation offline | NetworkMonitor-check | **Native** |
| 15 | Tom-state | Star-ikon + text | Native empty view | **Native** |
| 16 | Loading-state | Spinner | ProgressView | **Native** |
| 17 | Error-state | Toast | Alert / error-vy | **Native** |
| 18 | Datum pa review | createdAt | Ja | **Native** |
| 19 | Datum pa svar | repliedAt | Ja | **Native** |

---

## Arkitektur

```
NativeReviewsView
  +-- ReviewsViewModel (ags av AppCoordinator)
        +-- APIClient.fetchReviews()   -> GET /api/native/reviews
        +-- APIClient.submitReply()    -> POST /api/reviews/[id]/reply
        +-- APIClient.deleteReply()    -> DELETE /api/reviews/[id]/reply
```

### Dataflode

1. `NativeReviewsView` visas via NavigationStack i NativeMoreView
2. `.task` triggar `viewModel.loadReviews()`
3. APIClient gor Bearer JWT-autentiserat anrop till `/api/native/reviews`
4. ViewModel uppdaterar `reviews`, `totalCount`, `averageRating`
5. Mutation (svara/ta bort) gar via befintliga reply-endpoints

---

## API

### GET `/api/native/reviews` (ny endpoint)

**Auth:** Bearer JWT (authFromMobileToken)
**Rate limiting:** rateLimiters.api
**Query params:** `page` (default 1), `limit` (default 10, max 50)

**Response:**
```json
{
  "reviews": [
    {
      "id": "cuid",
      "rating": 5,
      "comment": "Fantastisk hovslagare!",
      "reply": "Tack sa mycket!",
      "repliedAt": "2026-03-10T14:30:00Z",
      "createdAt": "2026-03-08T09:15:00Z",
      "customerName": "Anna Andersson",
      "serviceName": "Hovverkning"
    }
  ],
  "totalCount": 12,
  "averageRating": 4.5,
  "page": 1,
  "limit": 10
}
```

**Lean select:** Bara falt som iOS-vyn anvander. `customerName` sammanslagen server-side (firstName + " " + lastName). Inga ID:n for kund/bokning/leverantor exponeras (inte nödvändigt for native-vyn).

### POST/DELETE `/api/reviews/[id]/reply` (befintliga endpoints -- KRAVER Ändring)

**Status:** Använder `await auth()` (NextAuth session) -- saknar `authFromMobileToken`-stod. Saknar ocksa `RateLimitServiceError`-hantering (inner try/catch). Maste andras.

**Ändringar:**
1. Lagg till `authFromMobileToken`-fallback (dual-auth): prova Bearer JWT forst, fallback till session
2. Lagg till inner try/catch for `RateLimitServiceError` -> 503 (api-routes.md-kravet)
3. Uppdatera befintliga tester + lagg till Bearer JWT-testfall

**POST response-shape:** Returnerar Prisma `Review` med `reviewSelect`: `{ id, rating, comment, bookingId, customerId, providerId, reply, repliedAt, createdAt, updatedAt }`. Saknar `customerName` och `serviceName` -- native APIClient mergar `reply` + `repliedAt` fran server-svaret in i befintligt `ReviewItem` (behaller lokala `customerName`/`serviceName`).

**DELETE response:** 204 No Content (ingen body).

---

## Modeller

### ReviewModels.swift (~50 rader)

```swift
struct ReviewItem: Codable, Identifiable, Sendable {
    let id: String
    let rating: Int
    let comment: String?
    let reply: String?
    let repliedAt: String?
    let createdAt: String
    let customerName: String
    let serviceName: String

    // Optimistic delete
    func withoutReply() -> ReviewItem { ... }

    // Server-side update (efter submitReply)
    func withReply(_ reply: String, repliedAt: String) -> ReviewItem { ... }

    var hasReply: Bool { reply != nil }
}

struct ReviewsResponse: Codable, Sendable {
    let reviews: [ReviewItem]
    let totalCount: Int
    let averageRating: Double?
    let page: Int
    let limit: Int
}

// Sheet-state (enum-pattern fran CustomerSheetType)
enum ReviewSheetType: Identifiable {
    case reply(ReviewItem)

    var id: String {
        switch self {
        case .reply(let review): return "reply-\(review.id)"
        }
    }
}
```

### StarRatingView.swift (~30 rader, ny ateranvandbar komponent)

Extraheras fran befintlig kod i NativeBookingsView och NativeDashboardView (2 platser idag + NativeReviewsView = 3, projektets extraktionsgrans). Stodjer bade readonly och interactive lage. 44pt minimum touch targets i interactive lage.

---

## ViewModel

### ReviewsViewModel.swift (~140 rader)

```
@Observable @MainActor final class ReviewsViewModel

@MainActor protocol ReviewsDataFetching: Sendable
  - fetchReviews(page: Int) async throws -> ReviewsResponse
  - submitReply(reviewId: String, text: String) async throws -> ReplyResponse
  - deleteReply(reviewId: String) async throws

ReplyResponse (minimal -- bara det servern returnerar):
  - reply: String
  - repliedAt: String

State:
  - reviews: [ReviewItem]
  - totalCount: Int
  - averageRating: Double?
  - currentPage: Int
  - hasMorePages: Bool (computed)
  - isLoading: Bool
  - isLoadingMore: Bool (separat fran isLoading)
  - error: String?
  - actionInProgress: String? (reviewId som muteras)

Methods:
  - loadReviews() -- hamtar forsta sidan, nollstaller state
  - loadMore() -- hamtar nasta sida, appendar till reviews
  - refresh() -- nollstaller page=1, hamtar pa nytt
  - submitReply(reviewId:text:) -> Bool -- INTE optimistisk, anvander server-svar
  - deleteReply(reviewId:) -- optimistisk med rollback
  - reset() -- rensar allt (anropas vid logout)
```

**Viktiga designbeslut:**

1. **submitReply ar INTE optimistisk** -- server-svaret innehaller `repliedAt`-timestamp. Optimistisk update med lokal `Date()` ger "hopp" i UI nar serverns timestamp ersatter. Istallet: visa loading pa submit-knappen, uppdatera med `reviewItem.withReply(response.reply, repliedAt: response.repliedAt)` -- mergar server-data in i befintligt objekt.

2. **deleteReply AR optimistisk** -- idempotent borttagning utan server-genererade varden. Spara `oldReview`, ta bort reply, revert vid fel.

3. **isLoadingMore separat fran isLoading** -- forhindrar race condition om pull-to-refresh triggas under "Visa fler"-laddning.

4. **Haptic feedback** -- `.success` vid lyckad reply/delete, `.error` vid misslyckad. Wrappa i `#if os(iOS)` + `import UIKit`.

5. **AppLogger** -- logga error via `AppLogger.network.error(...)` vid misslyckade anrop (konsistent med BookingsViewModel).

---

## Vy

### NativeReviewsView.swift (~280 rader)

**Struktur:**

**OBS:** Ingen egen NavigationStack -- vyn pushas inuti NativeMoreViews befintliga NavigationStack.

```
VStack(spacing: 0)
    +-- statsHeader (snittbetyg + antal)
    +-- content (@ViewBuilder)
        +-- loadingView (ProgressView)
        +-- errorView ("Forsok igen"-knapp)
        +-- emptyView (star-ikon + "Inga recensioner annu")
        +-- reviewsList (List med ReviewCard)
            +-- ForEach: ReviewCard
                +-- kundnamn + tjanst
                +-- StarRatingView (readonly)
                +-- kommentar (om finns)
                +-- statusbadge ("Besvarad" gron / "Obesvarad" orange vid <=3)
                +-- svarsbox (om finns): text + datum
                +-- "Svara"-knapp (om ej besvarad, disabled offline)
                +-- swipeActions trailing: "Ta bort svar" (om besvarad)
            +-- "Visa fler"-knapp (om hasMorePages)
    +-- .refreshable { await viewModel.refresh() }
    +-- .sheet(item: $activeSheet) { ReplySheet }
    +-- .confirmationDialog (for delete)
```

**Svarssheet (ReplySheet):**
- Kontext-box overst: kundnamn, stjarnbetyg, trunkerad kommentar (max 3 rader)
- TextField for svar (max 500 tkn)
- Teckenrakare
- Toolbar: "Avbryt" (dismiss) + "Skicka" (submit, disabled om tomt/loading)
- NetworkMonitor-guard: inaktivera "Skicka" offline

**Statusbadge-logik:**
- `hasReply == true`: Gron badge "Besvarad"
- `hasReply == false && rating <= 3`: Orange badge "Obesvarad"
- `hasReply == false && rating > 3`: Ingen badge (positivt utan svar ar ok)

**Tillgänglighet:**
- Stats-header: kombinerat label "Genomsnitt X av 5, baserat pa Y recensioner"
- Svarsbox: kombinerat label "Ditt svar, [datum]: [text]"
- Swipe-action: "Ta bort ditt svar" med hint
- Offline-disabled knapp: hint "Inte tillgängligt offline"
- Alla interaktiva element >= 44pt touch targets

---

## Integration

### AppCoordinator.swift (tillagg ~5 rader)

```swift
let reviewsViewModel: ReviewsViewModel  // ny property
// init: self.reviewsViewModel = reviewsViewModel ?? ReviewsViewModel()
```

### AuthManager (tillagg ~1 rad)

```swift
// I logout(): lagg till
coordinator.reviewsViewModel.reset()
```

### NativeMoreView.swift (tillagg ~5 rader)

```swift
// Ny parameter
@Bindable var reviewsViewModel: ReviewsViewModel

// I navigationDestination:
} else if item.path == "/provider/reviews" {
    NativeReviewsView(viewModel: reviewsViewModel)
}
```

### APIClient.swift (tillagg ~30 rader)

```swift
func fetchReviews(page: Int = 1) async throws -> ReviewsResponse
func submitReply(reviewId: String, text: String) async throws -> ReplyResponse
func deleteReply(reviewId: String) async throws
```

`submitReply` returnerar `ReplyResponse` (bara `reply` + `repliedAt`). ViewModel mergar dessa in i befintligt `ReviewItem`.

---

## Testning (BDD Dual-Loop)

### Backend -- `/api/native/reviews/route.test.ts`

**Yttre loop (integrationstest):**
- GET returnerar paginerade recensioner for inloggad leverantör

**Inre loop (unit-tester):**
- 401 nar ej autentiserad
- 429 vid rate limiting
- 503 vid rate limiter-fel (fail-closed)
- 400 vid ogiltiga query params
- 404 nar leverantör inte hittas
- 200 med korrekt paginering (page, limit, totalCount, averageRating)
- 200 tom state: reviews=[], totalCount=0, averageRating=null
- Paginering utanfor range: tom array
- limit clamping: >50 klampas till 50, <1 klampas till 1
- Lean select: inga kansliga falt i response (inget customerId, providerId, bookingId)

**Reply-endpoints (KRAVER ändring for dual-auth):**
- Testa Bearer JWT-auth for POST och DELETE
- Testa RateLimitServiceError -> 503 (ny hantering)
- Befintliga session-tester ska fortsatta fungera

### iOS -- ReviewsViewModelTests.swift

**Yttre loop (integrationstest):**
- loadReviews hamtar data och uppdaterar state korrekt

**Inre loop (unit-tester):**
- loadReviews satter isLoading + rensar error
- loadReviews hanterar error (visar felmeddelande)
- loadMore appendar till befintlig lista + okar page
- loadMore satter isLoadingMore (inte isLoading)
- refresh nollstaller page + hamtar pa nytt
- submitReply uppdaterar review med server-svar
- submitReply visar actionInProgress under anrop
- submitReply atergar vid error (ingen ändring i reviews)
- deleteReply tar bort reply optimistiskt
- deleteReply reverterar vid error
- hasMorePages computed property
- reset rensar alla state-variabler
- submitReply med tom text (forhindras i vy-lagret, ViewModel tar emot validerad text)
- deleteReply nar review ej finns i lokal array (defensive guard, no-op)

---

## Verifiering

### Automatisk

1. `xcodebuild test -only-testing:EquinetTests` -- alla iOS-tester grona
2. `npm run test:run` -- alla unit-tester grona
3. `npm run typecheck` -- inga TypeScript-fel

### Visuell (mobile-mcp)

1. Bygg + installera pa simulator
2. Navigera till Mer -> Recensioner
3. Verifiera: stats-header, recensionslista, stjarnbetyg, svarsbox, statusbadge
4. Svara pa en recension (sheet med kontext-box)
5. Ta bort svar (swipe + bekraftelse)
6. Tom state (leverantör utan recensioner)
7. Paginering (om >10 recensioner)
8. Pull-to-refresh

### Jamforelse webb vs native

Screenshot webb (`/provider/reviews`) bredvid native -- verifiera att alla datapunkter finns.

---

## Uppskattad storlek

| Fil | ~Rader | Typ |
|-----|--------|-----|
| ReviewModels.swift | 50 | Ny |
| StarRatingView.swift | 30 | Ny (ateranvandbar) |
| ReviewsViewModel.swift | 140 | Ny |
| NativeReviewsView.swift | 280 | Ny |
| APIClient.swift (tillagg) | 30 | Andrad |
| AppCoordinator.swift (tillagg) | 5 | Andrad |
| NativeMoreView.swift (tillagg) | 5 | Andrad |
| AuthenticatedView.swift (tillagg) | 1 | Andrad |
| /api/native/reviews/route.ts | 80 | Ny |
| /api/native/reviews/route.test.ts | 150 | Ny |
| /api/reviews/[id]/reply/route.ts (dual-auth) | 30 | Andrad |
| /api/reviews/[id]/reply/route.test.ts (nya tester) | 40 | Andrad |
| ReviewsViewModelTests.swift | 130 | Ny |
| **Totalt** | **~970** | |
