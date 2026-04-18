---
slug: tva-faktor-autentisering
title: Tvåfaktorautentisering (MFA)
role: admin
section: Säkerhet
keywords:
  - MFA
  - tvåfaktor
  - 2FA
  - TOTP
  - autentisering
  - säkerhet
  - Google Authenticator
  - Authy
  - QR-kod
  - verifieringskod
summary: Hur du aktiverar och använder tvåfaktorautentisering (MFA) för att skydda ditt admin-konto.
---

Som admin kan du aktivera tvåfaktorautentisering (MFA) för att lägga till ett extra skyddslager på ditt konto. MFA kräver att du anger en tidsbegränsad kod från en autentiseringsapp vid varje inloggning.

---

## Aktivera MFA

1. Logga in på ditt admin-konto
2. Gå till Kontoinställningar
3. Klicka på **Aktivera tvåfaktorautentisering**
4. Skanna QR-koden med din autentiseringsapp (t.ex. Google Authenticator, Authy eller Microsoft Authenticator)
5. Ange den 6-siffriga koden som visas i appen
6. Klicka **Verifiera** -- MFA är nu aktiverat

---

## Logga in med MFA

1. Ange ditt e-postadress och lösenord som vanligt
2. Du omdirigeras till en verifieringssida
3. Öppna din autentiseringsapp och ange den aktuella 6-siffriga koden
4. Klicka **Verifiera** -- du är nu inloggad

Koder är giltiga i 30 sekunder. Om koden har gått ut -- vänta på nästa kod i appen.

---

## Autentiseringsappar som fungerar

- **Google Authenticator** (iOS / Android)
- **Authy** (iOS / Android / Desktop)
- **Microsoft Authenticator** (iOS / Android)
- Alla appar som stöder TOTP (RFC 6238)

---

## Viktigt att veta

- MFA gäller enbart admin-konton
- Förlora aldrig åtkomst till din autentiseringsapp -- det finns för tillfället ingen självservice-återställning
- Kontakta Equinet om du är utlåst

> **Tips:** Aktivera MFA omedelbart efter att du fått admin-behörighet. Det är ditt viktigaste skydd mot obehörig åtkomst.
