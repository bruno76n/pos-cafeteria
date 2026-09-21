import { expect, test } from '@playwright/test';
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

test('QR en el ticket y ticket digital público sin sesión', async ({ page, browser }) => {
  await prepararDispositivo(page, 'O', 'Caja QR');
  await entrarCon(page, PIN.dueno);
  await page
    .getByRole('navigation', { name: 'Secciones', exact: true })
    .getByRole('link', { name: 'Configuración' })
    .click();
  await page.getByRole('link', { name: 'Ticket', exact: true }).click();
  await page.getByRole('switch', { name: 'QR con el ticket digital' }).click();
  await expect(
    page.getByRole('complementary', { name: 'Vista previa del ticket' }).locator('.qr svg'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Postres' }).click();
  await page.getByRole('button', { name: /^Brownie/ }).click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Exacto' }).click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Confirmar cobro' }).click();
  const folio = (await panelVenta(page).getByRole('status').textContent())!.match(/O-\d{6}/)![0];

  await page
    .getByRole('navigation', { name: 'Secciones', exact: true })
    .getByRole('link', { name: 'Ventas' })
    .click();
  await page.getByRole('link', { name: folio }).click();
  await expect(
    page.getByRole('document', { name: 'Vista previa del ticket' }).locator('.qr svg'),
  ).toBeVisible();
  const ventaId = page.url().split('/').at(-1)!;

  // Otro teléfono, sin sesión, abre el enlace del QR (cuando la venta ya subió)
  const cliente = await (await browser.newContext()).newPage();
  await expect(async () => {
    await cliente.goto(`/t/${ventaId}`);
    await expect(cliente.getByRole('heading', { name: `Ticket ${folio}` })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(cliente.getByRole('document', { name: 'Vista previa del ticket' })).toContainText('1 Brownie');
  await cliente.goto(`/t/${crypto.randomUUID()}`);
  await expect(cliente.getByText('No encontramos este ticket.')).toBeVisible();
});
