import { expect, test, type Page } from '@playwright/test';
import {
  entrarCon,
  irAVentaConCajaAbierta,
  panelVenta,
  PIN,
  prepararDispositivo,
  respaldarConfig,
} from './ayudas';

let restaurar: () => Promise<void>;
test.beforeEach(async ({ request }) => {
  restaurar = await respaldarConfig(request);
});
test.afterEach(async () => {
  await restaurar();
});

const irA = async (page: Page, pestana: string) => {
  await page
    .getByRole('navigation', { name: 'Secciones' })
    .getByRole('link', { name: 'Configuración' })
    .click();
  await page.getByRole('link', { name: pestana, exact: true }).click();
};
const guardar = async (page: Page) => {
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cambios guardados.' })).toBeVisible();
};
const vistaPrevia = (page: Page) => page.getByRole('complementary', { name: 'Vista previa del ticket' });

test('negocio y ticket: los cambios se ven en la vista previa', async ({ page }) => {
  await prepararDispositivo(page, 'W');
  await entrarCon(page, PIN.dueno);
  await irA(page, 'Negocio');
  await page.getByLabel('Dirección').fill('Calle Nueva 45, Zapopan');
  await page.getByLabel('Nueva categoría de gasto').fill('Gas');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(vistaPrevia(page)).toContainText('Calle Nueva 45, Zapopan');
  await guardar(page);

  // El ancho del papel es de cada tablet (Configuración › Impresora) y la vista previa lo usa.
  await irA(page, 'Impresora');
  await page.getByRole('button', { name: '80 mm (48 columnas)' }).click();
  await expect(page.getByRole('button', { name: '80 mm (48 columnas)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await irA(page, 'Ticket');
  await page.getByRole('switch', { name: 'Mostrar cajero' }).click();
  await page.getByLabel('Mensaje final').fill('¡Vuelve pronto!');
  await expect(vistaPrevia(page)).toContainText('¡Vuelve pronto!');
  await expect(vistaPrevia(page)).not.toContainText('Cajero:');
  expect(Math.max(...(await vistaPrevia(page).locator('.r').allTextContents()).map((r) => r.length))).toBe(
    48,
  );
  await guardar(page);

  // La categoría de gasto nueva aparece al registrar un gasto
  await irAVentaConCajaAbierta(page);
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Caja' }).click();
  await page.getByRole('button', { name: 'Registrar gasto' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Registrar gasto' }).getByRole('button', { name: 'Gas', exact: true }),
  ).toBeVisible();
});

test('impuestos, descuentos y pagos cambian el cobro', async ({ page }) => {
  await prepararDispositivo(page, 'X');
  await entrarCon(page, PIN.dueno);

  await irA(page, 'Impuestos');
  await page.getByRole('switch', { name: 'Los precios incluyen IVA' }).click();
  await page.getByLabel('Descuento máximo (%)').fill('100');
  await guardar(page);

  await irA(page, 'Pagos');
  await page.getByRole('switch', { name: 'Referencia de transferencia obligatoria' }).click();
  await page.getByRole('button', { name: 'Agregar cuenta' }).click();
  const cuenta2 = page.getByRole('group', { name: 'Cuenta 2' });
  await cuenta2.getByLabel('Alias').fill('Nómina');
  await cuenta2.getByLabel('Banco').fill('Banco Dos');
  await cuenta2.getByLabel('Titular').fill('Dueño');
  await cuenta2.getByLabel('CLABE').fill('999999999999999999');
  await guardar(page);

  // IVA no incluido: $45 + 16 % = $52.20
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Postres' }).click();
  await page.getByRole('button', { name: /^Brownie/ }).click();
  await expect(panelVenta(page)).toContainText('IVA 16 %$7.20');
  await expect(panelVenta(page).getByRole('button', { name: /^Cobrar/ })).toHaveText('Cobrar$52.20');

  // Transferencia: elegir cuenta y referencia obligatoria
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  const cobro = page.getByRole('dialog', { name: 'Cobro' });
  await cobro.getByRole('tab', { name: 'Transferencia' }).click();
  await cobro.getByRole('button', { name: 'Nómina' }).click();
  await expect(cobro).toContainText('9999 9999 9999 9999 99');
  await cobro.getByRole('button', { name: 'Marcar como pagada' }).click();
  await expect(cobro.getByRole('alert')).toHaveText('Escribe la referencia de la transferencia.');
  await cobro.getByLabel('Referencia').fill('SPEI123');
  await cobro.getByRole('button', { name: 'Marcar como pagada' }).click();
  await expect(panelVenta(page).getByRole('status')).toContainText('Venta X-000001');

  // Caso G: descuento de $60 sobre $45 (con tope 100 %) deja el total en cero y se confirma sin pagos
  await page.getByRole('button', { name: /^Brownie/ }).click();
  await panelVenta(page).getByRole('button', { name: 'Descuento' }).click();
  const descuento = page.getByRole('dialog', { name: 'Descuento' });
  await descuento.getByRole('button', { name: 'Monto' }).click();
  await descuento.getByLabel('Monto').fill('60');
  await descuento.getByRole('button', { name: /^Aplicar/ }).click();
  await expect(panelVenta(page).getByRole('button', { name: /^Cobrar/ })).toHaveText('Cobrar$0.00');
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await expect(cobro).toContainText('Nada que cobrar');
  await cobro.getByRole('button', { name: 'Confirmar' }).click();
  await expect(panelVenta(page).getByRole('status')).toContainText('Venta X-000002');
});

test('dispositivo: renombrar y almacenamiento visible', async ({ page }) => {
  await prepararDispositivo(page, 'Y');
  await entrarCon(page, PIN.dueno);
  await irA(page, 'Dispositivo');
  await expect(page.getByRole('region', { name: 'Almacenamiento' })).toContainText(/persistente/i);
  await page.getByRole('region', { name: 'Este dispositivo' }).getByLabel('Nombre').fill('Barra');
  await page.getByRole('button', { name: 'Guardar dispositivo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Dispositivo guardado.' })).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('Barra');
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await expect(page.getByRole('button', { name: '5 min', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
