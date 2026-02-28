# Retrospektiv: Fas 3 -- Ecosystem-integration

**Datum:** 2026-01-30
**Scope:** Sprint 4 (Dataexport/Hästpass), Sprint 5 (Bilduppladdning), Sprint 6 (Fortnox)
**Nya tester:** 31 (856 -> 887)

---

## Vad gick bra

### Schema-först-approachen skalade
Tre sprints med schema-ändringar (HorsePassportToken, Upload, FortnoxConnection) gick smidigt med `prisma db push`. Varje sprint byggde på det föregående utan konflikter.

### Gateway-pattern visade sitt värde
`IAccountingGateway` + `MockAccountingGateway` följde exakt samma mönster som `IPaymentGateway`. Att ha ett beprövat mönster att kopiera från sparade tid och säkerställde konsistens. När Fortnox-API:et ska kopplas på riktigt behöver bara `FortnoxGateway` implementeras -- routes och UI är redan klara.

### TDD fångade buggar tidigt
- Export-testet fångade att `passwordHash` kunde läcka om `select` inte användes korrekt
- Passport-testet verifierade 30-dagars expiry med tidstolerans
- Upload-testet avslöjde att JSDOM inte stödjer `File.arrayBuffer()` korrekt -- ledde till refaktor av uploadFile att ta File direkt

### Inga regressions
Alla 887 tester gröna efter tre sprints implementation. Befintlig kod opåverkad.

---

## Vad kunde vi göra bättre

### FormData i vitest är fragilt
JSDOM-miljöns stöd för `FormData` + `File` är begränsat. Upload-testerna krävde mocking av `request.formData()` istället för att skicka riktig FormData. Detta är ett känt mönster att dokumentera för framtida API-routes med FormData-input.

### UI-sidor saknar svenska tecken
Återkommande problem från mobil-först-utveckling: export-sidan och passport-dialogen saknar å, ä, ö. Borde använda en linter eller template med korrekta tecken.

### Fortnox-integrationen är "shell utan skal"
OAuth-flödet, token-kryptering och sync-logiken är på plats, men utan Fortnox sandbox-konto kan vi inte verifiera det på riktigt. `MockAccountingGateway` testar logiken men inte HTTP-kommunikationen.

---

## Konkreta rekommendationer

1. **Fortnox sandbox-konto** -- Skaffa ett testkonto för att verifiera OAuth-flödet och fakturering end-to-end.
2. **Supabase Storage bucket** -- Skapa `equinet-uploads` bucket med public access och korrekt CORS-policy.
3. **ENCRYPTION_KEY i produktion** -- Lägg till i Vercel env vars. Generera med `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. **E2E-tester för export/passport** -- Exportera data som inloggad kund, öppna passport-länk i incognito.
5. **Svenska tecken-audit** -- Kör igenom alla nya UI-filer och fixa saknade å/ä/ö.

---

## Tekniska beslut

| Beslut | Val | Motivering |
|--------|-----|-----------|
| CSV-export | `objectsToCsv` utility | Ingen extern dependency för enkel CSV |
| Passport-token | `crypto.randomBytes(32).hex` | 64-teckens URL-safe token, tillräckligt entropikert |
| Bildkomprimering | `browser-image-compression` (client-side) | Minskar serverbelastning, 5MB -> max 1MB |
| Supabase Storage | Public bucket med path-baserad auth | Enklaste setup för MVP |
| Token-kryptering | AES-256-GCM | Authenticated encryption, förhindrar tampering |
| Fortnox integration | Gateway pattern + ren fetch | Ingen SDK-dependency, konsistent med PaymentGateway |

---

## Key Metrics

| Metric | Före | Efter |
|--------|------|-------|
| Tester | 856 | 887 (+31) |
| Testfiler | 72 | 78 (+6) |
| API-endpoints | ~60 | ~70 (+10) |
| Prisma-modeller | 18 | 21 (+3) |
| TypeScript-fel | 0 | 0 |
