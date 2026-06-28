const { test, expect } = require("@playwright/test");

const CLIENT_ID = "78ub41p21tn42ahgeo4frrhc42";
const COGNITO_HOST = "us-east-1nn98cdks9.auth.us-east-1.amazoncognito.com";

test("login page offers Cognito sign-in", async ({ page }) => {
  await page.goto("/login.html");
  await expect(page.getByRole("heading", { name: /sign in with cognito/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continue to cognito/i })).toBeVisible();
});

test("sign-in reaches Cognito managed login with PKCE params", async ({ page }) => {
  await page.goto("/login.html");
  await page.getByRole("button", { name: /continue to cognito/i }).click();

  await page.waitForURL((url) => url.hostname === COGNITO_HOST, { timeout: 15_000 });

  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  const url = new URL(page.url());
  expect(url.searchParams.get("response_type")).toBe("code");
  expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  expect(url.searchParams.get("state")).toBeTruthy();
  expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3001/cognito-callback.html");
  expect(url.searchParams.get("scope")).toMatch(/openid/);
});

test("callback without code shows failure message", async ({ page }) => {
  await page.goto("/cognito-callback.html");
  await expect(page.getByText(/sign-in failed/i)).toBeVisible({ timeout: 10_000 });
});

test("full Cognito login stores token and reaches home", async ({ page }) => {
  const email = process.env.COGNITO_TEST_EMAIL;
  const password = process.env.COGNITO_TEST_PASSWORD;
  test.skip(!email || !password, "Set COGNITO_TEST_EMAIL and COGNITO_TEST_PASSWORD for full E2E");

  await page.goto("/login.html");
  await page.getByRole("button", { name: /continue to cognito/i }).click();

  await page.waitForURL((url) => url.hostname === COGNITO_HOST, { timeout: 15_000 });

  // ponytail: Cognito Hosted UI markup varies by pool branding; label-first selectors.
  const userField = page.getByLabel(/email|username/i).first();
  await userField.fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole("button", { name: /sign in|continue|next|submit/i }).click();

  await page.waitForURL(/cognito-callback\.html|newHome\.html/, { timeout: 30_000 });
  if (page.url().includes("cognito-callback")) {
    await page.waitForURL(/newHome\.html/, { timeout: 15_000 });
  }

  const token = await page.evaluate(() => localStorage.getItem("Token"));
  expect(token).toBeTruthy();
});
