import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Gå till startsidan
    await page.goto('/');
  });

  test('should register a new customer', async ({ page }) => {
    // Klicka på "Kom igång"
    await page.getByRole('link', { name: /kom igång/i }).click();

    // Välj "Kund" (customer)
    await page.getByRole('button', { name: /kund/i }).click();

    // Fyll i registreringsformuläret
    await page.getByLabel(/förnamn/i).fill('Test');
    await page.getByLabel(/efternamn/i).fill('Testsson');
    await page.getByLabel(/e-post/i).fill(`test${Date.now()}@example.com`);
    await page.getByLabel(/telefon/i).fill('0701234567');

    // Fyll i lösenord (måste uppfylla krav)
    const password = 'TestPassword123!';
    await page.getByLabel(/^lösenord$/i).fill(password);
    await page.getByLabel(/bekräfta lösenord/i).fill(password);

    // Submitta formuläret
    await page.getByRole('button', { name: /skapa konto/i }).click();

    // Vänta på redirect och verifiera att vi är inloggade
    await expect(page).toHaveURL(/\/customer\/dashboard/, { timeout: 10000 });

    // Verifiera att vi ser kundens dashboard
    await expect(page.getByText(/välkommen/i)).toBeVisible();
  });

  test('should register a new provider', async ({ page }) => {
    // Klicka på "Kom igång"
    await page.getByRole('link', { name: /kom igång/i }).click();

    // Välj "Leverantör" (provider)
    await page.getByRole('button', { name: /leverantör/i }).click();

    // Fyll i registreringsformuläret
    await page.getByLabel(/förnamn/i).fill('Leverantör');
    await page.getByLabel(/efternamn/i).fill('Testsson');
    await page.getByLabel(/e-post/i).fill(`provider${Date.now()}@example.com`);
    await page.getByLabel(/telefon/i).fill('0709876543');
    await page.getByLabel(/företagsnamn/i).fill('Test Stall AB');
    await page.getByLabel(/beskrivning/i).fill('Vi erbjuder professionell hovslagning');
    await page.getByLabel(/ort/i).fill('Stockholm');

    // Fyll i lösenord
    const password = 'ProviderPass123!';
    await page.getByLabel(/^lösenord$/i).fill(password);
    await page.getByLabel(/bekräfta lösenord/i).fill(password);

    // Submitta formuläret
    await page.getByRole('button', { name: /skapa konto/i }).click();

    // Vänta på redirect och verifiera att vi är inloggade
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 });

    // Verifiera att vi ser leverantörens dashboard
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should login as existing customer', async ({ page }) => {
    // OBS: Detta test kräver att det finns en testanvändare i databasen
    // I en riktig test-miljö skulle vi skapa användaren i beforeEach

    // Gå till login-sidan
    await page.goto('/auth/login');

    // Fyll i login-formulär
    await page.getByLabel(/e-post/i).fill('test@example.com');
    await page.getByLabel(/lösenord/i).fill('TestPassword123!');

    // Submitta
    await page.getByRole('button', { name: /logga in/i }).click();

    // Verifiera redirect (kund eller leverantör beroende på vad som finns i DB)
    await expect(page).toHaveURL(/\/(customer|provider)\/dashboard/, { timeout: 10000 });
  });

  test('should show error on invalid login', async ({ page }) => {
    await page.goto('/auth/login');

    // Fyll i felaktiga credentials
    await page.getByLabel(/e-post/i).fill('invalid@example.com');
    await page.getByLabel(/lösenord/i).fill('WrongPassword123!');

    // Submitta
    await page.getByRole('button', { name: /logga in/i }).click();

    // Verifiera felmeddelande
    await expect(page.getByText(/felaktiga uppgifter|ogiltiga uppgifter|incorrect/i)).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Först logga in (förutsätter att test@example.com finns)
    await page.goto('/auth/login');
    await page.getByLabel(/e-post/i).fill('test@example.com');
    await page.getByLabel(/lösenord/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /logga in/i }).click();

    // Vänta på dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Klicka på logout (kan vara i en dropdown)
    await page.getByRole('button', { name: /logga ut|log out/i }).click();

    // Verifiera redirect till startsidan eller login
    await expect(page).toHaveURL(/\/(auth\/login)?$/, { timeout: 5000 });
  });

  test('should validate password requirements', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByRole('button', { name: /kund/i }).click();

    // Fyll i ett svagt lösenord
    await page.getByLabel(/^lösenord$/i).fill('weak');

    // Verifiera att krav-indikatorn visar fel
    await expect(page.getByText(/minst 8 tecken/i)).toBeVisible();
    await expect(page.getByText(/stor bokstav/i)).toBeVisible();
    await expect(page.getByText(/siffra/i)).toBeVisible();
    await expect(page.getByText(/specialtecken/i)).toBeVisible();
  });
});
