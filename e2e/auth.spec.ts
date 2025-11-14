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
    await page.click('[data-testid="user-type-customer"]');

    // Vänta lite för att säkerställa att state uppdateras
    await page.waitForTimeout(300);

    // Fyll i registreringsformuläret
    await page.getByLabel(/förnamn/i).fill('Test');
    await page.getByLabel(/efternamn/i).fill('Testsson');
    await page.getByLabel(/email/i).fill(`test${Date.now()}@example.com`);
    await page.getByLabel(/telefon/i).fill('0701234567');

    // Fyll i lösenord (måste uppfylla krav)
    const password = 'TestPassword123!';
    await page.getByLabel(/lösenord \*/i).fill(password);

    // Vänta på att lösenordsvalidering slutförts
    await page.waitForSelector('text=/lösenordet uppfyller alla krav/i', { timeout: 5000 });

    // Submitta formuläret
    await page.getByRole('button', { name: /skapa konto/i }).click();

    // Vänta på redirect till login (med registered=true parameter)
    await expect(page).toHaveURL(/\/login\?registered=true/, { timeout: 15000 });

    // Verifiera att success-meddelande visas (via toast)
    await expect(page.getByText(/kontot har skapats/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should register a new provider', async ({ page }) => {
    // Klicka på "Kom igång"
    await page.getByRole('link', { name: /kom igång/i }).click();

    // Fyll i grundläggande info FÖRST (innan vi väljer provider-typ)
    await page.getByLabel(/förnamn/i).fill('Leverantör');
    await page.getByLabel(/efternamn/i).fill('Testsson');
    await page.getByLabel(/email/i).fill(`provider${Date.now()}@example.com`);
    await page.getByLabel(/telefon/i).fill('0709876543');

    // Välj "Tjänsteleverantör" (provider) - detta gör att provider-fält visas
    await page.click('[data-testid="user-type-provider"]');

    // Vänta på att businessName-fältet blir SYNLIGT (inte bara attached)
    await page.waitForSelector('#businessName', { state: 'visible', timeout: 5000 });

    // Fyll i provider-specifika fält (nu är de synliga)
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

    // Verifiera redirect - kunder går först till /dashboard som redirectar till /providers
    await expect(page).toHaveURL(/\/(dashboard|providers)/, { timeout: 10000 });

    // Om vi är på /dashboard, vänta på redirect till /providers
    if (page.url().includes('/dashboard')) {
      await expect(page).toHaveURL(/\/providers/, { timeout: 10000 });
    }
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
