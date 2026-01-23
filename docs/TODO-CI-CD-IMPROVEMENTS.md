# TODO: CI/CD Förbättringar + Exploratory Testing

> **Status**: Pausad - fortsätt i nästa session
> **Datum**: 2026-01-23

---

## Del 1: CI/CD Förbättringar (EJ PÅBÖRJAD)

### 1. Gör lint strict
**Fil**: `.github/workflows/quality-gates.yml` (rad 134)
```yaml
# Ändra från:
continue-on-error: true
# Till:
continue-on-error: false
```

### 2. Synka TypeScript config i CI
**Fil**: `.github/workflows/quality-gates.yml` (rad 112)
```yaml
# Ändra från:
run: NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit
# Till:
run: NODE_OPTIONS="--max-old-space-size=8192" npx tsc --project tsconfig.typecheck.json
```

### 3. Lägg till lint i pre-push hook
**Fil**: `.husky/pre-push`
```bash
# Lägg till efter TypeScript check (rad 21):

echo ""
echo "🔍 Running lint check..."
npm run lint || {
  echo "❌ Lint errors found! Fix lint errors before pushing."
  exit 1
}
```

### 4. Uppdatera QUALITY_GATES.md
- Dokumentera att `perFile: true` är avstängt pga coverage-problem
- Uppdatera Gate 3 att använda `tsconfig.typecheck.json`
- Uppdatera Gate 5 att lint nu är strict

### 5. Branch protection (manuellt i GitHub)
- Settings > Branches > Add rule för `main`
- Require status checks: `quality-gate-passed`
- Require branches to be up to date

---

## Del 2: Exploratory Testing Session 2 (EJ PÅBÖRJAD)

### Fokus: Routes-API

**Endpoints att testa:**
- `POST /api/routes` - Skapa rutt
- `GET /api/routes` - Lista rutter
- `GET /api/routes/[id]` - Hämta rutt
- `PUT /api/routes/[id]` - Uppdatera rutt
- `GET /api/routes/my-routes` - Mina rutter

### Test-scenarier

1. **Authorization (IDOR)**
   - Kan användare se andras rutter?
   - Fungerar auth-check korrekt?

2. **Input validation**
   - Ogiltiga datum/tider
   - Tomma orderIds
   - För många stops

3. **Business logic**
   - Status-övergångar (planned → active → completed)
   - Rutt med icke-existerande orders

### Output
Skapa: `docs/testing/exploratory-session-2-2026-01-23.md`

---

## Verifiering efter implementation

1. `npm run lint` - ska passera
2. `npx tsc --project tsconfig.typecheck.json` - ska passera
3. `npm run test:run` - 410+ tester ska passera
4. Testa pre-push hook manuellt

---

## Ordning

1. CI/CD förbättringar först (snabba fixar)
2. Exploratory testing session 2 efter
