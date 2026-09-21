import { expect, test } from '@playwright/test';
import { entrarCon, irAVentaConCajaAbierta, panelVenta, PIN, prepararDispositivo } from './ayudas';
import { PUERTO_PWA } from './puertos';

test.use({ baseURL: `http://localhost:${PUERTO_PWA}` });

test('la app instalada abre y vende sin red', async ({ page, context }) => {
  await prepararDispositivo(page, 'P', 'Caja PWA');
  await entrarCon(page, PIN.cajero);
  // Espera a que el service worker quede activo y controle la página
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  // /api nunca se sirve del caché del service worker
  expect(
    await page.evaluate(() =>
      fetch('/api/salud').then(
        () => 'respondió',
        () => 'sin red',
      ),
    ),
  ).toBe('sin red');
  await entrarCon(page, PIN.cajero);
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible();
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Cafés' }).click();
  await page.getByRole('button', { name: /^Espresso/ }).click();
  await page
    .getByRole('dialog', { name: 'Espresso' })
    .getByRole('button', { name: /^Agregar/ })
    .click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Exacto' }).click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(panelVenta(page).getByRole('status')).toContainText(/Venta P-\d{6}/);
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión: 1 venta por subir' })).toBeVisible();
  await context.setOffline(false);
});
