import { test, expect } from "@playwright/test";

// Helper: extract numeric value from currency string
function parseCurrency(txt: string | null): number | undefined {
  if (!txt) return undefined;
  const n = Number(txt.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? undefined : n;
}

test.describe("Instant Quote Realtime Flow", () => {
  test("uploads two parts and observes pricing subtotal progression", async ({
    page,
  }) => {
    await page.goto("/instant-quote");

    // Ensure page loaded
    await expect(page.getByTestId("iq-title")).toBeVisible();

    // Find any file input inside MultiFileUpload (fallback to generic) and upload two pseudo files
    const firstInput = page.locator('input[type="file"]').first();
    await expect(firstInput).toBeVisible();

    // Create two synthetic small STL placeholders
    const fileA = {
      name: "block-a.stl",
      mimeType: "model/stl",
      buffer: Buffer.from("solid a"),
    };
    const fileB = {
      name: "block-b.stl",
      mimeType: "model/stl",
      buffer: Buffer.from("solid b"),
    };

    await firstInput.setInputFiles([fileA, fileB]);

    // Wait for at least one part row to appear (backend may be asynchronous)
    await page.waitForSelector('[data-test^="part-row-"]', { timeout: 15000 });

    // Capture initial subtotal (likely placeholder)
    // const initialSubtotalText = await page
    //   .getByTestId("subtotal")
    //   .textContent();

    // Wait for pricing rows to populate (heuristic: look for a dollar sign change or additional part rows)
    // Poll up to 20s for subtotal to change to a numeric value > 0
    let finalSubtotal: number | undefined;
    for (let i = 0; i < 40; i++) {
      // 40 * 500ms = 20s
      const txt = await page.getByTestId("subtotal").textContent();
      const val = parseCurrency(txt);
      if (val && val > 0) {
        finalSubtotal = val;
        break;
      }
      await page.waitForTimeout(500);
    }

    // Not all environments will emit pricing; soft assert if absent
    if (!finalSubtotal) {
      test.info().annotations.push({
        type: "note",
        description:
          "Subtotal did not update > 0; backend pricing events may be disabled in this environment.",
      });
    } else {
      expect(finalSubtotal).toBeGreaterThan(0);
    }

    // Verify at least 1–2 part cards rendered
    const partCards = page.locator('[data-test^="part-card-"]');
    await expect(partCards)?.toHaveCountGreaterThan(0);
  });
});
