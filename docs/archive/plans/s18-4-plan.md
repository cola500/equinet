---
title: "S18-4: Profilbild native"
description: "Native PhotosPicker for profile image upload, replacing WebView offload"
category: plan
status: wip
last_updated: 2026-04-09
sections:
  - Scope
  - Approach
  - Filer
  - TDD
  - Risker
---

# S18-4: Profilbild native

## Scope

Ersatt WebView-offload ("Byt bild" -> web) med native PhotosPicker.
Ny API endpoint for Bearer auth upload. APIClient multipart-stod.

## Approach

1. **API** (`/api/native/provider/upload/route.ts`):
   - POST multipart/form-data med Bearer auth (via `getAuthUser`)
   - Rate limiting, filvalidering (validateFile), Supabase Storage upload
   - Uppdaterar Provider.profileImageUrl
   - Returnerar `{ url }`

2. **API test** (BDD dual-loop):
   - Yttre: POST med mock multipart -> 201 + url
   - 401 utan auth, 400 utan fil, 400 for stor fil

3. **APIClient** (`APIClient.swift`):
   - `uploadProfileImage(imageData: Data) async throws -> String` (returnerar URL)
   - Multipart form-data encoding med boundary

4. **ProfileViewModel** (`ProfileViewModel.swift`):
   - `uploadProfileImage(_ imageData: Data) async -> Bool`
   - Uppdaterar `profile.profileImageUrl` efter lyckad upload

5. **NativeProfileView** (`NativeProfileView.swift`):
   - `PhotosPicker` (SwiftUI, iOS 16+) ersatter "Byt bild" -> web
   - Komprimering: UIImage -> JPEG (max 1MB, stegvis compressionQuality)
   - Progress-indikator under upload

## Filer

| Fil | Aktion |
|-----|--------|
| `src/app/api/native/provider/upload/route.ts` | Ny |
| `src/app/api/native/provider/upload/route.test.ts` | Ny |
| `ios/Equinet/Equinet/APIClient.swift` | Redigera (lagg till uploadProfileImage) |
| `ios/Equinet/Equinet/ProfileViewModel.swift` | Redigera (lagg till upload-metod) |
| `ios/Equinet/Equinet/NativeProfileView.swift` | Redigera (PhotosPicker) |
| `ios/Equinet/EquinetTests/ProfileViewModelTests.swift` | Redigera (upload-test) |

## TDD

Webb (Vitest BDD):
- `testUploadReturns201WithUrl` -- lyckad upload
- `testUploadReturns401WithoutAuth` -- saknad auth
- `testUploadReturns400WithoutFile` -- saknad fil
- `testUploadReturns429WhenRateLimited` -- rate limit

iOS (XCTest):
- `testUploadProfileImageSuccess` -- mock API returns URL
- `testUploadProfileImageUpdatesProfile` -- profileImageUrl uppdateras

## Risker

- **Supabase Storage**: Ateranvander befintlig `uploadFile` -- beprovat monster
- **Multipart i APIClient**: Ny kapabilitet, men standard URLSession-monster
- **Filstorlek**: Komprimering pa iOS-sidan, validering pa serversidan (5MB max)
