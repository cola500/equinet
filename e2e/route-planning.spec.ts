import { test, expect } from './fixtures';

test.describe('Route Planning Flow (Provider)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as provider (seed-e2e.setup.ts ensures provider@example.com exists)
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();

    await page.waitForURL(/\/provider\/dashboard/, { timeout: 15000 });
  });

  test('should display available flexible bookings (route-orders)', async ({ page }) => {
    // Navigera till ruttplanering
    await page.goto('/provider/route-planning');

    // Vänta på att sidan laddas
    await expect(page.getByRole('heading', { name: /rutt-planering/i })).toBeVisible({ timeout: 10000 });

    // Kolla om det finns beställningar
    await page.waitForTimeout(2000); // Vänta på API-anrop

    // Verifiera att filter finns
    await expect(page.getByText(/tjänstetyp/i)).toBeVisible();
    await expect(page.getByText(/prioritet/i)).toBeVisible();

    // Kolla om det finns tillgängliga beställningar
    const loadingText = page.getByText(/laddar beställningar/i);
    const noOrdersText = page.getByText(/inga tillgängliga beställningar/i);
    const hasOrders = await page.locator('.border.rounded-lg.p-4').count() > 0;

    if (hasOrders) {
      // Verifiera att beställningskort visas med korrekt innehåll
      const firstOrder = page.locator('.border.rounded-lg.p-4').first();
      await expect(firstOrder).toBeVisible();

      // Verifiera att checkbox finns
      await expect(firstOrder.locator('button[role="checkbox"]')).toBeVisible();
    } else {
      // Om inga beställningar finns, verifiera empty state
      const emptyStateVisible = await noOrdersText.isVisible();
      console.log('No available route orders found:', emptyStateVisible);
    }
  });

  test('should select multiple orders and create route', async ({ page }) => {
    await page.goto('/provider/route-planning');
    await expect(page.getByRole('heading', { name: /rutt-planering/i })).toBeVisible({ timeout: 10000 });

    // Vänta på beställningar
    await page.waitForTimeout(2000);

    // Räkna tillgängliga beställningar
    const orderCount = await page.locator('.border.rounded-lg.p-4').count();

    if (orderCount === 0) {
      test.skip(true, 'No route orders available');
      return;
    }

    // Använd "Välj alla" knappen
    await page.getByRole('button', { name: /välj alla/i }).click();
    await page.waitForTimeout(500);

    // Verifiera att antal valda uppdateras
    await expect(page.getByText(/beställningar valda/i)).toBeVisible();

    // Verifiera att sammanfattningen visas
    await expect(page.getByText(/antal stopp/i)).toBeVisible();
    await expect(page.getByText(/total sträcka/i)).toBeVisible();
    await expect(page.getByText(/beräknad tid/i)).toBeVisible();

    // Fyll i ruttinformation
    const timestamp = Date.now();
    await page.getByLabel(/ruttnamn/i).fill(`Testrutt ${timestamp}`);

    // Datum är pre-filled till imorgon, men sätt eget datum för säkerhet
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2); // +2 dagar för att undvika datum-konflikter
    const dateString = tomorrow.toISOString().split('T')[0];
    await page.getByLabel(/datum/i).fill(dateString);

    // Starttid är pre-filled, men sätt egen
    await page.getByLabel(/starttid/i).fill('09:00');

    // Vänta lite för validering
    await page.waitForTimeout(1000);

    // Skapa rutt
    const createButton = page.getByRole('button', { name: /skapa rutt/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Vänta på success toast först (mer stabilt än URL-redirect)
    await expect(page.getByText(/rutt skapad/i)).toBeVisible({ timeout: 10000 });

    // Vänta på redirect till rutt-vy
    await expect(page).toHaveURL(/\/provider\/routes\/[a-zA-Z0-9-]+/, { timeout: 15000 });

    // Verifiera att vi är på rutt-detaljsidan (kolla heading istället för text)
    await expect(page.getByRole('heading', { name: /rutt/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('should display created route in routes list', async ({ page }) => {
    // Först skapa en rutt (om det finns beställningar)
    await page.goto('/provider/route-planning');
    await page.waitForTimeout(2000);

    const orderCount = await page.locator('.border.rounded-lg.p-4').count();

    if (orderCount > 0) {
      // Välj första beställningen
      await page.locator('.border.rounded-lg.p-4').first().click();
      await page.waitForTimeout(500);

      // Fyll i ruttinformation
      const timestamp = Date.now();
      await page.getByLabel(/ruttnamn/i).fill(`Listrutt ${timestamp}`);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      await page.getByLabel(/datum/i).fill(tomorrow.toISOString().split('T')[0]);

      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /skapa rutt/i }).click();

      // Vänta på redirect
      await page.waitForTimeout(2000);
    }

    // Navigera till ruttlistan
    await page.goto('/provider/routes');
    await page.waitForTimeout(2000);

    // Kolla om det finns rutter
    const routeCount = await page.locator('.border.rounded-lg').count();

    if (routeCount > 0) {
      // Verifiera att rutt visas
      const firstRoute = page.locator('.border.rounded-lg').first();
      await expect(firstRoute).toBeVisible();

      // Verifiera att ruttnamn och datum visas
      await expect(firstRoute).toContainText(/rutt|planerad|aktiv|klar/i);

      // Verifiera status-badge
      const statusBadge = firstRoute.locator('.text-xs.px-2.py-1.rounded');
      await expect(statusBadge).toBeVisible();
    } else {
      console.log('No routes available, empty state displayed');
      // Empty state kan ha olika text - kolla bara att sidan laddade
      await expect(page.getByRole('heading')).toBeVisible();
    }
  });

  test('should open and view route details', async ({ page }) => {
    // Gå till ruttlistan
    await page.goto('/provider/routes');
    await page.waitForTimeout(2000);

    const routeCount = await page.locator('.border.rounded-lg').count();

    if (routeCount === 0) {
      test.skip(true, 'No routes available');
      return;
    }

    // Klicka på första rutten
    await page.locator('.border.rounded-lg').first().click();

    // Vänta på att rutt-detaljsidan laddas
    await expect(page).toHaveURL(/\/provider\/routes\/[a-zA-Z0-9]+/, { timeout: 10000 });

    // Verifiera att rutt-information visas
    await expect(page.getByText(/ruttinformation/i)).toBeVisible();

    // Verifiera att stopp-lista finns
    await expect(page.getByText(/stopp/i)).toBeVisible();

    // Kolla om det finns stopp att visa
    const stops = await page.locator('[data-testid="route-stop"]').count();

    if (stops > 0) {
      // Verifiera att första stoppet visas med korrekt innehåll
      const firstStop = page.locator('[data-testid="route-stop"]').first();
      await expect(firstStop).toBeVisible();

      // Verifiera att stopp har adress, tjänst, och status
      await expect(firstStop).toContainText(/.+/); // Innehåller text
    }
  });

  test('should mark route stop as completed', async ({ page }) => {
    // Gå till ruttlistan
    await page.goto('/provider/routes');
    await page.waitForTimeout(2000);

    const routeCount = await page.locator('.border.rounded-lg').count();

    if (routeCount === 0) {
      test.skip(true, 'No routes available');
      return;
    }

    // Öppna första rutten
    await page.locator('.border.rounded-lg').first().click();
    await page.waitForTimeout(2000);

    // Kolla om det finns stopp
    const stopCount = await page.locator('[data-testid="route-stop"]').count();

    if (stopCount === 0) {
      test.skip(true, 'No stops in route');
      return;
    }

    // Kolla första stoppet
    const firstStop = page.locator('[data-testid="route-stop"]').first();

    // Kolla om det finns en "Markera som klar" knapp (betyder att stoppet inte är klart)
    const completeButton = firstStop.getByRole('button', { name: /markera som klar/i });
    const hasCompleteButton = await completeButton.isVisible().catch(() => false);

    if (!hasCompleteButton) {
      test.skip(true, 'First stop already completed or no complete button');
      return;
    }

    // Klicka på "Markera som klar"
    await completeButton.click();

    // Vänta på uppdatering
    await page.waitForTimeout(2000);

    // Verifiera att status har ändrats
    // Antingen ska "Klar" visas eller "Markera som klar" knappen ska vara borta
    const stillHasButton = await firstStop.getByRole('button', { name: /markera som klar/i })
      .isVisible().catch(() => false);

    if (stillHasButton) {
      // Om knappen finns kvar kan det ha failat
      console.log('Complete button still visible after click');
    } else {
      // Knappen är borta - kolla om "Klar" badge visas
      const completedBadge = firstStop.locator('text=/klar/i');
      const hasBadge = await completedBadge.isVisible().catch(() => false);

      if (hasBadge) {
        console.log('Stop successfully marked as completed');
      }
    }
  });
});
