# Retrospektiv: Kompetenser & Certifikat

**Datum:** 2026-02-02
**Agenter:** security-reviewer, tech-architect
**Scope:** Utökat verifieringssystem med nya fält, fler typer, bilduppladdning, kundvy

---

## Resultat

- 2 nya filer, 14 ändrade filer
- 39 nya/uppdaterade tester (24 verification + 15 upload)
- 1164 totala tester (alla gröna)
- Typecheck grönt
- 5 kompetenstyper (education, organization, certificate, experience, license)
- Max 5 bilder per verifieringspost
- PUT/DELETE endpoints för verification CRUD
- Kundsynlig kompetenssektion med badges och lightbox

## Vad gick bra

### 1. Behavior-based tester fungerar konsekvent
39 nya tester fokuserar på HTTP-kontrakt (status + response shape). Inga Prisma-implementation-detaljer i assertions. Testerna kommer överleva framtida refaktorering.

### 2. Stegvis implementation (schema-först) eliminerade blockerare
Genom att börja med schema, sedan API (TDD), sedan UI, uppstod aldrig någon fas där typer saknades eller relations inte stöddes.

### 3. IDOR-skydd konsekvent i alla endpoints
Alla nya endpoints använder atomära WHERE-clauser med `providerId` + `id` för IDOR-skydd. Upload-endpointen går via `provider.userId` i nested WHERE.

### 4. Befintliga komponenter återanvändes effektivt
`ImageUpload`-komponenten behövde bara en ny bucket-typ ("verifications"). `AlertDialog`, `Badge`, `Dialog` från shadcn användes direkt.

### 5. Admin-vy fick bilder och metadata automatiskt
Genom att uppdatera admin GET till `select` med `images`, `issuer`, `year` fick admin-vyn all data utan extra arbete.

## Vad kan förbättras

### 1. Saknar DDD-Light pattern (HÖGST PRIORITET)
Verification använder Prisma direkt i routes -- inkonsekvent med Booking/Auth/Review som alla använder repository + service + factory. Skapar två parallella mönster i kodbasen.

**Beslut behövs:** Ska verification migreras till DDD-Light? Om ja, planera som separat session.

### 2. Saknar E2E-tester
Inget E2E-test för verification-workflowet. Givet komplexiteten (skapa, ladda upp bild, redigera, ta bort, admin granska) borde minst en happy-path E2E finnas.

**Rekommendation:** Lägg till E2E-test: leverantör skapar kompetens med bild -> admin godkänner -> kund ser badge.

### 3. Storage-cleanup är tech debt
Upload.delete tar bort från DB men inte från Supabase Storage. Kommenterat som tech debt men inte spårat.

**Rekommendation:** Skapa GitHub issue för att formalisera detta.

### 4. Kundvyns page.tsx är 919 rader
Leverantörsprofil-sidan överstiger CLAUDE.md riktlinje (400-500 rader). Kompetens-sektionen lades till i en redan stor fil.

**Rekommendation:** Extrahera `<VerificationSection>` som separat komponent vid nästa tillfälle.

### 5. Rate limiting saknas på PUT/DELETE verification-requests
POST och GET går via `auth()` som har implicit rate limiting, men de nya PUT/DELETE endpoints har ingen explicit rate limiting.

**Rekommendation:** Lägg till `rateLimiters.api` på nya endpoints.

## Security Review - Sammanfattning

**Genomfört av:** security-reviewer agent

**Kritiskt:**
- Alla IDOR-checkar använder korrekta WHERE-clauser (OK)
- Security-reviewer flaggade "IDOR-sårbarhet" men refererade till felaktiga radnummer -- vid kontroll använder koden redan `findFirst` med `{ id, providerId }` (false positive, bekräftat)

**Bra:**
- Session-checks först i alla endpoints
- Zod-validering på alla inputs
- Max-gränser (5 pending, 5 bilder)
- Status-baserad access control (bara pending/rejected är redigerbara)
- Ingen PII-läcka (använder `select`)

**Att förbättra:**
- Rate limiting på nya endpoints
- Storage-cleanup vid delete (tech debt)

## Tekniska beslut

| Beslut | Val | Motivering |
|--------|-----|------------|
| onDelete på Upload->Verification | SetNull | Bevarar Upload-poster för framtida cleanup |
| Synlighet i kundvy | approved + pending | Kunder ser "Ej granskad" på pending, rejected döljs |
| 5 kompetenstyper | education, organization, certificate, experience, license | Täcker vanligaste meriter för häst-leverantörer |
| Max 5 bilder per post | Hårdkort | Förhindrar missbruk utan att begränsa för mycket |
| rejected -> pending vid edit | Automatisk | Förenklar för leverantören, ingen manuell status-ändring |

## Key Learnings (för CLAUDE.md)

```
### Kompetenser & Certifikat (2026-02-02)
- **Befintliga komponenter + ny bucket = minimal UI-kod**: ImageUpload behövde bara en ny bucket-typ. AlertDialog, Badge, Dialog fanns redan. Inventera befintliga komponenter före implementation.
- **Security-reviewer ger false positives -- alltid verifiera**: Agenten flaggade IDOR som "KRITISK" trots att koden redan använde korrekta WHERE-clauser. Automatiserade granskningar ersätter inte manuell kodverifiering.
- **DDD-Light ska vara all-or-nothing per domän**: Att skippa repository/service för Verification medan Booking/Auth/Review använder det skapar förvirring. Antingen följ mönstret eller dokumentera explicit varför inte.
- **select i admin-query ger gratis metadata-exponering**: Att byta från include till select med nya fält gav admin-vyn all data automatiskt. select-first är både säkerhet och convenience.
- **Schema-först eliminerar typproblem i kedjan**: Att börja med Prisma-schema och köra db push före API-implementation innebar att TypeScript-typer var korrekta från start. Ingen iteration krävdes.
```

## Uppföljning

- [ ] Beslut: DDD-Light migration för Verification?
- [ ] Lägg till rate limiting på PUT/DELETE verification-requests
- [ ] E2E-test för verification-workflow
- [ ] GitHub issue för storage-cleanup tech debt
- [ ] Utvärdera komponentextrahering ur providers/[id]/page.tsx (919 rader)
