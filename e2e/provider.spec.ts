import { test, expect } from '@playwright/test';

test.describe('Provider Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Logga in som leverantör
    // OBS: Detta förutsätter att provider@example.com finns i databasen
    await page.goto('/auth/login');
    await page.getByLabel(/e-post/i).fill('provider@example.com');
    await page.getByLabel(/lösenord/i).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();

    // Vänta på provider dashboard
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 });
  });

  test('should display provider dashboard with stats', async ({ page }) => {
    // Verifiera att dashboard visas
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Verifiera statistik-cards
    await expect(page.getByText(/totala bokningar|pending|bekräftade/i)).toBeVisible();

    // Verifiera att onboarding-checklista visas för nya leverantörer
    // (om leverantören inte har slutfört allt)
    const onboardingExists = await page.getByText(/kom igång|onboarding/i).isVisible().catch(() => false);

    if (onboardingExists) {
      await expect(page.getByText(/skapa din första tjänst/i)).toBeVisible();
    }
  });

  test('should create a new service', async ({ page }) => {
    // Gå till tjänster-sidan
    await page.goto('/provider/services');

    // Klicka på "Skapa tjänst"
    await page.getByRole('button', { name: /skapa tjänst|lägg till tjänst/i }).click();

    // Fyll i tjänsteformuläret
    await page.getByLabel(/tjänstens namn/i).fill('Hovslagning Standard');
    await page.getByLabel(/beskrivning/i).fill('Professionell hovslagning för alla hästar');
    await page.getByLabel(/pris/i).fill('800');
    await page.getByLabel(/varaktighet \(minuter\)/i).fill('60');

    // Submitta
    await page.getByRole('button', { name: /spara|skapa/i }).click();

    // Verifiera success-meddelande
    await expect(page.getByText(/tjänsten har skapats|tjänst tillagd/i)).toBeVisible({ timeout: 5000 });

    // Verifiera att tjänsten visas i listan
    await expect(page.getByText(/hovslagning standard/i)).toBeVisible();
  });

  test('should edit an existing service', async ({ page }) => {
    await page.goto('/provider/services');

    // Vänta på att tjänster laddas
    await page.waitForSelector('[data-testid="service-item"]', { timeout: 10000 });

    // Klicka på "Redigera" för första tjänsten
    await page.locator('[data-testid="service-item"]').first()
      .getByRole('button', { name: /redigera|edit/i }).click();

    // Uppdatera priset
    await page.getByLabel(/pris/i).clear();
    await page.getByLabel(/pris/i).fill('900');

    // Spara ändringar
    await page.getByRole('button', { name: /spara|uppdatera/i }).click();

    // Verifiera success-meddelande
    await expect(page.getByText(/tjänsten har uppdaterats|ändringar sparade/i)).toBeVisible({ timeout: 5000 });

    // Verifiera att nya priset visas
    await expect(page.getByText(/900 kr/i)).toBeVisible();
  });

  test('should toggle service active status', async ({ page }) => {
    await page.goto('/provider/services');

    await page.waitForSelector('[data-testid="service-item"]', { timeout: 10000 });

    // Hitta toggle-knappen (kan vara en switch eller checkbox)
    const toggleButton = page.locator('[data-testid="service-item"]').first()
      .getByRole('switch').or(page.getByRole('checkbox', { name: /aktiv/i }));

    // Klicka på toggle
    await toggleButton.click();

    // Verifiera status-ändring
    await expect(page.getByText(/status uppdaterad|tjänst (in)?aktiverad/i)).toBeVisible({ timeout: 5000 });
  });

  test('should delete a service', async ({ page }) => {
    await page.goto('/provider/services');

    await page.waitForSelector('[data-testid="service-item"]', { timeout: 10000 });

    // Klicka på "Ta bort" för första tjänsten
    await page.locator('[data-testid="service-item"]').first()
      .getByRole('button', { name: /ta bort|delete/i }).click();

    // Bekräfta i dialogen
    await page.getByRole('button', { name: /ja|bekräfta|ta bort/i }).click();

    // Verifiera success-meddelande
    await expect(page.getByText(/tjänsten har tagits bort|tjänst raderad/i)).toBeVisible({ timeout: 5000 });
  });

  test('should view and manage bookings', async ({ page }) => {
    await page.goto('/provider/bookings');

    // Verifiera att bokningssidan visas
    await expect(page.getByRole('heading', { name: /bokningar/i })).toBeVisible();

    // Verifiera tabs för olika bokningsstatus
    await expect(page.getByRole('tab', { name: /väntande|pending/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /bekräftad/i })).toBeVisible();

    // Klicka på pending-tab
    await page.getByRole('tab', { name: /väntande|pending/i }).click();

    // Om det finns väntande bokningar, visa hanteringsalternativ
    const hasPendingBookings = await page.locator('[data-testid="booking-item"]')
      .isVisible().catch(() => false);

    if (hasPendingBookings) {
      // Verifiera att "Acceptera" och "Avvisa" knappar visas
      await expect(page.getByRole('button', { name: /acceptera/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /avvisa/i }).first()).toBeVisible();
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
