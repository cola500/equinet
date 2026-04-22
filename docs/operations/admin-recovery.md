---
title: "Admin-återställning: MFA och kontoåtkomst"
description: "Procedur för att återställa admin-åtkomst vid borttappad authenticator eller låst konto"
category: operations
status: active
last_updated: 2026-04-22
sections:
  - Borttappad authenticator (TOTP)
  - Konto låst av rate limiting
  - Nollställ MFA via Supabase Dashboard
  - Kontakt och eskalering
---

# Admin-återställning: MFA och kontoåtkomst

## Borttappad authenticator (TOTP)

Om en admin tappat sin authenticator-app och inte kan logga in:

### Steg 1: Verifiera identitet

Kontakta systemansvarig (Johan) via en säker kanal (inte e-post). Bekräfta identiteten.

### Steg 2: Nollställ MFA-faktor i Supabase Dashboard

1. Logga in på [Supabase Dashboard](https://supabase.com/dashboard)
2. Välj projektet
3. Gå till **Authentication → Users**
4. Hitta admin-användaren (e-postadress)
5. Klicka på användaren → scrolla till **MFA factors**
6. Radera den enrollade TOTP-faktorn

### Steg 3: Ny enrollment

Admin kan nu logga in med bara lösenord (AAL1). Redirecten till `/admin/mfa/verify` upphör eftersom faktorn är borttagen.

Gå till `/admin/mfa/setup` och enrolla en ny TOTP-faktor med en ny authenticator-app (t.ex. Google Authenticator, Authy, 1Password).

---

## Konto låst av rate limiting

MFA-verifieringen tillåter 3 misslyckade försök per 15 minuter per admin-konto. Vid spärr visas:

> "För många misslyckade försök. Försök igen om 15 minuter."

**Vänta 15 minuter** och försök igen med korrekt kod. Ingen manuell åtgärd krävs.

Om problemet kvarstår efter väntan: kontrollera att authenticator-appens tid är synkroniserad (TOTP-koder är tidskritiska). Aktivera automatisk tidssynk i din authenticator-app.

---

## Nollställ MFA via Supabase Dashboard (SQL)

Alternativt om du har direktåtkomst till databasen:

```sql
-- Visa MFA-faktorer för en specifik användare
SELECT * FROM auth.mfa_factors WHERE user_id = '<user-uuid>';

-- Radera en specifik faktor
DELETE FROM auth.mfa_factors WHERE id = '<factor-id>';
```

**VARNING:** Kör bara dessa kommandon via Supabase SQL-editor, aldrig direkt mot produktionsdatabasen utan backup.

---

## Kontakt och eskalering

| Scenario | Åtgärd |
|----------|--------|
| Tappat authenticator | Kontakta Johan — Supabase Dashboard-rensning |
| Rate limit (15 min) | Vänta, försök igen |
| Glömt lösenord | Supabase Dashboard → Reset Password |
| Konto komprometterat | Ändra lösenord + nollställ MFA omedelbart + granska AdminAuditLog |
