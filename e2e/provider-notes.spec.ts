import { test, expect } from './fixtures';
import { prisma } from './fixtures';
import { seedBooking, getBaseEntities, cleanupSpecData } from './setup/seed-helpers';

const SPEC_TAG = 'provider-notes';

/**
 * E2E Tests for Provider Notes
 *
 * Tests (Calendar - BookingDetailDialog):
 * - Add a note on a confirmed booking (via calendar -> BookingDetailDialog)
 * - Edit an existing note
 * - Pending bookings should not show notes section
 * - Character counter shows {length}/2000
 *
 * Tests (Customer Registry - inline edit):
 * - Edit an existing note inline (pencil icon)
 * - Show "(redigerad)" label after editing
 * - Cancel inline edit without saving
 *
 * Provider notes are accessible via BookingDetailDialog (calendar) and Customer Registry.
 */

test.describe('Provider Notes', () => {
  test.beforeAll(async () => {
    await cleanupSpecData(SPEC_TAG);
    await seedBooking({ specTag: SPEC_TAG, status: 'confirmed', daysFromNow: 3, horseName: 'E2E NotesConfirmed', startTime: '10:00', endTime: '11:00' });
    await seedBooking({ specTag: SPEC_TAG, status: 'pending', daysFromNow: 7, horseName: 'E2E NotesPending' });
  });

  test.afterAll(async () => {
    await cleanupSpecData(SPEC_TAG);
  });

  test.beforeEach(async ({ page }) => {
    // Logga in som provider
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 });
  });

  /**
   * Helper: Navigate to a confirmed booking in calendar and open BookingDetailDialog.
   * Scans forward up to 5 weeks to find a green (confirmed) booking block.
   * Throws skip-friendly error if no confirmed booking found.
   */
  async function openConfirmedBookingDialog(page: import('@playwright/test').Page) {
    await page.goto('/provider/calendar');
    await expect(page.getByRole('heading', { name: /kalender/i })).toBeVisible({ timeout: 10000 });

    // Scan forward up to 5 weeks to find a confirmed booking block.
    // BookingBlock uses: absolute + border-l-4 + bg-green-400 (confirmed)
    // This distinguishes it from availability background blocks.
    const bookingBlockSelector = 'button.absolute.border-l-4[class*="bg-green"]';

    for (let week = 0; week < 5; week++) {
      if (week > 0) {
        await page.getByRole('button', { name: /nästa/i }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
      }

      const greenBooking = page.locator(bookingBlockSelector).first();
      const found = await greenBooking.isVisible({ timeout: 5000 }).catch(() => false);

      if (found) {
        await greenBooking.click();
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

        // Verify it's a confirmed booking with notes section
        const hasNotes = await page.getByText('Dina anteckningar').isVisible({ timeout: 3000 }).catch(() => false);
        if (hasNotes) return;

        // Not a confirmed booking (might be completed), close and try next
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    throw new Error('No confirmed booking with notes section found in next 5 weeks');
  }

  test('should add note on confirmed booking', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'Depends on calendar week view (mobile shows day view)');
    await openConfirmedBookingDialog(page);

    // Notes section should be visible for confirmed booking
    await expect(page.getByText('Dina anteckningar')).toBeVisible();

    // Click "Lägg till anteckning" button
    const addNoteBtn = page.getByRole('button', { name: /lagg till anteckning/i });
    await expect(addNoteBtn).toBeVisible();
    await addNoteBtn.click();

    // Textarea should appear
    const textarea = page.getByPlaceholder(/Skriv anteckningar om behandlingen/i);
    await expect(textarea).toBeVisible();

    // Type a note
    const noteText = `E2E test note ${Date.now()}`;
    await textarea.fill(noteText);

    // Click "Spara"
    await page.getByRole('button', { name: /^Spara$/i }).click();

    // Wait for save to complete -- textarea should disappear (editing mode ends)
    await expect(textarea).not.toBeVisible({ timeout: 10000 });

    // After save, the note text should be visible in the dialog
    await expect(page.getByText(noteText)).toBeVisible({ timeout: 15000 });
  });

  test('should edit existing note', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'Depends on calendar week view (mobile shows day view)');
    await openConfirmedBookingDialog(page);

    // If there's already a note from the previous test, we should see "Klicka för att redigera"
    // If not, add one first
    const hasNote = await page.getByText(/Klicka for att redigera/i).isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasNote) {
      // Add a note first
      const addNoteBtn = page.getByRole('button', { name: /lagg till anteckning/i });
      await addNoteBtn.click();
      const textarea = page.getByPlaceholder(/Skriv anteckningar om behandlingen/i);
      await textarea.fill('Initial note');
      await page.getByRole('button', { name: /^Spara$/i }).click();
      await expect(page.getByText('Initial note')).toBeVisible({ timeout: 5000 });
    }

    // Click on the note to edit it
    await page.getByText(/Klicka for att redigera/i).click();

    // Textarea should appear with existing text
    const textarea = page.getByPlaceholder(/Skriv anteckningar om behandlingen/i);
    await expect(textarea).toBeVisible();

    // Clear and type new note
    const updatedText = `Updated note ${Date.now()}`;
    await textarea.clear();
    await textarea.fill(updatedText);

    // Save
    await page.getByRole('button', { name: /^Spara$/i }).click();

    // Updated text should be visible
    await expect(page.getByText(updatedText)).toBeVisible({ timeout: 5000 });
  });

  test('should not show notes for pending booking', async ({ page }) => {
    await page.goto('/provider/calendar');
    await expect(page.getByRole('heading', { name: /kalender/i })).toBeVisible({ timeout: 10000 });

    // Use the pending bookings banner to open a pending booking dialog
    const banner = page.getByRole('button', { name: /bokning.*väntar/i });
    await expect(banner).toBeVisible({ timeout: 10000 });

    // Expand banner and click first pending booking
    await banner.click();
    const bookingItem = page.locator('li button').first();
    await expect(bookingItem).toBeVisible({ timeout: 5000 });
    await bookingItem.click();

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // "Dina anteckningar" should NOT be visible for pending booking
    await expect(page.getByText('Dina anteckningar')).not.toBeVisible();
  });

  test('should show character counter', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'Depends on calendar week view (mobile shows day view)');
    await openConfirmedBookingDialog(page);

    // Open the notes editing area
    const addNoteBtn = page.getByRole('button', { name: /lagg till anteckning/i });
    const hasAddBtn = await addNoteBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasAddBtn) {
      await addNoteBtn.click();
    } else {
      // Click existing note to edit
      await page.getByText(/Klicka for att redigera/i).click();
    }

    // Textarea should be visible
    const textarea = page.getByPlaceholder(/Skriv anteckningar om behandlingen/i);
    await expect(textarea).toBeVisible();

    // Type some text
    await textarea.clear();
    await textarea.fill('Test text');

    // Character counter should show "9/2000"
    await expect(page.getByText('9/2000')).toBeVisible();

    // Cancel to avoid side effects
    await page.getByRole('button', { name: /avbryt/i }).click();
  });
});

