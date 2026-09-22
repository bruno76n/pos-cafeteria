import { expect, test, type Page } from '@playwright/test';
import {
  entrarCon,
  irAVentaConCajaAbierta,
  leerMetaLocal,
  panelVenta,
  PIN,
  prepararDispositivo,
} from './ayudas';

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

test('abrir caja, armar venta con modificadores y descuento, recargar y el carrito sigue', async ({
  page,
}) => {
  await prepararDispositivo(page, 'F');
  await entrarCon(page, PIN.encargada);
  await irAVentaConCajaAbierta(page, '300');
  await armarCasoA(page);
  const panel = panelVenta(page);
  await panel.getByPlaceholder('Nombre del cliente').fill('Luis');
  await panel.getByRole('button', { name: 'Nota de Brownie' }).click();
  await page.getByRole('dialog', { name: 'Nota para Brownie' }).getByLabel('Nota').fill('calientito');
  await page.getByRole('button', { name: 'Guardar nota' }).click();
  await panel.getByRole('button', { name: 'Descuento' }).click();
  await page.getByRole('dialog', { name: 'Descuento' }).getByRole('button', { name: '10%' }).click();
  await page
    .getByRole('dialog', { name: 'Descuento' })
    .getByRole('button', { name: /^Aplicar/ })
    .click();
  await expect(panel.getByRole('button', { name: /Cobrar/ })).toHaveText('Cobrar$193.50');
  await expect
    .poll(async () => (await leerMetaLocal(page, 'carrito')) as { descuento: unknown })
    .toHaveProperty('descuento.valor', 10);

  await page.reload();
  await entrarCon(page, PIN.encargada);
  await expect(page).toHaveURL(/\/venta$/);
  await expect(panel.getByPlaceholder('Nombre del cliente')).toHaveValue('Luis');
  await expect(panel).toContainText('Latte Mediano 16 oz');
  await expect(panel).toContainText('Almendra');
  await expect(panel).toContainText('Nota: calientito');
  await expect(panel).toContainText('Descuento 10%');
  await expect(panel.getByRole('button', { name: /Cobrar/ })).toHaveText('Cobrar$193.50');

  // editar la línea reabre la hoja con lo elegido
  await panel.getByRole('button', { name: 'Editar Latte Mediano 16 oz' }).click();
  const hoja = page.getByRole('dialog', { name: 'Latte' });
  await expect(hoja.getByRole('button', { name: /Almendra/ })).toHaveAttribute('aria-pressed', 'true');
  await hoja.getByRole('button', { name: /Grande 20 oz/ }).click();
  await hoja.getByRole('button', { name: /^Guardar/ }).click();
  await expect(panel).toContainText('Latte Grande 20 oz');
  await expect(panel).toContainText('Almendra');

  await panel.getByRole('button', { name: 'Vaciar' }).click();
  await expect(page.getByRole('dialog', { name: '¿Vaciar la venta?' })).toContainText(
    'Se quitarán 3 productos.',
  );
  await page.getByRole('button', { name: 'Conservar' }).click();
  await panel.getByRole('button', { name: 'Vaciar' }).click();
  await page
    .getByRole('dialog', { name: '¿Vaciar la venta?' })
    .getByRole('button', { name: 'Vaciar' })
    .click();
  await expect(panel).toContainText('Toca un producto para empezar.');
});

test('buscar sin acentos en todas las categorías', async ({ page }) => {
  await prepararDispositivo(page, 'G');
  await entrarCon(page, PIN.cajero);
  await irAVentaConCajaAbierta(page);
  await page.getByLabel('Buscar producto').fill('frappe');
  const productos = page.getByRole('region', { name: 'Productos' });
  await expect(productos.getByRole('button', { name: /Frappé de café/ })).toBeVisible();
  await expect(productos.getByRole('button', { name: /Frappé de moka/ })).toBeVisible();
  await expect(productos.getByRole('button', { name: /Latte/ })).toHaveCount(0);
});
