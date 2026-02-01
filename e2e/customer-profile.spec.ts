import { test, expect } from './fixtures';

test.describe('Customer Profile', () => {
  test.beforeEach(async ({ page }) => {
    // Logga in som kund
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/lösenord/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/providers/, { timeout: 10000 });

    // Navigera till profilsidan
    await page.goto('/customer/profile');
    await expect(page.getByRole('heading', { name: /min profil/i })).toBeVisible({ timeout: 10000 });
  });

  test('should display profile in read mode', async ({ page }) => {
    // Verifiera rubrik
    await expect(page.getByRole('heading', { name: /min profil/i })).toBeVisible();

    // Verifiera att profilinformation visas
    await expect(page.getByText(/profilinformation/i)).toBeVisible();

    // Verifiera att e-post-fältet visas (read-only)
    await expect(page.getByText(/e-post/i)).toBeVisible();
    await expect(page.getByText('test@example.com')).toBeVisible();

    // Verifiera att redigera-knappen finns
    await expect(page.getByRole('button', { name: /redigera profil/i })).toBeVisible();
  });

  test('should edit profile information', async ({ page }) => {
    // Gå till redigeringsläge
    await page.getByRole('button', { name: /redigera profil/i }).click();

    // Verifiera att vi är i redigeringsläge - formulärfält ska vara synliga
    const firstNameField = page.getByLabel(/förnamn/i);
    await expect(firstNameField).toBeVisible({ timeout: 5000 });

    // Spara originalvärden för att återställa efteråt
    const originalFirstName = await firstNameField.inputValue();

    // Ändra förnamn
    const updatedName = `TestNamn${Date.now() % 1000}`;
    await firstNameField.clear();
    await firstNameField.fill(updatedName);

    // Ändra ort
    const cityField = page.getByLabel(/^ort$/i).or(page.locator('#city'));
    if (await cityField.isVisible().catch(() => false)) {
      await cityField.clear();
      await cityField.fill('Göteborg');
    }

    // Spara ändringar
    await page.getByRole('button', { name: /spara ändringar/i }).click();

    // Vänta på att sparning slutförs - tillbaka till read mode
    await expect(page.getByRole('button', { name: /redigera profil/i })).toBeVisible({ timeout: 10000 });

    // Verifiera att det uppdaterade namnet visas
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 5000 });

    // Återställ originalnamnet
    await page.getByRole('button', { name: /redigera profil/i }).click();
    await expect(firstNameField).toBeVisible({ timeout: 5000 });
    await firstNameField.clear();
    await firstNameField.fill(originalFirstName);
    await page.getByRole('button', { name: /spara ändringar/i }).click();
    await expect(page.getByRole('button', { name: /redigera profil/i })).toBeVisible({ timeout: 10000 });
  });

  test('should cancel editing without saving', async ({ page }) => {
    // Gå till redigeringsläge
    await page.getByRole('button', { name: /redigera profil/i }).click();

    const firstNameField = page.getByLabel(/förnamn/i);
    await expect(firstNameField).toBeVisible({ timeout: 5000 });

    // Spara originalvärdet
    const originalFirstName = await firstNameField.inputValue();

    // Ändra förnamn
    await firstNameField.clear();
    await firstNameField.fill('TemporaryName');

    // Klicka avbryt
    await page.getByRole('button', { name: /avbryt/i }).click();

    // Tillbaka i read mode
    await expect(page.getByRole('button', { name: /redigera profil/i })).toBeVisible({ timeout: 5000 });

    // Verifiera att ändringen inte sparades
    // "TemporaryName" ska INTE visas någonstans på sidan
    await expect(page.getByText('TemporaryName')).toBeHidden();

    // Förnamn-labeln ska fortfarande visa originalvärdet i read mode
    // Vi letar efter texten bredvid "Förnamn"-labeln
    const fornamn = page.locator('text=Förnamn').locator('..').locator('p.font-medium, p strong, p');
    if (originalFirstName && await fornamn.first().isVisible().catch(() => false)) {
      const displayedName = await fornamn.first().textContent();
      expect(displayedName).toBe(originalFirstName);
    }
  });

  test('should have email field locked in edit mode', async ({ page }) => {
    // Gå till redigeringsläge
    await page.getByRole('button', { name: /redigera profil/i }).click();

    // Vänta på att formuläret visas
    await expect(page.getByLabel(/förnamn/i)).toBeVisible({ timeout: 5000 });

    // E-postfältet ska vara disabled - hitta det via disabled-attribut
    const disabledEmailInput = page.locator('input:disabled');
    await expect(disabledEmailInput.first()).toBeVisible();

    // Verifiera förklaringstext om att e-post inte kan ändras
    await expect(page.getByText(/kan inte ändras/i)).toBeVisible();
  });
});
