// import { test, expect, uploadFile, waitForQuoteStatus } from './helpers';
// import path from 'path';

// test.describe('Complete Quote to Order Flow', () => {
//   test('should complete full customer journey', async ({ page, portalUser, supabase }) => {
//     // Step 1: Login
//     await test.step('Login to portal', async () => {
//       await page.goto('/login');
//       await page.fill('[data-test="email"]', portalUser.email);
//       await page.fill('[data-test="password"]', portalUser.password);
//       await page.click('[data-test="submit"]');
//       await expect(page).toHaveURL('/dashboard');
//     });

//     // Step 2: Upload CAD file
//     let quoteId: string;
//     await test.step('Upload CAD file', async () => {
//       await page.goto('/upload');
//       await uploadFile(
//         page,
//         '[data-test="file-upload"]',
//         path.join(__dirname, '../test-files/bracket.step')
//       );

//       // Wait for upload and analysis
//       await page.waitForSelector('[data-test="upload-success"]');

//       // Get quote ID from URL
//       const url = page.url();
//       quoteId = url.split('/').pop()!;
//       expect(quoteId).toBeTruthy();
//     });

//     // Step 3: Configure quote
//     await test.step('Configure quote', async () => {
//       await page.selectOption('[data-test="material"]', 'AL6061');
//       await page.fill('[data-test="quantity"]', '10');
//       await page.click('[data-test="calculate"]');

//       // Wait for price calculation
//       await page.waitForSelector('[data-test="price-ready"]');
//       const price = await page.textContent('[data-test="unit-price"]');
//       expect(Number(price)).toBeGreaterThan(0);
//     });

//     // Step 4: Create quote
//     await test.step('Create quote', async () => {
//       await page.click('[data-test="create-quote"]');
//       await expect(page).toHaveURL(`/quotes/${quoteId}`);

//       // Wait for quote creation
//       const quoteReady = await waitForQuoteStatus(supabase, quoteId, 'ready');
//       expect(quoteReady).toBe(true);
//     });

//     // Step 5: Accept quote and proceed to checkout
//     await test.step('Accept quote and checkout', async () => {
//       await page.click('[data-test="accept-quote"]');
//       await page.waitForSelector('[data-test="stripe-checkout"]');

//       // Get Stripe iframe
//       const stripeFrame = page.frameLocator('iframe[name^="stripe-checkout"]');

//       // Fill payment details
//       await stripeFrame.locator('[data-test="card-number"]').fill('4242424242424242');
//       await stripeFrame.locator('[data-test="card-expiry"]').fill('1225');
//       await stripeFrame.locator('[data-test="card-cvc"]').fill('314');
//       await stripeFrame.locator('[data-test="checkout-submit"]').click();

//       // Wait for success page
//       await expect(page).toHaveURL(/\/orders\/success/);
//     });

//     // Step 6: Verify order creation
//     await test.step('Verify order creation', async () => {
//       await page.goto('/orders');
//       await expect(page.locator(`[data-test="order-${quoteId}"]`)).toBeVisible();

//       // Check order status
//       const orderStatus = await page.textContent(`[data-test="order-${quoteId}-status"]`);
//       expect(orderStatus).toBe('new');
//     });
//   });
// });

// test.describe('Admin Simulator Tests', () => {
//   test('should simulate CNC job', async ({ page, adminUser }) => {
//     // Login as admin
//     await test.step('Login to admin', async () => {
//       await page.goto('/admin/login');
//       await page.fill('[data-test="email"]', adminUser.email);
//       await page.fill('[data-test="password"]', adminUser.password);
//       await page.click('[data-test="submit"]');
//       await expect(page).toHaveURL('/admin/dashboard');
//     });

//     // Open simulator
//     await test.step('Access simulator', async () => {
//       await page.goto('/admin/simulator');
//       await expect(page).toHaveTitle(/Simulator/);
//     });

//     // Configure and run simulation
//     await test.step('Run simulation', async () => {
//       await page.selectOption('[data-test="process"]', 'cnc');
//       await page.fill('[data-test="cut-length"]', '2.5');
//       await page.fill('[data-test="volume"]', '125');
//       await page.click('[data-test="simulate"]');

//       // Wait for results
//       await page.waitForSelector('[data-test="sim-results"]');
//       const price = await page.textContent('[data-test="sim-price"]');
//       expect(Number(price)).toBeGreaterThan(0);
//     });
//   });
// });

// test.describe('Widget Integration Tests', () => {
//   test('should handle instant pricing', async ({ page }) => {
//     // Load widget test page
//     await test.step('Load widget', async () => {
//       await page.goto('/embed-test.html?debug=1');
//       const frame = page.frameLocator('iframe');
//       await expect(frame.locator('[data-test="widget-ready"]')).toBeVisible();
//     });

//     // Test instant pricing
//     await test.step('Get instant price', async () => {
//       const frame = page.frameLocator('iframe');

//       // Configure part
//       await frame.locator('[data-test="material"]').selectOption('AL6061');
//       await frame.locator('[data-test="quantity"]').fill('10');
//       await frame.locator('[data-test="calculate"]').click();

//       // Verify price update
//       await frame.locator('[data-test="price-ready"]').waitFor();
//       const price = await frame.locator('[data-test="unit-price"]').textContent();
//       expect(Number(price)).toBeGreaterThan(0);
//     });
//   });
// });
