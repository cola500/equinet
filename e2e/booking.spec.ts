import { test, expect } from '@playwright/test';

test.describe('Booking Flow (Customer)', () => {
  test.beforeEach(async ({ page }) => {
    // Logga in som kund först
    // OBS: Detta förutsätter att test@example.com finns i databasen
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/lösenord/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /logga in/i }).click();

    // Vänta på providers page (kunder redirectas dit direkt)
    await expect(page).toHaveURL(/\/providers/, { timeout: 10000 });
  });

  test('should search and filter providers', async ({ page }) => {
    // Gå till leverantörsgalleriet
    await page.goto('/providers');

    // Verifiera att sidan laddats
    await expect(page.getByRole('heading', { name: /hitta tjänsteleverantörer/i })).toBeVisible();

    // Vänta på att providers laddas
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 });

    // Verifiera att leverantörer visas
    await expect(page.locator('[data-testid="provider-card"]').first()).toBeVisible();

    // Använd sökfältet (sök på "Test" som matchar "Test Stall AB")
    await page.getByPlaceholder(/sök/i).fill('Test');

    // Vänta på att resultaten uppdateras
    await page.waitForTimeout(1000); // Vänta lite längre för debounce + filtering

    // Verifiera att leverantörer fortfarande visas efter sökning
    await expect(page.locator('[data-testid="provider-card"]').first()).toBeVisible({ timeout: 5000 });

    // Testa filtrera efter ort
    await page.getByPlaceholder(/filtrera på ort/i).fill('Stockholm');
    await page.waitForTimeout(1000);

    // Verifiera att providers fortfarande visas med båda filter
    await expect(page.locator('[data-testid="provider-card"]').first()).toBeVisible({ timeout: 5000 });

    // Rensa filter
    await page.getByRole('button', { name: /rensa/i }).click();

    // Verifiera att alla leverantörer visas igen
    await expect(page.getByPlaceholder(/sök/i)).toHaveValue('');
  });

  test('should view provider details and services', async ({ page }) => {
    // Gå till leverantörsgalleriet
    await page.goto('/providers');

    // Vänta på att providers laddas
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 });

    // Hitta en provider-card som har tjänster (kollar efter "Tjänster:" text)
    const cardWithServices = page.locator('[data-testid="provider-card"]').filter({ hasText: /Tjänster:/ });

    // Om ingen har tjänster, klicka på första kortet ändå
    const targetCard = (await cardWithServices.count()) > 0
      ? cardWithServices.first()
      : page.locator('[data-testid="provider-card"]').first();

    await targetCard.getByRole('link', { name: /se profil|boka/i }).click();

    // Verifiera att vi är på detaljsidan
    await expect(page).toHaveURL(/\/providers\/[a-zA-Z0-9]+/);

    // Verifiera att företagsnamn visas (det är en CardTitle, inte h1)
    await expect(page.getByText(/Test Stall AB/i)).toBeVisible();

    // Verifiera att tjänster-sektionen visas
    await expect(page.getByRole('heading', { name: /tillgängliga tjänster/i })).toBeVisible();
  });

  test('should complete full booking flow', async ({ page }) => {
    // Gå till leverantörsgalleriet
    await page.goto('/providers');

    // Vänta på providers och hitta en med tjänster
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 });

    const cardWithServices = page.locator('[data-testid="provider-card"]').filter({ hasText: /Tjänster:/ });
    const targetCard = (await cardWithServices.count()) > 0
      ? cardWithServices.first()
      : page.locator('[data-testid="provider-card"]').first();

    await targetCard.getByRole('link', { name: /se profil|boka/i }).click();

    // Vänta på detaljsida
    await expect(page).toHaveURL(/\/providers\/[a-zA-Z0-9]+/);

    // Vänta på att tjänster laddas
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 10000 });

    // Klicka på "Boka" för första tjänsten
    await page.locator('[data-testid="service-card"]').first()
      .getByRole('button', { name: /boka/i }).click();

    // Fyll i bokningsformuläret med unik tid för varje testkörning
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14); // 2 veckor fram
    const dateString = futureDate.toISOString().split('T')[0];

    // Använd unik tid baserad på millisekunder för att undvika kollisioner
    const uniqueMinute = new Date().getMilliseconds() % 60;
    const safeTime = `09:${uniqueMinute.toString().padStart(2, '0')}`;

    await page.getByLabel(/datum/i).fill(dateString);
    await page.getByLabel(/önskad starttid|starttid/i).fill(safeTime);
    // Sluttid beräknas automatiskt från tjänstens varaktighet
    await page.getByLabel(/hästens namn/i).fill('Thunder');
    await page.getByLabel(/information om hästen/i).fill('Lugn och trygg häst');
    await page.getByLabel(/övriga kommentarer/i).fill('Vänligen kom 10 minuter innan');

    // Submitta bokning
    await page.getByRole('button', { name: /skicka bokningsförfrågan/i }).click();

    // Vänta på att dialogen stängs (success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Gå till mina bokningar
    await page.goto('/customer/bookings');

    // Verifiera att bokningen finns på sidan (kan finnas flera från tidigare tester)
    await expect(page.getByText(/thunder/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should prevent double booking', async ({ page }) => {
    // Detta test kräver att det redan finns en bokning för en specifik tid
    // Vi försöker boka samma tid igen

    await page.goto('/providers');
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 });

    const cardWithServices = page.locator('[data-testid="provider-card"]').filter({ hasText: /Tjänster:/ });
    const targetCard = (await cardWithServices.count()) > 0
      ? cardWithServices.first()
      : page.locator('[data-testid="provider-card"]').first();

    await targetCard.getByRole('link', { name: /se profil|boka/i }).click();

    // Klicka på boka
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 10000 });
    await page.locator('[data-testid="service-card"]').first()
      .getByRole('button', { name: /boka/i }).click();

    // Försök boka en tid som redan är bokad (om tillgänglighetskontroll fungerar)
    const today = new Date().toISOString().split('T')[0];

    await page.getByLabel(/datum/i).fill(today);
    await page.getByLabel(/önskad starttid|starttid/i).fill('10:00');
    // Sluttid beräknas automatiskt från tjänstens varaktighet
    await page.getByLabel(/hästens namn/i).fill('Test Horse');

    await page.getByRole('button', { name: /skicka bokningsförfrågan/i }).click();

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
    await page.goto('/customer/bookings');

    // Vänta på sidan att ladda
    await page.waitForTimeout(1000);

    // Räkna antal bokningar
    const bookingCount = await page.locator('[data-testid="booking-item"]').count();

    if (bookingCount === 0) {
      // Empty state ska visas
      await expect(page.getByText(/inga bokningar|du har inte gjort några bokningar/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('link', { name: /bläddra bland leverantörer|hitta leverantörer/i })).toBeVisible();
    } else {
      // Om det finns bokningar, verifiera att minst en visas
      await expect(page.locator('[data-testid="booking-item"]').first()).toBeVisible();
      console.log(`Bookings exist (${bookingCount}), verifying list is shown`);
    }
  });
});
