import { test, expect } from './fixtures';

test.describe('Horse Registry (Customer)', () => {
  test.beforeEach(async ({ page }) => {
    // Logga in som kund
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('TestPassword123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/providers/, { timeout: 10000 });

    // Navigera till hästsidan
    await page.goto('/customer/horses');
    await expect(page.getByRole('heading', { name: /mina hästar/i })).toBeVisible({ timeout: 10000 });
  });

  test('should display horses page with heading and add button', async ({ page }) => {
    // Verifiera att sidan visas korrekt
    await expect(page.getByRole('heading', { name: /mina hästar/i })).toBeVisible();

    // "Lägg till häst"-knappen ska finnas (antingen i header eller som CTA i empty state)
    const addButton = page.getByRole('button', { name: /lägg till/i });
    const addButtonCount = await addButton.count();
    expect(addButtonCount).toBeGreaterThanOrEqual(1);
  });

  test('should add a new horse', async ({ page }) => {
    const uniqueName = `Testponny ${Date.now()}`;

    // Klicka "Lägg till häst"
    await page.getByRole('button', { name: /lägg till häst/i }).first().click();

    // Vänta på dialogen
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Fyll i formuläret (labels: "Namn *", "Ras", "Färg", "Födelseår", "Kön")
    await page.getByLabel(/^namn/i).fill(uniqueName);
    await page.getByLabel(/^ras$/i).fill('Shetlandsponny');
    await page.getByLabel(/^färg$/i).fill('Brun');
    await page.getByLabel(/födelseår/i).fill('2018');

    // Välj kön via Select-komponenten
    const genderTrigger = page.locator('#horse-gender');
    if (await genderTrigger.isVisible().catch(() => false)) {
      await genderTrigger.click();
      await page.getByRole('option', { name: /valack/i }).click();
    }

    // Spara
    await page.getByRole('button', { name: /^lägg till$/i }).click();

    // Vänta på att dialogen stängs
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    // Verifiera att hästen visas i listan
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 5000 });
  });

  test('should edit an existing horse', async ({ page }) => {
    // Säkerställ att det finns minst en häst - skapa om nödvändigt
    const horseCards = page.locator('.card, [class*="Card"]').filter({ hasText: /redigera/i });
    const cardCount = await horseCards.count();

    if (cardCount === 0) {
      // Skapa en häst först
      await page.getByRole('button', { name: /lägg till häst/i }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByLabel(/^namn/i).fill(`Edithäst ${Date.now()}`);
      await page.getByRole('button', { name: /^lägg till$/i }).click();
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
    }

    // Klicka "Redigera" på första hästen
    await page.getByRole('button', { name: /redigera/i }).first().click();

    // Vänta på redigera-dialogen
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Ändra namn till något unikt
    const updatedName = `Uppdaterad ${Date.now()}`;
    const nameField = page.getByLabel(/^namn/i);
    await nameField.clear();
    await nameField.fill(updatedName);

    // Spara ändringar
    await page.getByRole('button', { name: /spara ändringar/i }).click();

    // Vänta på att dialogen stängs
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    // Verifiera att det uppdaterade namnet visas
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 5000 });
  });

  test('should delete a horse with confirmation', async ({ page }) => {
    // Säkerställ att det finns minst en häst
    const deleteButtons = page.getByRole('button', { name: /ta bort/i });
    const deleteCount = await deleteButtons.count();

    if (deleteCount === 0) {
      // Skapa en häst att ta bort
      await page.getByRole('button', { name: /lägg till häst/i }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByLabel(/^namn/i).fill(`Borthäst ${Date.now()}`);
      await page.getByRole('button', { name: /^lägg till$/i }).click();
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
    }

    // Räkna hästar före borttagning
    const deleteButtonsBefore = page.getByRole('button', { name: /^ta bort$/i });
    const countBefore = await deleteButtonsBefore.count();

    // Klicka "Ta bort" på första hästen
    await deleteButtonsBefore.first().click();

    // Bekräftelsedialog ska visas (alertdialog på desktop, drawer på mobil)
    await expect(page.getByText(/bokningar påverkas inte/i)).toBeVisible({ timeout: 5000 });

    // Bekräfta borttagning -- vänta på nätverksanrop för att vara säker
    const deletePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/horses/') && resp.request().method() === 'DELETE'
    );
    const confirmButton = page.getByRole('button', { name: /^ta bort$/i }).last();
    await confirmButton.click();
    await deletePromise;

    // Vänta på att bekräftelsedialogens text försvinner
    await expect(page.getByText(/bokningar påverkas inte/i)).toBeHidden({ timeout: 10000 });

    // Verifiera att antalet hästar minskat (vänta på att sidan uppdateras)
    await expect(async () => {
      const countAfter = await page.getByRole('button', { name: /^ta bort$/i }).count();
      expect(countAfter).toBeLessThan(countBefore);
    }).toPass({ timeout: 10000 });
  });

  test('should navigate to horse history', async ({ page }) => {
    // Säkerställ att det finns minst en häst
    const historyLinks = page.getByRole('button', { name: /se historik/i });
    const linkCount = await historyLinks.count();

    if (linkCount === 0) {
      // Skapa en häst
      await page.getByRole('button', { name: /lägg till häst/i }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByLabel(/^namn/i).fill(`Historikhäst ${Date.now()}`);
      await page.getByRole('button', { name: /^lägg till$/i }).click();
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
    }

    // Klicka "Se historik" på första hästen
    await page.getByRole('button', { name: /se historik/i }).first().click();

    // Verifiera navigation till hästens detaljsida
    await expect(page).toHaveURL(/\/customer\/horses\/[a-zA-Z0-9-]+/, { timeout: 10000 });

    // Verifiera att historik-sektionen visas
    await expect(page.getByRole('heading', { name: /historik/i })).toBeVisible({ timeout: 5000 });

    // Verifiera tillbaka-länk finns
    await expect(page.getByText(/tillbaka till mina hästar/i)).toBeVisible();
  });
});
