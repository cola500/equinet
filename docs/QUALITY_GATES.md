# Quality Gates - Equinet

> **Syfte**: Automatiserade kvalitetskontroller som säkerställer kodkvalitet och förhindrar regression.

**Skapad**: 2025-11-19
**Version**: 1.0

---

## 🎯 Overview

Quality Gates är automatiserade kontroller som körs vid varje PR och push till main. Alla gates måste passera innan kod får mergas.

**5 Quality Gates**:
1. ✅ **Unit Tests & Coverage** - 150+ tests, ≥70% coverage
2. ✅ **E2E Tests** - User flows fungerar
3. ✅ **TypeScript Check** - Inga type errors
4. ✅ **Build Check** - Applikationen bygger utan fel
5. ✅ **Lint Check** - Kod följer standards (errors blockerar, warnings tillåtna)

---

## 📊 Coverage Thresholds

### Global Thresholds (Sprint 0 Baseline)
```typescript
{
  lines: 70%,
  functions: 70%,
  branches: 70%,
  statements: 70%
}
```

### Directory-Specific Targets (Future)
| Directory | Lines | Rationale |
|-----------|-------|-----------|
| `src/domain/` | ≥90% | Pure business logic, easy to test |
| `src/infrastructure/` | ≥80% | Data access, critical |
| `src/app/api/` | ≥80% | Business logic in API routes |
| `src/lib/` | ≥75% | Utilities |

### Per-File Enforcement
- **Enabled**: `perFile: true`
- **Impact**: VARJE fil måste uppfylla 70% threshold
- **Why**: Förhindrar "coverage by averaging" - man kan inte ha 0% i en fil och 140% i en annan

---

## 🚦 Gate Breakdown

### Gate 1: Unit Tests & Coverage

**Kör**: `npm run test:coverage`

**Vad testas**:
- Domain layer (Entity, ValueObject, Result, Guard, etc.)
- Infrastructure layer (Repositories, Mappers)
- API routes (business logic)
- Utilities

**Coverage Report**:
- Genereras i `/coverage/`
- Formats: HTML, JSON, LCOV, Text
- Uploaderas till Codecov (om konfigurerat)

**Fails If**:
- Någon test failar
- Coverage < 70% globally
- Någon fil < 70% coverage (perFile enforcement)

**Exempel**:
```bash
npm run test:coverage

# Output:
Test Files  7 passed (7)
Tests  150 passed (150)
Coverage  82.5% (✅ Pass threshold 70%)
```

---

### Gate 2: E2E Tests

**Kör**: `npm run test:e2e`

**Vad testas**:
- User registration flow
- Booking creation flow
- Provider profile management
- Customer views bookings
- Dashboard rendering

**Fails If**:
- Någon E2E test failar
- Playwright crashes

**Debug**:
- Playwright report uploaderas vid failure
- Kan köras lokalt: `npx playwright test --ui`

---

### Gate 3: TypeScript Check

**Kör**: `npx tsc --project tsconfig.typecheck.json`

**Vad kontrolleras**:
- Inga type errors
- Korrekt användning av interfaces
- Type safety i domain/infrastructure

**Fails If**:
- Någon TypeScript error finns

**Common Issues**:
```typescript
// ❌ Type error
const booking: Booking = { id: 123 } // id ska vara string

// ✅ Correct
const booking: Booking = { id: '123' }
```

---

### Gate 4: Build Check

**Kör**: `npm run build`

**Vad kontrolleras**:
- Next.js build lyckas
- Alla routes kompilerar
- Inga runtime errors vid build

**Fails If**:
- Build process kraschar
- Next.js errors

**Output**: `.next/` build artifacts

---

### Gate 5: Lint Check

**Kör**: `npm run lint`

**Vad kontrolleras**:
- ESLint rules
- Code style consistency

**Status**: Strict (errors blockerar merge, warnings tillåtna)

**ESLint Flat Config**: Använder ny ESLint 9 flat config med `@next/eslint-plugin-next`

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

**Trigger**: PR till main, push till main

**Jobs kör parallellt**:
```
unit-tests (3-5 min)
e2e-tests (2-3 min)
type-check (1-2 min)
build (2-4 min)
lint (30s)
```

**Total Pipeline Time**: ~5-7 min

**Final Check**: `quality-gate-passed` job väntar på alla och summerar

---

## 📈 Coverage Tracking

### Codecov Integration (Optional)

**Setup**:
1. Create Codecov account
2. Add repository
3. Add `CODECOV_TOKEN` secret to GitHub
4. Coverage reports uploaderas automatiskt

**Benefits**:
- Coverage diff i PR comments
- Trend tracking över tid
- Branch comparison

**PR Comment Example**:
```
Coverage: 82.5% (+2.3%) compared to main
✅ All thresholds passed

Files with changes:
  src/domain/booking/Booking.ts: 95% (+5%)
  src/infrastructure/booking/: 88% (unchanged)
```

---

## 🚨 Handling Failures

### Unit Test Failure

**Symptom**: `unit-tests` job fails

**Debug**:
```bash
# Locally
npm test

# Watch mode
npm test -- --watch

# Specific test
npm test -- src/domain/shared/Result.test.ts
```

