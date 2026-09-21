import { expect, test, type Page } from '@playwright/test';
import {
  entrarCon,
  escribirPin,
  irAVentaConCajaAbierta,
  leerServidor,
  panelVenta,
  PIN,
  prepararDispositivo,
} from './ayudas';

async function venderEnEfectivo(page: Page, productos: string[]) {
  await page
    .getByRole('navigation', { name: 'Secciones' })
    .getByRole('link', { name: 'Venta', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Postres' }).click();
  for (const p of productos) await page.getByRole('button', { name: new RegExp(`^${p}`) }).click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Exacto' }).click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Confirmar cobro' }).click();
}

const autorizarCon = async (page: Page, pin: string) => {
  await expect(page.getByRole('dialog', { name: 'Pedir autorización' })).toBeVisible();
  await escribirPin(page, pin);
  await expect(page.getByRole('dialog', { name: 'Pedir autorización' })).toBeHidden();
};

test('cancelar y devolver con autorización; la caja se ajusta', async ({ page, request }) => {
  await prepararDispositivo(page, 'T');
  await entrarCon(page, PIN.cajero);
  await irAVentaConCajaAbierta(page, '500');
  await venderEnEfectivo(page, ['Brownie', 'Galleta de chispas']); // T-000001: $75
  await venderEnEfectivo(page, ['Brownie']); // T-000002: $45

  // Historial de hoy
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Ventas' }).click();
  const filas = page.getByRole('row');
  await expect(filas.filter({ hasText: 'T-000001' })).toContainText('1 Brownie, 1 Galleta de chispas');
  await expect(filas.filter({ hasText: 'T-000002' })).toContainText('$45.00');

  // Cancelar T-000002 (el cajero necesita autorización)
  await page.getByRole('link', { name: 'T-000002' }).click();
  await page.getByRole('button', { name: 'Cancelar venta' }).click();
  const cancelar = page.getByRole('dialog', { name: 'Cancelar la venta T-000002 por $45.00' });
  await cancelar.getByLabel('Motivo').fill('Cliente se arrepintió');
  await cancelar.getByRole('button', { name: 'Cancelar venta' }).click();
  await autorizarCon(page, PIN.encargada);
  await expect(
    page.getByText('Cancelada por Cajero (autorizó Encargada): Cliente se arrepintió'),
  ).toBeVisible();
  await expect(page.getByRole('document', { name: 'Vista previa del ticket' })).toContainText(
    '*** VENTA CANCELADA ***',
  );
  await expect(page.getByRole('button', { name: 'Cancelar venta' })).toHaveCount(0);

  // Devolver solo la galleta de T-000001 en efectivo
  await page.getByRole('link', { name: 'Historial' }).click();
  await page.getByRole('link', { name: 'T-000001' }).click();
  await page.getByRole('button', { name: 'Devolución' }).click();
  const devolucion = page.getByRole('dialog', { name: 'Devolución de la venta T-000001' });
  await devolucion.getByRole('button', { name: 'Devolver uno menos de Brownie' }).click();
  await expect(devolucion).toContainText('Reembolso: $30.00');
  await devolucion.getByLabel('Motivo').fill('Estaba quemada');
  await devolucion.getByRole('button', { name: 'Devolver', exact: true }).click();
  await autorizarCon(page, PIN.encargada);
  await expect(page.getByRole('region', { name: 'Devoluciones' })).toContainText('Estaba quemada');
  await expect(page.getByText('Devuelta parcial')).toBeVisible();

  // Filtros y lista de devoluciones
  await page.getByRole('link', { name: 'Historial' }).click();
  await page.getByLabel('Estado').selectOption('cancelada');
  await expect(filas.filter({ hasText: 'T-0000' })).toHaveCount(1);
  await expect(filas.filter({ hasText: 'T-000002' })).toContainText('Cancelada');
  await page.getByRole('link', { name: 'Devoluciones' }).click();
  await expect(filas.filter({ hasText: 'T-000001' })).toContainText('$30.00');

  // Efectivo esperado (lo ve la encargada): 500 + 75 − 30 = 545; la venta cancelada no cuenta
  await page.getByRole('button', { name: 'Cajero' }).click();
  await page.getByRole('menuitem', { name: 'Cambiar usuario' }).click();
  await entrarCon(page, PIN.encargada);
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Caja' }).click();
  await expect(page.getByText('Efectivo esperado').locator('..')).toContainText('$545.00');
  await expect(page.getByText('Ventas (1)').locator('..')).toContainText('$75.00');

  await expect
    .poll(
      async () => {
        const leer = await leerServidor(request);
        const ventas = leer('ventas').filter((v) => String(v.folio).startsWith('T-'));
        return {
          estados: ventas.map((v) => [v.folio, v.estado, v.devuelto]).sort(),
          devoluciones: leer('devoluciones')
            .filter((d) => d.folioVenta === 'T-000001')
            .map((d) => d.monto),
        };
      },
      { timeout: 15_000 },
    )
    .toEqual({
      estados: [
        ['T-000001', 'devuelta_parcial', 3000],
        ['T-000002', 'cancelada', 0],
      ],
      devoluciones: [3000],
    });
});
