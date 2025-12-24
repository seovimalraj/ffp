import { test, expect, FrameLocator } from "@playwright/test";
// No need to declare page globally

test.describe("Widget Flow", () => {
  let widgetFrame: FrameLocator;

  test.beforeEach(async ({ page }) => {
    // Load the test page that embeds the widget
    await page.goto("http://localhost:3001/test-widget.html");

    // Wait for and get the widget iframe
    widgetFrame = await page.frameLocator("#cnc-quote-widget");
  });

  test("should upload file and complete quote flow", async ({ page }) => {
    // Click the upload button and handle file dialog
    const uploadButton = await widgetFrame.locator('button:has-text("Upload")');
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadButton.click(),
    ]);

    // Upload a test STL file
    await fileChooser.setFiles("./fixtures/test-part.stl");

    // Wait for upload and processing
    await widgetFrame.getByText("File uploaded successfully").waitFor();
    await widgetFrame.getByText("Part Analysis").waitFor();

    // Select material
    await widgetFrame
      .locator('select[name="material"]')
      .selectOption("alu-6061");
    await widgetFrame.getByRole("button", { name: "Next" }).click();

    // Wait for DFM analysis
    await widgetFrame.getByText("Manufacturability Score").waitFor();

    // Configure features
    await widgetFrame
      .locator('select[name="surfaceFinish"]')
      .selectOption("as-machined");
    await widgetFrame
      .locator('select[name="tolerance"]')
      .selectOption("standard");
    await widgetFrame.locator('input[name="quantity"]').fill("10");
    await widgetFrame.getByRole("button", { name: "Calculate" }).click();

    // Wait for pricing
    await widgetFrame.getByText("Price per unit").waitFor();
    await widgetFrame.getByText("Total price").waitFor();

    // Fill customer info
    await widgetFrame.locator('input[name="customerName"]').fill("Test User");
    await widgetFrame
      .locator('input[name="customerEmail"]')
      .fill("test@example.com");
    await widgetFrame.getByRole("button", { name: "Create Quote" }).click();

    // Wait for quote creation
    await widgetFrame.getByText("Quote created successfully").waitFor();

    // Verify quote summary
    const quoteSummary = await widgetFrame
      .locator(".quote-summary")
      .textContent();
    expect(quoteSummary).toContain("Material: Aluminum 6061");
    expect(quoteSummary).toContain("Quantity: 10");
  });

  test("should show DFM warnings", async ({ page }) => {
    // Upload a file with known DFM issues
    const uploadButton = await widgetFrame.locator('button:has-text("Upload")');
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadButton.click(),
    ]);
    await fileChooser.setFiles("./fixtures/part-with-issues.stl");

    // Select material and trigger analysis
    await widgetFrame
      .locator('select[name="material"]')
      .selectOption("alu-6061");
    await widgetFrame.getByRole("button", { name: "Next" }).click();

    // Verify DFM warnings are shown
    await widgetFrame.getByText("Manufacturing Issues Found").waitFor();
    const dfmWarnings = await widgetFrame
      .locator(".dfm-warnings")
      .textContent();
    expect(dfmWarnings).toContain("Thin walls detected");
  });

  test("should enforce minimum quantity", async ({ page }) => {
    // Complete upload and material selection
    const uploadButton = await widgetFrame.locator('button:has-text("Upload")');
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadButton.click(),
    ]);
    await fileChooser.setFiles("./fixtures/test-part.stl");
    await widgetFrame
      .locator('select[name="material"]')
      .selectOption("alu-6061");
    await widgetFrame.getByRole("button", { name: "Next" }).click();

    // Try setting invalid quantity
    await widgetFrame.locator('input[name="quantity"]').fill("0");
    await widgetFrame.getByRole("button", { name: "Calculate" }).click();

    // Verify error message
    await widgetFrame.getByText("Minimum quantity is 1").waitFor();
  });
});
