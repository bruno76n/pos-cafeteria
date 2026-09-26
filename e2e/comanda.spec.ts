import { expect, test, type Page } from '@playwright/test';
import {
  capturarTrabajos,
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

const irA = async (page: Page, seccion: string, pestana?: string) => {
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: seccion }).click();
  if (pestana) await page.getByRole('link', { name: pestana, exact: true }).click();
};

async function venderCrepaYAgua(page: Page, folio: string) {
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Crepas' }).click();
  await page.getByRole('button', { name: /^Crepa dulce/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Crepa dulce' });
  await hoja.getByRole('button', { name: 'Nutella' }).click();
  await hoja.getByRole('button', { name: 'Plátano' }).click();
  await hoja.getByRole('button', { name: /^Agregar/ }).click();
  await page.getByRole('tab', { name: 'Bebidas frías' }).click();
  await page.getByRole('button', { name: /^Agua embotellada/ }).click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  const cobro = page.getByRole('dialog', { name: 'Cobro' });
  await cobro.getByRole('button', { name: 'Exacto' }).click();
  await cobro.getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(panelVenta(page).getByRole('status')).toContainText(`Venta ${folio}`);
}

test('al cobrar salen comanda y ticket como dos trabajos, en el orden configurado', async ({ page }) => {
  const trabajos = await capturarTrabajos(page);
  await prepararDispositivo(page, 'C', 'Caja cocina');
  await entrarCon(page, PIN.dueno);
  await irA(page, 'Configuración', 'Impresora');
  const alCobrar = page.getByRole('switch', { name: 'Imprimir automáticamente al cobrar' });
  await alCobrar.click();
  await expect(alCobrar).toHaveAttribute('aria-checked', 'true');

  // Por defecto: cocina primero. La comanda solo trae la crepa y ningún precio.
  await venderCrepaYAgua(page, 'C-000001');
  await expect.poll(async () => (await trabajos()).length).toBe(2);
  const [comanda, ticket] = await trabajos();
  expect(comanda).toContain('COCINA');
  expect(comanda).toContain('1x Crepa dulce');
  expect(comanda).toContain('Nutella, Plátano');
  expect(comanda).not.toContain('Agua');
  expect(comanda).not.toContain('$');
  expect(ticket).toContain('Folio: C-000001');
  expect(ticket).toContain('Agua embotellada');
  expect(ticket).toContain('Crepa dulce Chica');

  // Cliente primero, con la vista previa de la comanda en Configuración › Ticket.
  await irA(page, 'Configuración', 'Ticket');
  await expect(page.getByRole('document', { name: 'Vista previa de la comanda' })).toContainText('COCINA');
  await page.getByRole('button', { name: 'Cliente primero' }).click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cambios guardados.' })).toBeVisible();

  await venderCrepaYAgua(page, 'C-000002');
  await expect.poll(async () => (await trabajos()).length).toBe(4);
  const [, , primero, segundo] = await trabajos();
  expect(primero).toContain('Folio: C-000002');
  expect(segundo).toContain('COCINA');

  // Reimprimir la comanda desde el detalle de la venta.
  await irA(page, 'Ventas');
  await page.getByRole('link', { name: 'C-000001' }).click();
  await page.getByRole('button', { name: 'Reimprimir comanda' }).click();
  await expect.poll(async () => (await trabajos()).length).toBe(5);
  expect((await trabajos())[4]).toContain('*** REIMPRESIÓN ***');

  // Al cancelar, ofrece avisar a cocina.
  await page.getByRole('button', { name: 'Cancelar venta' }).click();
  const cancelar = page.getByRole('dialog', { name: /^Cancelar la venta C-000001/ });
  await cancelar.getByLabel('Motivo').fill('Se fue el cliente');
  await cancelar.getByRole('button', { name: 'Cancelar venta' }).click();
  await expect(page.getByText('Esta venta ya se mandó a cocina.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Imprimir aviso a cocina' }).click();
  await expect.poll(async () => (await trabajos()).length).toBe(6);
  const aviso = (await trabajos())[5]!;
  expect(aviso).toContain('CANCELADA');
  expect(aviso).toContain('C-000001');
  expect(aviso).toContain('1x Crepa dulce');
  expect(aviso).not.toContain('Agua');
});