**Common Causes**:
- Test logic error
- Breaking change in code
- Async timing issues

**Fix**: Update test or fix code

---

### Coverage Below Threshold

**Symptom**: `Error: Coverage for lines (65%) does not meet threshold (70%)`

**Debug**:
```bash
npm run test:coverage
# Open coverage/index.html in browser
```

**Solutions**:
1. Add tests for uncovered files
2. Remove dead code
3. Exclude non-critical files (discuss with team)

---

### E2E Test Failure

**Symptom**: `e2e-tests` job fails

**Debug**:
```bash
# Locally
npm run test:e2e

# UI mode
npx playwright test --ui

# Debug specific test
npx playwright test --debug e2e/booking.spec.ts
```

**Common Causes**:
- UI changed but test not updated
- Timing issue (element not visible)
- Test data setup issue

**Artifacts**: Download Playwright report from failed run

---

### TypeScript Errors

**Symptom**: `type-check` job fails

**Debug**:
```bash
npm run typecheck
# eller
npx tsc --project tsconfig.typecheck.json
```

**Note**: Använd `tsconfig.typecheck.json` som exkluderar testfiler för att undvika memory issues.

**Common Causes**:
- Missing type definitions
- Incorrect interface usage
- Import errors

**Fix**: Add types, fix interfaces

---

### Build Failure

**Symptom**: `build` job fails

**Debug**:
```bash
npm run build
```

**Common Causes**:
- Import errors
- Missing environment variables
- Next.js configuration issue

---

## 🛠️ Local Development

### Pre-Commit Checklist

Before committing, run locally:

```bash
# 1. Unit tests
npm test

# 2. Coverage check
npm run test:coverage

# 3. TypeScript
npm run typecheck

# 4. Lint
npm run lint

# 5. E2E (optional, takes time)
npm run test:e2e

# 6. Build
npm run build
```

### Pre-Push Hook (Husky)

Automatisk pre-push hook körs via Husky (`.husky/pre-push`):

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔒 Running pre-push quality checks..."

# Run unit tests
npm run test:run || exit 1

# Run TypeScript check
npx tsc --project tsconfig.typecheck.json || exit 1

# Run lint check
npm run lint || exit 1

echo "✅ All local checks passed!"
```

---

## 📋 Definition of Done - Quality Gates

En PR är **klar för merge** när:

### Must Pass
- [ ] ✅ All unit tests pass (150+ tests)
- [ ] ✅ Coverage ≥70% globally
- [ ] ✅ All files ≥70% coverage (perFile)
- [ ] ✅ All E2E tests pass
- [ ] ✅ No TypeScript errors
- [ ] ✅ Build successful
- [ ] ✅ No lint errors (warnings are OK)

### Manual Review
- [ ] 👀 Code review approved
- [ ] 📝 Description clear
- [ ] 🧪 Test coverage reasonable

---

## 🎯 Metrics & Goals

### Current (Sprint 0)
- **Tests**: 150 (110 domain + 40 infrastructure)
- **Coverage**: 100% (domain + infrastructure layer)
- **E2E Tests**: 7 scenarios
- **Build Time**: ~3 min
- **Pipeline Time**: ~5-7 min

### Sprint 1 Goals
- **Tests**: +10 (profile management)
- **Coverage**: Maintain ≥70%
- **E2E Tests**: +2 (profile flows)

### Sprint 2 Goals
- **Tests**: +25 (booking domain)
- **Coverage**: Increase to ≥75%
- **E2E Tests**: +3 (booking flows)

### Long-Term Goals (v1.0)
- **Tests**: 300+
- **Coverage**: ≥80%
- **E2E Tests**: 20+ critical flows
- **Pipeline Time**: <5 min

---

## 🔧 Configuration Files

### vitest.config.ts
```typescript
coverage: {
  thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
  perFile: true,
  include: ['src/app/api/**/*.ts', 'src/lib/**/*.ts', 'src/domain/**/*.ts'],
  exclude: ['tests/', 'e2e/', '**/*.config.{ts,js}', '**/*.test.ts']
}
```

### .github/workflows/quality-gates.yml
- 5 parallel jobs
- Coverage upload to Codecov
- Artifact uploads on failure
- Final status check

---

## 🚀 Continuous Improvement

### Quarterly Reviews
- Review threshold levels (increase gradually)
- Add new quality metrics
- Optimize pipeline speed
- Update excluded files

### When to Increase Thresholds
- Coverage stable at current level for 4+ weeks
- Team comfortable with current level
- No artificial coverage padding

**Example Path**:
```
Sprint 0: 70% (Foundation)
Sprint 4: 75% (Stable)
Sprint 8: 80% (Mature)
```

---

## 📚 Resources

**Internal**:
- [BDD Transformation Strategy](./bdd-transformation-strategy.md)
- [Ubiquitous Language](./UBIQUITOUS_LANGUAGE.md)
- [CLAUDE.md](../CLAUDE.md) - Quality checklist

**External**:
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Codecov Documentation](https://docs.codecov.com/)

---

**Maintained by**: Quality-Gate Agent
**Last Updated**: 2026-01-24
**Next Review**: After Sprint 2
