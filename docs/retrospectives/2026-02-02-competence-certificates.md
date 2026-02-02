# Retrospektiv: Kompetenser & Certifikat

**Datum:** 2026-02-02
**Agenter:** security-reviewer, tech-architect
**Scope:** Utokat verifieringssystem med nya falt, fler typer, bilduppladdning, kundvy

---

## Resultat

- 2 nya filer, 14 andrade filer
- 39 nya/uppdaterade tester (24 verification + 15 upload)
- 1164 totala tester (alla grona)
- Typecheck gront
- 5 kompetenstyper (education, organization, certificate, experience, license)
- Max 5 bilder per verifieringspost
- PUT/DELETE endpoints for verification CRUD
- Kundsynlig kompetenssektion med badges och lightbox

## Vad gick bra

### 1. Behavior-based tester fungerar konsekvent
39 nya tester fokuserar pa HTTP-kontrakt (status + response shape). Inga Prisma-implementation-detaljer i assertions. Testerna kommer overleva framtida refaktorering.

### 2. Stegvis implementation (schema-forst) eliminerade blockerare
Genom att borja med schema, sedan API (TDD), sedan UI, uppstod aldrig nagon fas dar typer saknades eller relations inte stoddes.

### 3. IDOR-skydd konsekvent i alla endpoints
Alla nya endpoints anvander atomara WHERE-clauser med `providerId` + `id` for IDOR-skydd. Upload-endpointen gar via `provider.userId` i nested WHERE.

### 4. Befintliga komponenter ateranvandes effektivt
`ImageUpload`-komponenten behovde bara en ny bucket-typ ("verifications"). `AlertDialog`, `Badge`, `Dialog` fran shadcn anvandes direkt.

### 5. Admin-vy fick bilder och metadata automatiskt
Genom att uppdatera admin GET till `select` med `images`, `issuer`, `year` fick admin-vyn all data utan extra arbete.

## Vad kan forbattras

### 1. Saknar DDD-Light pattern (HOGST PRIORITET)
Verification anvander Prisma direkt i routes -- inkonsekvent med Booking/Auth/Review som alla anvander repository + service + factory. Skapar tva parallella monster i kodbasen.

**Beslut behovs:** Ska verification migreras till DDD-Light? Om ja, planera som separat session.

### 2. Saknar E2E-tester
Inget E2E-test for verification-workflowet. Givet komplexiteten (skapa, ladda upp bild, redigera, ta bort, admin granska) borde minst en happy-path E2E finnas.

**Rekommendation:** Lagg till E2E-test: leverantor skapar kompetens med bild -> admin godkanner -> kund ser badge.

### 3. Storage-cleanup ar tech debt
Upload.delete tar bort fran DB men inte fran Supabase Storage. Kommenterat som tech debt men inte sparat.

**Rekommendation:** Skapa GitHub issue for att formalisera detta.

### 4. Kundvyns page.tsx ar 919 rader
Leverantorsprofil-sidan overstiger CLAUDE.md riktlinje (400-500 rader). Kompetens-sektionen lades till i en redan stor fil.

**Rekommendation:** Extrahera `<VerificationSection>` som separat komponent vid nasta tillfalle.

### 5. Rate limiting saknas pa PUT/DELETE verification-requests
POST och GET gar via `auth()` som har implicit rate limiting, men de nya PUT/DELETE endpoints har ingen explicit rate limiting.

**Rekommendation:** Lagg till `rateLimiters.api` pa nya endpoints.

## Security Review - Sammanfattning

**Genomfort av:** security-reviewer agent

**Kritiskt:**
- Alla IDOR-checkar anvander korrekta WHERE-clauser (OK)
- Security-reviewer flaggade "IDOR-sarbarhet" men refererade till felaktiga radnummer -- vid kontroll anvander koden redan `findFirst` med `{ id, providerId }` (false positive, bekraftat)

**Bra:**
- Session-checks forst i alla endpoints
- Zod-validering pa alla inputs
- Max-granser (5 pending, 5 bilder)
- Status-baserad access control (bara pending/rejected ar redigerbara)
- Ingen PII-lacka (anvander `select`)

**Att forbattra:**
- Rate limiting pa nya endpoints
- Storage-cleanup vid delete (tech debt)

## Tekniska beslut

| Beslut | Val | Motivering |
|--------|-----|------------|
| onDelete pa Upload->Verification | SetNull | Bevarar Upload-poster for framtida cleanup |
| Synlighet i kundvy | approved + pending | Kunder ser "Ej granskad" pa pending, rejected doljs |
| 5 kompetenstyper | education, organization, certificate, experience, license | Tacker vanligaste meriter for hast-leverantorer |
| Max 5 bilder per post | Halkort | Forhindrar missbruk utan att begronsa for mycket |
| rejected -> pending vid edit | Automatisk | Forenklar for leverantoren, ingen manuell status-andring |

## Key Learnings (for CLAUDE.md)

```
### Kompetenser & Certifikat (2026-02-02)
- **Befintliga komponenter + ny bucket = minimal UI-kod**: ImageUpload behövde bara en ny bucket-typ. AlertDialog, Badge, Dialog fanns redan. Inventera befintliga komponenter före implementation.
- **Security-reviewer ger false positives -- alltid verifiera**: Agenten flaggade IDOR som "KRITISK" trots att koden redan använde korrekta WHERE-clauser. Automatiserade granskningar ersätter inte manuell kodverifiering.
- **DDD-Light ska vara all-or-nothing per domän**: Att skippa repository/service för Verification medan Booking/Auth/Review använder det skapar förvirring. Antingen följ mönstret eller dokumentera explicit varför inte.
- **select i admin-query ger gratis metadata-exponering**: Att byta från include till select med nya fält gav admin-vyn all data automatiskt. select-first är både säkerhet och convenience.
- **Schema-först eliminerar typproblem i kedjan**: Att börja med Prisma-schema och köra db push före API-implementation innebar att TypeScript-typer var korrekta från start. Ingen iteration krävdes.
```

## Uppfoljning

- [ ] Beslut: DDD-Light migration for Verification?
- [ ] Lagg till rate limiting pa PUT/DELETE verification-requests
- [ ] E2E-test for verification-workflow
- [ ] GitHub issue for storage-cleanup tech debt
- [ ] Utvärdera komponentextrahering ur providers/[id]/page.tsx (919 rader)
