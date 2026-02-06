---
name: ship
description: Commit and push changes to remote in one step
disable-model-invocation: true
argument-hint: "[optional commit message]"
---

Commit current changes and push to remote. This runs the full commit flow followed by a push. Husky pre-push hooks (tests, typecheck, lint) will run automatically.

## 1. Analyze changes

Run these commands in parallel:
- `git status` (never use -uall flag)
- `git diff` and `git diff --cached` to see all changes
- `git log --oneline -5` to see recent commit style
- `git branch --show-current` to know which branch we're on

### Pre-commit checks (on staged/changed files)

Before proceeding, run these lightweight checks on the diff and flag any issues:

1. **Merge conflict markers** -- Search staged files for `<<<<<<<`, `=======`, `>>>>>>>`. If found, STOP and fix before committing.
2. **Sensitive files** -- Check `git status` for `.env`, `credentials`, `secret`, or similar files. WARN the user and do NOT stage them.
3. **console.log in API routes** -- This project uses `logger`, not `console.*`. Check `git diff --cached` for `console.log`, `console.error`, `console.warn` in `src/app/api/` files. WARN if found.
4. **Large files** -- Check if any staged file is > 500KB (`git diff --cached --stat`). WARN if found (likely accidental binary).

## 2. Draft commit message

Follow the project's **conventional commit** format:

```
<type>: <short description>
```

### Types
- `feat:` - New feature (triggers minor version bump)
- `fix:` - Bug fix (triggers patch version bump)
- `refactor:` - Code restructuring without behavior change
- `test:` - Adding or updating tests
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks (deps, config, scripts)

### Rules
- Keep the first line under 70 characters
- Focus on **why**, not what
- Use imperative mood ("add", "fix", "update", not "added", "fixed")
- If the user provided a message via $ARGUMENTS, use that as guidance but ensure it follows the format

## 3. Stage and commit

- Stage relevant files by name (avoid `git add -A` or `git add .`)
- NEVER stage .env files, credentials, or secrets
- Create the commit using a HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
type: description

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

## 4. Push to remote

After a successful commit:

```bash
git push origin <current-branch>
```

- Husky **pre-push hooks** will run automatically (tests, typecheck, lint, Swedish character check)
- If pre-push fails: the commit is kept locally, report what failed so the user can fix it
- NEVER use `--force` or `--no-verify`

## 5. Verify

Run `git status` after pushing to confirm success. Report the branch name and remote status.

## Important

- NEVER amend previous commits unless explicitly asked
- If pre-commit hooks fail, fix the issue and create a NEW commit
- If push fails due to remote changes, suggest `git pull --rebase` and let the user decide
