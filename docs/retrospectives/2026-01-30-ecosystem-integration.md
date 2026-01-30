# Retrospektiv: Fas 3 -- Ecosystem-integration

**Datum:** 2026-01-30
**Scope:** Sprint 4 (Dataexport/Hastpass), Sprint 5 (Bilduppladdning), Sprint 6 (Fortnox)
**Nya tester:** 31 (856 -> 887)

---

## Vad gick bra

### Schema-forst-approachen skalade
Tre sprints med schema-andringar (HorsePassportToken, Upload, FortnoxConnection) gick smidigt med `prisma db push`. Varje sprint byggde pa det foregaende utan konflikter.

### Gateway-pattern visade sitt varde
`IAccountingGateway` + `MockAccountingGateway` foljde exakt samma monster som `IPaymentGateway`. Att ha ett beprovat monster att kopiera fran sparade tid och sakerstallde konsistens. Nar Fortnox-API:et ska kopplas pa riktigt behover bara `FortnoxGateway` implementeras -- routes och UI ar redan klara.

### TDD fangade buggar tidigt
- Export-testet fangade att `passwordHash` kunde laeka om `select` inte anvandes korrekt
- Passport-testet verifierade 30-dagars expiry med tidstolerans
- Upload-testet avslojde att JSDOM inte stodjer `File.arrayBuffer()` korrekt -- ledde till refaktor av uploadFile att ta File direkt

### Inga regressions
Alla 887 tester grona efter tre sprints implementation. Befintlig kod opaverkad.

---

## Vad kunde vi gora battre

### FormData i vitest ar fragilt
JSDOM-miljons stod for `FormData` + `File` ar begransat. Upload-testerna kravde mocking av `request.formData()` istallet for att skicka riktig FormData. Detta ar ett kant monstret att dokumentera for framtida API-routes med FormData-input.

### UI-sidor saknar svenska tecken
Aterkommande problem fran mobil-forst-utveckling: export-sidan och passport-dialogen saknar a, a, o. Borde anvanda en linter eller template med korrekta tecken.

### Fortnox-integrationen ar "shell utan skal"
OAuth-flodet, token-kryptering och sync-logiken ar pa plats, men utan Fortnox sandbox-konto kan vi inte verifiera det pa riktigt. `MockAccountingGateway` testar logiken men inte HTTP-kommunikationen.

---

## Konkreta rekommendationer

1. **Fortnox sandbox-konto** -- Skaffa ett testkonto for att verifiera OAuth-flodet och fakturering end-to-end.
2. **Supabase Storage bucket** -- Skapa `equinet-uploads` bucket med public access och korrekt CORS-policy.
3. **ENCRYPTION_KEY i produktion** -- Lagg till i Vercel env vars. Generera med `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. **E2E-tester for export/passport** -- Exportera data som inloggad kund, oppna passport-lank i incognito.
5. **Svenska tecken-audit** -- Kor igenom alla nya UI-filer och fixa saknade a/a/o.

---

## Tekniska beslut

| Beslut | Val | Motivering |
|--------|-----|-----------|
| CSV-export | `objectsToCsv` utility | Ingen extern dependency for enkel CSV |
| Passport-token | `crypto.randomBytes(32).hex` | 64-teckens URL-safe token, tillrackligt entropikert |
| Bildkomprimering | `browser-image-compression` (client-side) | Minskar serverbelastning, 5MB -> max 1MB |
| Supabase Storage | Public bucket med path-baserad auth | Enklaste setup for MVP |
| Token-kryptering | AES-256-GCM | Authenticated encryption, forhindrar tampering |
| Fortnox integration | Gateway pattern + ren fetch | Ingen SDK-dependency, konsistent med PaymentGateway |

---

## Key Metrics

| Metric | Fore | Efter |
|--------|------|-------|
| Tester | 856 | 887 (+31) |
| Testfiler | 72 | 78 (+6) |
| API-endpoints | ~60 | ~70 (+10) |
| Prisma-modeller | 18 | 21 (+3) |
| TypeScript-fel | 0 | 0 |
