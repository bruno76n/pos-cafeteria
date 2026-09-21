import { expect, test, type Page } from '@playwright/test';
import { entrarCon, irAVentaConCajaAbierta, panelVenta, PIN, prepararDispositivo } from './ayudas';

/** Caso A: 2 Latte mediano con almendra + 1 Brownie. */
async function armarCasoA(page: Page) {
  await page.getByRole('tab', { name: 'Cafés' }).click();
  await page.getByRole('button', { name: /^Latte/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Latte' });
  await hoja.getByRole('button', { name: /Mediano 16 oz/ }).click();
  await hoja.getByRole('button', { name: /Almendra/ }).click();
  await hoja.getByRole('button', { name: 'Más' }).click();
  await expect(hoja.getByRole('button', { name: /^Agregar/ })).toHaveText('Agregar $170.00');
  await hoja.getByRole('button', { name: /^Agregar/ }).click();
  await page.getByRole('tab', { name: 'Postres' }).click();
  await page.getByRole('button', { name: /^Brownie/ }).click();
}

test('totales del caso B con IVA incluido', async ({ page }) => {
  await prepararDispositivo(page, 'E');
  await entrarCon(page, PIN.encargada);
  await irAVentaConCajaAbierta(page);
  await armarCasoA(page);
  const panel = panelVenta(page);
  await expect(panel).toContainText('Subtotal$215.00');
  await panel.getByRole('button', { name: 'Descuento' }).click();
  await page.getByRole('dialog', { name: 'Descuento' }).getByRole('button', { name: '10%' }).click();
  await page
    .getByRole('dialog', { name: 'Descuento' })
    .getByRole('button', { name: /^Aplicar/ })
    .click();
  await expect(panel).toContainText('Descuento 10%−$21.50');
  await expect(panel).toContainText('IVA incluido$26.69');
  await expect(panel.getByRole('button', { name: /Cobrar/ })).toHaveText('Cobrar$193.50');
});
