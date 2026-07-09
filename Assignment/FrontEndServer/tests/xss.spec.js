const { test, expect } = require('@playwright/test');

const xssPayload = '<img src=x onerror="alert(\'XSS\')"><script>alert(\'XSS\')</script>';

test('game detail renders API data as text and does not execute XSS', async ({ page }) => {
  const alerts = [];
  page.on('dialog', async dialog => {
    alerts.push(dialog.message());
    await dialog.dismiss();
  });

  await page.addInitScript(() => {
    localStorage.setItem('Token', 'fake-token');
    localStorage.setItem('user', JSON.stringify({ userid: '24d834a8-0061-706d-6ab5-c5032b736c66', username: 'tester' }));
  });

  await page.route('**/searchgamedetails/12', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      title: xssPayload,
      categories: xssPayload,
      year: '2026',
      game_description: xssPayload,
      game_image: '',
      prices: '10.00',
      platforms: xssPayload
    }])
  }));

  await page.route('**/game/12/review', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      username: xssPayload,
      created_at: '2026-07-06 10:00:00',
      rating: '5',
      content: xssPayload,
      profile_pic_url: ''
    }])
  }));

  await page.goto('/newGame-Detail.html?gameID=12');
  await expect(page.locator('#Game-Info-Display')).toContainText('alert');
  await expect(page.locator('#reviewDisplaySection')).toContainText('alert');
  await page.waitForTimeout(500);
  expect(alerts).toEqual([]);
});
