import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Gå till startsidan
    await page.goto('/');
  });

  test('should register a new customer', async ({ page }) => {
    // Klicka på "Kom igång"
    await page.getByRole('link', { name: /kom igång/i }).click();

    // Välj "Hästägare" (customer)
    await page.getByRole('button', { name: /hästägare/i }).click();

    // Fyll i registreringsformuläret
    await page.getByLabel(/förnamn/i).fill('Test');
    await page.getByLabel(/efternamn/i).fill('Testsson');
    await page.getByLabel(/email/i).fill(`test${Date.now()}@example.com`);
    await page.getByLabel(/telefon/i).fill('0701234567');

    // Fyll i lösenord (måste uppfylla krav)
    const password = 'TestPassword123!';
    await page.getByLabel(/lösenord \*/i).fill(password);

    // Submitta formuläret
    await page.getByRole('button', { name: /skapa konto/i }).click();

    // Vänta på redirect till login (med registered=true parameter)
    await expect(page).toHaveURL(/\/login\?registered=true/, { timeout: 10000 });

    // Verifiera att success-meddelande visas (via toast)
    await expect(page.getByText(/kontot har skapats/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should register a new provider', async ({ page }) => {
    // Klicka på "Kom igång"
    await page.getByRole('link', { name: /kom igång/i }).click();

    // Välj "Tjänsteleverantör" (provider)
    await page.getByRole('button', { name: /tjänsteleverantör/i }).click();

    // Fyll i registreringsformuläret
    await page.getByLabel(/förnamn/i).fill('Leverantör');
    await page.getByLabel(/efternamn/i).fill('Testsson');
    await page.getByLabel(/email/i).fill(`provider${Date.now()}@example.com`);
    await page.getByLabel(/telefon/i).fill('0709876543');

    // Vänta på att leverantör-fälten visas efter att ha valt tjänsteleverantör
    await page.waitForSelector('input[id="businessName"]', { state: 'visible', timeout: 5000 });

    await page.getByLabel(/företagsnamn/i).fill('Test Stall AB');
    await page.getByLabel(/beskrivning/i).fill('Vi erbjuder professionell hovslagning');
    await page.getByLabel(/stad/i).fill('Stockholm');

    // Fyll i lösenord
    const password = 'ProviderPass123!';
    await page.getByLabel(/lösenord \*/i).fill(password);

    // Submitta formuläret
    await page.getByRole('button', { name: /skapa konto/i }).click();

    // Vänta på redirect till login
    await expect(page).toHaveURL(/\/login\?registered=true/, { timeout: 10000 });

    // Verifiera att success-meddelande visas
    await expect(page.getByText(/kontot har skapats/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should login as existing customer', async ({ page }) => {
    // OBS: Detta test kräver att det finns en testanvändare i databasen
    // I en riktig test-miljö skulle vi skapa användaren i beforeEach

    // Gå till login-sidan
    await page.goto('/login');

    // Fyll i login-formulär
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/lösenord/i).fill('TestPassword123!');

    // Submitta
    await page.getByRole('button', { name: /logga in/i }).click();

    // Verifiera redirect - kunder går till /providers
    await expect(page).toHaveURL(/\/providers/, { timeout: 10000 });
  });

  test('should show error on invalid login', async ({ page }) => {
    await page.goto('/login');

    // Fyll i felaktiga credentials
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/lösenord/i).fill('WrongPassword123!');

    // Submitta
    await page.getByRole('button', { name: /logga in/i }).click();

    // Verifiera felmeddelande
    await expect(page.getByText(/ogiltig email eller lösenord/i)).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Först logga in (förutsätter att test@example.com finns)
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/lösenord/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /logga in/i }).click();

    // Vänta på providers page
    await expect(page).toHaveURL(/\/providers/, { timeout: 10000 });

    // Öppna användar-dropdown (klicka på användarnamn/email eller dropdown-trigger)
    await page.getByRole('button', { name: /test@example\.com|test testsson/i }).click();

    // Klicka på "Logga ut" i dropdownen
    await page.getByRole('menuitem', { name: /logga ut/i }).click();

    // Verifiera redirect till startsidan
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  test('should validate password requirements', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: /hästägare/i }).click();

    // Fyll i ett svagt lösenord
    await page.getByLabel(/lösenord \*/i).fill('weak');

    // Verifiera att krav-indikatorn visar fel
    await expect(page.getByText(/minst 8 tecken/i)).toBeVisible();
    await expect(page.getByText(/stor bokstav/i)).toBeVisible();
    await expect(page.getByText(/siffra/i)).toBeVisible();
    await expect(page.getByText(/specialtecken/i)).toBeVisible();
  });
});
