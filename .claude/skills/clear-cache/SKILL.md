---
name: clear-cache
description: Clear Next.js/Turbopack cache and restart dev server when things behave strangely
disable-model-invocation: true
---

Clear all caches and restart the development environment.

Use this when experiencing (Gotcha #3):
- Hot reload not working
- Changes not reflected in the browser
- Strange import errors
- Stale data or UI inconsistencies

## Steps

### 1. Stop all dev processes

```bash
pkill -f "next dev" 2>/dev/null || true
pkill -f "prisma studio" 2>/dev/null || true
```

Note: Prisma Studio zombie processes accumulate and eat DB connections (Gotcha #13).

### 2. Clear caches

```bash
rm -rf .next node_modules/.cache
```

### 3. Regenerate Prisma client (if schema issues)

```bash
npx prisma generate
```

### 4. Restart dev server

```bash
npm run dev
```

### 5. If problems persist

Try a full reinstall:
```bash
rm -rf node_modules
npm install
npx prisma generate
npm run dev
```

Report what was cleaned and whether the dev server started successfully.
