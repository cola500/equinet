import { test, expect } from '@playwright/test';

test.describe('Provider Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Logga in som leverantör
    // OBS: Detta förutsätter att provider@example.com finns i databasen
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel(/lösenord/i).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();

    // Vänta på provider dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should display provider dashboard with stats', async ({ page }) => {
    // Verifiera att dashboard visas med rätt rubrik
    await expect(page.getByRole('heading', { name: /välkommen tillbaka/i })).toBeVisible();

    // Verifiera statistik-cards (exakta texter från koden)
    await expect(page.getByText(/aktiva tjänster/i)).toBeVisible();
    await expect(page.getByText(/kommande bokningar/i)).toBeVisible();
    await expect(page.getByText(/nya förfrågningar/i)).toBeVisible();

    // Verifiera snabblänkar
    await expect(page.getByText(/snabblänkar/i)).toBeVisible();
  });

  test('should create a new service', async ({ page }) => {
    // Gå till tjänster-sidan
    await page.goto('/provider/services');

    // Klicka på "Lägg till tjänst"
    await page.getByRole('button', { name: /lägg till tjänst/i }).click();

    // Vänta på att dialog öppnas
    await expect(page.getByRole('heading', { name: /lägg till ny tjänst/i })).toBeVisible();

    // Fyll i tjänsteformuläret (exakta labels från koden)
    await page.getByLabel(/tjänstens namn \*/i).fill('E2E Test Service');
    await page.getByLabel(/beskrivning/i).fill('Test beskrivning');
    await page.getByLabel(/pris \(kr\) \*/i).fill('500');
    await page.getByLabel(/varaktighet \(min\) \*/i).fill('45');

    // Submitta (knappen heter "Skapa" när man skapar ny)
    await page.getByRole('button', { name: /^skapa$/i }).click();

    // Vänta på att dialog stängs och tjänsten visas
    await expect(page.locator('[data-testid="service-item"]').filter({ hasText: 'E2E Test Service' })).toBeVisible({ timeout: 5000 });
  });

  test('should edit an existing service', async ({ page }) => {
    await page.goto('/provider/services');

    // Vänta på att tjänster laddas
    await page.waitForSelector('[data-testid="service-item"]', { timeout: 10000 });

    // Klicka på "Redigera" för första tjänsten
    await page.locator('[data-testid="service-item"]').first()
      .getByRole('button', { name: /redigera/i }).click();

    // Vänta på att dialog öppnas med "Redigera tjänst" rubrik
    await expect(page.getByRole('heading', { name: /redigera tjänst/i })).toBeVisible();

    // Uppdatera priset (exakt label från koden)
    await page.getByLabel(/pris \(kr\) \*/i).clear();
    await page.getByLabel(/pris \(kr\) \*/i).fill('999');

    // Spara ändringar (knappen heter "Uppdatera" när man redigerar)
    await page.getByRole('button', { name: /^uppdatera$/i }).click();

    // Vänta på att dialog stängs och tjänsten uppdateras
    await expect(page.locator('[data-testid="service-item"]').filter({ hasText: '999 kr' })).toBeVisible({ timeout: 5000 });
  });

  test('should toggle service active status', async ({ page }) => {
    await page.goto('/provider/services');

    await page.waitForSelector('[data-testid="service-item"]', { timeout: 10000 });

    // Status badge är en clickable button med text "Aktiv" eller "Inaktiv"
    const firstService = page.locator('[data-testid="service-item"]').first();
    const statusBadge = firstService.locator('button').filter({ hasText: /^aktiv$|^inaktiv$/i });

    // Kolla nuvarande status
    const initialStatus = (await statusBadge.textContent())?.trim();

    // Klicka på status badge för att toggla
    await statusBadge.click();

    // Vänta på att toast visas (indikerar att API-anrop lyckats)
    await page.waitForTimeout(1500);

    // Sidan refreshar automatiskt, så vi måste hitta badge igen
    const newStatusBadge = page.locator('[data-testid="service-item"]').first()
      .locator('button').filter({ hasText: /^aktiv$|^inaktiv$/i });

    const newStatus = (await newStatusBadge.textContent())?.trim();

    // Verifiera att status har ändrats
    expect(newStatus).not.toBe(initialStatus);
  });

  test('should delete a service', async ({ page }) => {
    await page.goto('/provider/services');

    await page.waitForSelector('[data-testid="service-item"]', { timeout: 10000 });

    // Räkna antal tjänster innan borttagning
    const initialCount = await page.locator('[data-testid="service-item"]').count();

    // Setup dialog handler
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('säker');
      dialog.accept();
    });

    // Klicka på "Ta bort" för första tjänsten
    await page.locator('[data-testid="service-item"]').first()
      .getByRole('button', { name: /ta bort/i }).click();

    // Vänta på att tjänsten försvinner
    await page.waitForTimeout(1500);

    // Verifiera att antalet tjänster har minskat
    const newCount = await page.locator('[data-testid="service-item"]').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should view and manage bookings', async ({ page }) => {
    await page.goto('/provider/bookings');

    // Verifiera att bokningssidan visas (exakt rubrik från koden)
    await expect(page.getByRole('heading', { name: /^bokningar$/i })).toBeVisible();

    // Verifiera filter-tabs (buttons, inte tabs - från koden)
    await expect(page.getByRole('button', { name: /väntar på svar/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /bekräftade/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /alla/i })).toBeVisible();

    // Klicka på "Väntar på svar" tab
    await page.getByRole('button', { name: /väntar på svar/i }).click();

    // Om det finns väntande bokningar, visa hanteringsalternativ
    const hasPendingBookings = await page.locator('[data-testid="booking-item"]')
      .isVisible().catch(() => false);

    if (hasPendingBookings) {
      // Verifiera att "Acceptera" och "Avböj" knappar visas (från koden)
      await expect(page.getByRole('button', { name: /acceptera/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /avböj/i }).first()).toBeVisible();
    }
  });

  test('should accept a pending booking', async ({ page }) => {
    await page.goto('/provider/bookings');

    // Klicka på pending-tab
    await page.getByRole('tab', { name: /väntande|pending/i }).click();

    // Vänta på bokningar
    await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 });

    // Klicka på "Acceptera" för första bokningen
    await page.locator('[data-testid="booking-item"]').first()
      .getByRole('button', { name: /acceptera/i }).click();

    // Verifiera success-meddelande
    await expect(page.getByText(/bokning accepterad|bokningen har godkänts/i)).toBeVisible({ timeout: 5000 });

    // Verifiera att bokningen flyttats till "Bekräftad"-tab
    await page.getByRole('tab', { name: /bekräftad/i }).click();
    await expect(page.locator('[data-testid="booking-item"]').first()).toBeVisible();
  });

  test('should reject a pending booking', async ({ page }) => {
    await page.goto('/provider/bookings');

    await page.getByRole('tab', { name: /väntande|pending/i }).click();
    await page.waitForSelector('[data-testid="booking-item"]', { timeout: 10000 });

    // Klicka på "Avvisa"
    await page.locator('[data-testid="booking-item"]').first()
      .getByRole('button', { name: /avvisa/i }).click();

    // Verifiera success-meddelande
    await expect(page.getByText(/bokning avvisad|bokningen har nekats/i)).toBeVisible({ timeout: 5000 });
  });

  test('should update provider profile', async ({ page }) => {
    await page.goto('/provider/profile');

    // Verifiera att profilsidan visas
    await expect(page.getByRole('heading', { name: /profil|företagsinformation/i })).toBeVisible();

    // Uppdatera beskrivning
    await page.getByLabel(/beskrivning/i).clear();
    await page.getByLabel(/beskrivning/i).fill('Uppdaterad beskrivning av våra tjänster');

    // Uppdatera ort
    await page.getByLabel(/ort/i).clear();
    await page.getByLabel(/ort/i).fill('Göteborg');

    // Spara ändringar
    await page.getByRole('button', { name: /spara|uppdatera/i }).click();

    // Verifiera success-meddelande
    await expect(page.getByText(/profil uppdaterad|ändringar sparade/i)).toBeVisible({ timeout: 5000 });

    // Verifiera att profilkompletteringsindikator uppdateras (om den finns)
    const progressBar = await page.locator('[role="progressbar"]').isVisible().catch(() => false);

    if (progressBar) {
      // Profilen borde vara mer komplett nu
      await expect(page.getByText(/\d+%/)).toBeVisible();
    }
  });

  test('should display empty states appropriately', async ({ page }) => {
    // Gå till tjänster (förutsatt att leverantören inte har några tjänster)
    await page.goto('/provider/services');

    // Verifiera empty state
    const hasServices = await page.locator('[data-testid="service-item"]').isVisible().catch(() => false);

    if (!hasServices) {
      await expect(page.getByText(/inga tjänster|du har inte skapat några tjänster/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /skapa din första tjänst/i })).toBeVisible();
    }
  });
});