// ─── Customer Registry inline edit tests ──────────────────────────

const EDIT_SPEC_TAG = 'provider-notes-edit';

test.describe('Provider Notes - Customer Registry Inline Edit', () => {
  let noteId: string;

  test.beforeAll(async () => {
    await cleanupSpecData(EDIT_SPEC_TAG);
    const base = await getBaseEntities();

    // Seed a completed booking so the customer appears in the registry
    await seedBooking({
      specTag: EDIT_SPEC_TAG,
      status: 'completed',
      daysFromNow: -30,
      horseName: 'E2E Blansen',
      horseId: base.horseId,
    });

    // Create a note via Prisma for the edit tests
    const note = await prisma.providerCustomerNote.create({
      data: {
        providerId: base.providerId,
        customerId: base.customerId,
        content: 'Original anteckning for E2E edit test',
      },
    });
    noteId = note.id;
  });

  test.afterAll(async () => {
    // Clean up the note
    await prisma.providerCustomerNote.delete({ where: { id: noteId } }).catch(() => {});
    await cleanupSpecData(EDIT_SPEC_TAG);
  });

  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'Customer registry note editing not optimized for mobile viewport');

    // Login as provider
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('provider@example.com');
    await page.getByLabel('Lösenord', { exact: true }).fill('ProviderPass123!');
    await page.getByRole('button', { name: /logga in/i }).click();
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 10000 });
  });

  /** Helper: Navigate to customers page and expand Test Testsson to see notes */
  async function expandCustomerNotes(page: import('@playwright/test').Page) {
    await page.goto('/provider/customers');
    await expect(page.getByRole('heading', { name: /kunder/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Laddar kunder/i)).not.toBeVisible({ timeout: 10000 });

    // Click on Test Testsson to expand
    await page.getByText('Test Testsson').first().click();

    // Wait for expanded content with notes section
    await expect(page.getByText('Anteckningar')).toBeVisible({ timeout: 5000 });
  }

  test('should edit an existing note inline', async ({ page }) => {
    await expandCustomerNotes(page);

    // Find our seeded note
    await expect(page.getByText('Original anteckning for E2E edit test')).toBeVisible({ timeout: 5000 });

    // Click pencil icon to edit
    await page.getByLabel('Redigera anteckning').first().click();

    // Edit textarea should appear (no placeholder -- uses value prop)
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await expect(textarea).toHaveValue('Original anteckning for E2E edit test');

    // Update the text
    const updatedText = `Redigerad anteckning ${Date.now()}`;
    await textarea.clear();
    await textarea.fill(updatedText);

    // Save
    await page.getByRole('button', { name: /^Spara$/i }).click();

    // Updated text should be visible
    await expect(page.getByText(updatedText)).toBeVisible({ timeout: 10000 });
  });

  test('should show "(redigerad)" label after editing', async ({ page }) => {
    await expandCustomerNotes(page);

    // Edit a note within this test to make it self-contained (no dependency on previous test)
    await page.getByLabel('Redigera anteckning').first().click();
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    const updatedText = `Redigerad for label test ${Date.now()}`;
    await textarea.clear();
    await textarea.fill(updatedText);
    await page.getByRole('button', { name: /^Spara$/i }).click();

    // After editing, "(redigerad)" label should be visible
    await expect(page.getByText('(redigerad)')).toBeVisible({ timeout: 5000 });
  });

  test('should cancel inline edit without saving', async ({ page }) => {
    await expandCustomerNotes(page);

    // Click pencil to start editing
    await page.getByLabel('Redigera anteckning').first().click();

    // Edit textarea should appear (no placeholder -- uses value prop)
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Get current content
    const originalValue = await textarea.inputValue();

    // Modify the text
    await textarea.clear();
    await textarea.fill('This should not be saved');

    // Click cancel
    await page.getByRole('button', { name: /avbryt/i }).click();

    // Textarea should disappear
    await expect(textarea).not.toBeVisible({ timeout: 5000 });

    // Original text should still be visible (not "This should not be saved")
    await expect(page.getByText('This should not be saved')).not.toBeVisible();
    if (originalValue) {
      await expect(page.getByText(originalValue)).toBeVisible();
    }
  });
});
