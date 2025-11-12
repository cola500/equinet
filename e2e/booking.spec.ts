import { test, expect } from '@playwright/test';

test.describe('Booking Flow (Customer)', () => {
  test.beforeEach(async ({ page }) => {
    // Logga in som kund först
    // OBS: Detta förutsätter att test@example.com finns i databasen
    await page.goto('/auth/login');
    await page.getByLabel(/e-post/i).fill('test@example.com');
    await page.getByLabel(/lösenord/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /logga in/i }).click();

    // Vänta på dashboard
    await expect(page).toHaveURL(/\/customer\/dashboard/, { timeout: 10000 });
  });

  test('should search and filter providers', async ({ page }) => {
    // Gå till leverantörsgalleriet
    await page.goto('/providers');

    // Verifiera att sidan laddats
    await expect(page.getByRole('heading', { name: /hitta leverantörer/i })).toBeVisible();

    // Använd sökfältet
    await page.getByPlaceholder(/sök/i).fill('hovslagning');

    // Vänta på att resultaten uppdateras
    await page.waitForTimeout(600); // Debounce delay

    // Verifiera att leverantörer visas
    await expect(page.locator('[data-testid="provider-card"]').first()).toBeVisible({ timeout: 5000 });

    // Testa filtrera efter ort
    await page.getByPlaceholder(/filtrera på ort/i).fill('Stockholm');
    await page.waitForTimeout(600);

    // Rensa filter
    await page.getByRole('button', { name: /rensa alla filter/i }).click();

    // Verifiera att alla leverantörer visas igen
    await expect(page.getByPlaceholder(/sök/i)).toHaveValue('');
  });

  test('should view provider details and services', async ({ page }) => {
    // Gå till leverantörsgalleriet
    await page.goto('/providers');

    // Vänta på att providers laddas
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 });

    // Klicka på första leverantören
    await page.locator('[data-testid="provider-card"]').first().click();

    // Verifiera att vi är på detaljsidan
    await expect(page).toHaveURL(/\/providers\/[a-zA-Z0-9]+/);

    // Verifiera att företagsnamn visas
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Verifiera att tjänster visas
    await expect(page.getByText(/tjänster/i)).toBeVisible();
  });

  test('should complete full booking flow', async ({ page }) => {
    // Gå till leverantörsgalleriet
    await page.goto('/providers');

    // Vänta och klicka på första leverantören
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 });
    await page.locator('[data-testid="provider-card"]').first().click();

    // Vänta på detaljsida
    await expect(page).toHaveURL(/\/providers\/[a-zA-Z0-9]+/);

    // Vänta på att tjänster laddas
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 5000 });

    // Klicka på "Boka" för första tjänsten
    await page.locator('[data-testid="service-card"]').first()
      .getByRole('button', { name: /boka/i }).click();

    // Fyll i bokningsformuläret
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];

    await page.getByLabel(/datum/i).fill(dateString);
    await page.getByLabel(/starttid/i).fill('10:00');
    await page.getByLabel(/sluttid/i).fill('11:00');
    await page.getByLabel(/hästens namn/i).fill('Thunder');
    await page.getByLabel(/information om hästen/i).fill('Lugn och trygg häst');
    await page.getByLabel(/övriga kommentarer/i).fill('Vänligen kom 10 minuter innan');

    // Submitta bokning
    await page.getByRole('button', { name: /bekräfta bokning/i }).click();

    // Verifiera success-meddelande eller redirect
    await expect(page.getByText(/bokningen har skickats|bokning mottagen/i)).toBeVisible({ timeout: 5000 });

    // Gå till mina bokningar
    await page.goto('/customer/bookings');

    // Verifiera att bokningen finns där
    await expect(page.getByText(/thunder/i)).toBeVisible({ timeout: 5000 });
  });

  test('should prevent double booking', async ({ page }) => {
    // Detta test kräver att det redan finns en bokning för en specifik tid
    // Vi försöker boka samma tid igen

    await page.goto('/providers');
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 });
    await page.locator('[data-testid="provider-card"]').first().click();

    // Klicka på boka
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 5000 });
    await page.locator('[data-testid="service-card"]').first()
      .getByRole('button', { name: /boka/i }).click();

    // Försök boka en tid som redan är bokad (om tillgänglighetskontroll fungerar)
    const today = new Date().toISOString().split('T')[0];

    await page.getByLabel(/datum/i).fill(today);
    await page.getByLabel(/starttid/i).fill('10:00');
    await page.getByLabel(/sluttid/i).fill('11:00');
    await page.getByLabel(/hästens namn/i).fill('Test Horse');

    await page.getByRole('button', { name: /bekräfta bokning/i }).click();

    // Förvänta felmeddelande om tiden är bokad
    // (Detta kräver att tidskontroll är implementerad i UI)
    await expect(page.getByText(/redan bokad|inte tillgänglig/i)).toBeVisible({ timeout: 5000 });
  });

  test('should cancel a booking', async ({ page }) => {
    // Gå till mina bokningar
    await page.goto('/customer/bookings');

    // Vänta på att bokningar laddas
    await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 });

    // Klicka på "Avboka" för första bokningen
    await page.locator('[data-testid="booking-item"]').first()
      .getByRole('button', { name: /avboka/i }).click();

    // Bekräfta i dialogen
    await page.getByRole('button', { name: /ja|bekräfta/i }).click();

    // Verifiera success-meddelande
    await expect(page.getByText(/bokningen har avbokats|avbokning lyckades/i)).toBeVisible({ timeout: 5000 });
  });

  test('should display empty state when no bookings', async ({ page }) => {
    // Detta test förutsätter att användaren inte har några bokningar
    // eller att alla har avbokats

    await page.goto('/customer/bookings');

    // Verifiera empty state
    await expect(page.getByText(/inga bokningar|du har inte gjort några bokningar/i)).toBeVisible({ timeout: 5000 });

    // Verifiera att det finns en CTA för att boka
    await expect(page.getByRole('link', { name: /bläddra bland leverantörer|hitta leverantörer/i })).toBeVisible();
  });
});
