# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.2.0](https://github.com/cola500/equinet/compare/v0.1.0...v0.2.0) (2026-01-22)

## 0.1.0 (2026-01-22)


### Features

* add domain layer foundation (E-2) ([b4e7e76](https://github.com/cola500/equinet/commit/b4e7e76190cc0a89af7c1c1f1f15675140911623))
* add GET endpoint for provider announcements list ([44a65e2](https://github.com/cola500/equinet/commit/44a65e25aaf169f56bb868609a3a44e02dae31b9))
* add health check endpoint and reduce TypeScript errors ([0142278](https://github.com/cola500/equinet/commit/0142278a14a6b5ebfe2e4f33e83145c636c7422a))
* add quality gates and CI/CD pipeline (E-5) ([d36ec8a](https://github.com/cola500/equinet/commit/d36ec8a6be7ec8bddd0b04ff66e2c1f9509a8c29))
* add quality gates workflow ([1802283](https://github.com/cola500/equinet/commit/18022832e635dff9024a94a3be89d6c2caa91112))
* add repository pattern infrastructure (E-3) ([4facab7](https://github.com/cola500/equinet/commit/4facab7b5d4ac83c208a881533631cfa2dfbdfa1))
* **ci:** automate pre-merge quality gates (F2-4) ([#3](https://github.com/cola500/equinet/issues/3)) ([291bff6](https://github.com/cola500/equinet/commit/291bff65a53cbfb284d373122db8f62a492108c2))
* Complete Phase 2 - Link bookings to provider announcements ([f702377](https://github.com/cola500/equinet/commit/f702377b305649e134dd22b7a62a6735ceac020b))
* Implement location-based service availability (Experiment 003) ([b233462](https://github.com/cola500/equinet/commit/b233462c072d7429100be2775617a7588e92a825))
* implement ProviderRepository pattern (F1-1) ([87f29f9](https://github.com/cola500/equinet/commit/87f29f902b3e55c6584a2bbfbee5744e7cd3afcc))
* implement ServiceRepository (F1-4) ([50d5fb7](https://github.com/cola500/equinet/commit/50d5fb79f5a4dd068b0ae654a2c1f9d6f13f4853))
* Lägg till kartvisualisering med faktiska körvägar ([7b48ea1](https://github.com/cola500/equinet/commit/7b48ea144f8bd70afb0090c0659fc895603bd08d))
* Lägg till ruttoptimering med Modal API ([5291e29](https://github.com/cola500/equinet/commit/5291e29e81c1d96a292fa9dcee0fbdd36e80c4f8))
* make geocoding optional for MVP (remove Google Maps dependency) ([1a78f98](https://github.com/cola500/equinet/commit/1a78f98cce3cb78162af96ef3005e94bd9b035fa))
* migrate from SQLite to PostgreSQL for Vercel deployment ([875b4ae](https://github.com/cola500/equinet/commit/875b4ae344701dc646b7942cad6837ee1a92bfa2))
* Phase 3 - Provider UI for route announcements ([5c3b38a](https://github.com/cola500/equinet/commit/5c3b38a9c86ac0715a42ebf1bac58ba678ab40e0))
* Phase 4 - Customer UI for announcement discovery and booking ([30aa8c5](https://github.com/cola500/equinet/commit/30aa8c56659b7eb9482c38fa0247a50e0868128b))
* **sprint2:** Complete Phase 1 - Documentation & Test Isolation (F2-2, F2-5) ([b25cd5b](https://github.com/cola500/equinet/commit/b25cd5b9d9e4c02221c0d928da883dd2a42499f6))
* upgrade to Next.js 16 + React 19 + NextAuth v5 ([aef67f9](https://github.com/cola500/equinet/commit/aef67f9e32f2de4012552f11d77f6faa80114ef6))


### Bug Fixes

* add .npmrc with legacy-peer-deps for Vercel build ([f46742a](https://github.com/cola500/equinet/commit/f46742a28c71e8e130c5bad59f65c60182e96e3f))
* add contact phone field to flexible booking form ([5249029](https://github.com/cola500/equinet/commit/52490293eb264aed146b31f53b47e150cab298a1))
* **ci:** add NextAuth env vars and disable coverage threshold (F1-3) ([7e43814](https://github.com/cola500/equinet/commit/7e4381414c01f7583c994dbe00b905d0734a4b23))
* **ci:** Add test user seeding to E2E workflow (F2-1) ([c9911ce](https://github.com/cola500/equinet/commit/c9911ce6e5444a146adde31127b198d5904ce9e2))
* **ci:** resolve coverage threshold and memory issues (F1-3) ([f2ffe0f](https://github.com/cola500/equinet/commit/f2ffe0f4507356df65e5617a694effa56936fc12))
* **ci:** resolve E2E timeout and OOM issues (F2-1) ([7cd28e8](https://github.com/cola500/equinet/commit/7cd28e84e0e2a545827527ee33ad008e06f3d8b7))
* **ci:** resolve OOM and ESLint config issues (F1-3 Phase 1+2) ([816fe63](https://github.com/cola500/equinet/commit/816fe638746990406d25a14eb01317eca7d81ac4))
* ESLint config for Vercel build ([6010e49](https://github.com/cola500/equinet/commit/6010e49721cd848283eeaa3b62f907336ee547ce))
* make contactPhone optional for provider announcements ([33d5a2c](https://github.com/cola500/equinet/commit/33d5a2c77e7ccc04b6b96d41c090b2e56b1db3cc))
* make routeId optional in RouteStop for provider announcements ([68d7bcf](https://github.com/cola500/equinet/commit/68d7bcfbbf614f3c9d50a8c4710205c1aa3f3a8d))
* run prisma generate before build ([6a832e0](https://github.com/cola500/equinet/commit/6a832e0dc5bb0b00b2b3199a5124bee78aa1f835))
* separate Edge-compatible auth config to reduce middleware size ([f5ea049](https://github.com/cola500/equinet/commit/f5ea0494123665b69c2e63a956a0aa4a67e1cd47))
* skip TypeScript check during Vercel build ([73cc5ad](https://github.com/cola500/equinet/commit/73cc5ada2d197d3c386292f27a1b45ce091bd956))
* **tests:** migrate API tests to behavior-based testing (R-1) ([050980d](https://github.com/cola500/equinet/commit/050980d8ebb259af1a667e45f2e59dd5fe405c8a))
* **tests:** update tests for new auth and repository patterns ([aba71b2](https://github.com/cola500/equinet/commit/aba71b2755039120732a35c18a00e3b34d7362b4))
* **tests:** use dynamic future dates in route-orders tests ([a96fab1](https://github.com/cola500/equinet/commit/a96fab1874ef8dcaf475be1f7531c77bd37f25c8))
* **typescript:** adjust [@ts-expect-error](https://github.com/ts-expect-error) for 8GB memory (F2-1) ([6694ab2](https://github.com/cola500/equinet/commit/6694ab2d449663c703a979ea7c52738ec7573e45))
* **typescript:** resolve all type errors blocking CI (F1-3) ([cdd0d2c](https://github.com/cola500/equinet/commit/cdd0d2ccdb47eec4f234e2c16c223e9703d53453))
* **typescript:** resolve all TypeScript compilation errors for F1-3 ([d324396](https://github.com/cola500/equinet/commit/d324396f00dcb7a713214c5dfc4f9bbeee000565))
* **typescript:** use [@ts-ignore](https://github.com/ts-ignore) for CI-specific Prisma mock depth issue (F2-1) ([2f31190](https://github.com/cola500/equinet/commit/2f31190999400979631cfe272a727d2ac28a1219))
* use valid status 'pending' for provider announcements and improve error responses ([feb96b7](https://github.com/cola500/equinet/commit/feb96b734adb2895151ab246a63c59a52d4cb91c))
