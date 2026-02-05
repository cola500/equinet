---
name: commit
description: Create a git commit following the project's conventional commit style
disable-model-invocation: true
argument-hint: "[optional commit message]"
---

Create a git commit for the current changes. Follow these steps:

## 1. Analyze changes

Run these commands in parallel:
- `git status` (never use -uall flag)
- `git diff` and `git diff --cached` to see all changes
- `git log --oneline -5` to see recent commit style

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

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

## 4. Verify

Run `git status` after committing to confirm success.

## Important

- NEVER amend previous commits unless explicitly asked
- NEVER push to remote
- If pre-commit hooks fail, fix the issue and create a NEW commit
