import { expect, test } from '@playwright/test';

test('entra con la cuenta demo y la sesión sobrevive a recargar sin API', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/acceso$/);
  await page.getByLabel('Correo').fill('caja@demo.test');
  await page.getByLabel('Contraseña').fill('mala');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');

  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dispositivo$/);

  await page.route('**/api/**', (ruta) => ruta.abort());
  await page.reload();
  await expect(page).toHaveURL(/\/dispositivo$/);
});

test('primer inicio sin internet', async ({ page }) => {
  await page.goto('/acceso');
  await page.route('**/api/**', (ruta) => ruta.abort());
  await page.getByLabel('Correo').fill('caja@demo.test');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Necesitas internet para el primer inicio de sesión en este dispositivo.',
  );
});
