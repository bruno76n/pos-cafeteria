import { expect, test } from '@playwright/test';

test('abre la app y la API responde', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('POS Cafetería');
  const salud = await request.get('/api/salud');
  expect(await salud.json()).toEqual({ ok: true });
});
