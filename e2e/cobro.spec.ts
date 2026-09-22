import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  entrarCon,
  irAVentaConCajaAbierta,
  leerServidor,
  panelVenta,
  PIN,
  prepararDispositivo,
} from './ayudas';

/** Cuenta los toques de un flujo. */
function contador() {
  let toques = 0;
  return {
    tocar: async (l: Locator) => {
      toques += 1;
      await l.click();
    },
    get toques() {
      return toques;
    },
  };
}

const cobro = (page: Page) => page.getByRole('dialog', { name: 'Cobro' });
const resultado = (page: Page) => panelVenta(page).getByRole('status');

test('presupuesto de toques y efectivo con cambio', async ({ page, request }) => {
  await prepararDispositivo(page, 'H');
  await entrarCon(page, PIN.cajero);
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Cafés' }).click();

  // Americano chico, efectivo exacto: ≤ 5 toques
  let c = contador();
  await c.tocar(page.getByRole('button', { name: /^Americano/ }));
  await c.tocar(page.getByRole('dialog', { name: 'Americano' }).getByRole('button', { name: /^Agregar/ }));
  await c.tocar(panelVenta(page).getByRole('button', { name: /^Cobrar/ }));
  await c.tocar(cobro(page).getByRole('button', { name: 'Exacto' }));
  await c.tocar(cobro(page).getByRole('button', { name: 'Confirmar cobro' }));
  expect(c.toques).toBeLessThanOrEqual(5);
  await expect(resultado(page)).toContainText('Venta H-000001');
  await expect(resultado(page)).toContainText('$0.00');

  // Latte mediano con almendra, efectivo $100: ≤ 7 toques y cambio de $15
  c = contador();
  await c.tocar(page.getByRole('button', { name: /^Latte/ }));
  const hoja = page.getByRole('dialog', { name: 'Latte' });
  await c.tocar(hoja.getByRole('button', { name: /Mediano/ }));
  await c.tocar(hoja.getByRole('button', { name: /Almendra/ }));
  await c.tocar(hoja.getByRole('button', { name: /^Agregar/ }));
  await c.tocar(panelVenta(page).getByRole('button', { name: /^Cobrar/ }));
  await expect(cobro(page)).toContainText('Total a cobrar$85.00');
  await c.tocar(cobro(page).getByRole('button', { name: '$100', exact: true }));
  await expect(cobro(page)).toContainText('Cambio$15.00');
  await c.tocar(cobro(page).getByRole('button', { name: 'Confirmar cobro' }));
  expect(c.toques).toBeLessThanOrEqual(7);
  await expect(resultado(page)).toContainText('Venta H-000002');
  await expect(resultado(page)).toContainText('$15.00');

  // Brownie con tarjeta: ≤ 4 toques (el conteo empieza con el producto a la vista, como en la especificación)
  await page.getByRole('tab', { name: 'Postres' }).click();
  c = contador();
  await c.tocar(page.getByRole('button', { name: /^Brownie/ }));
  await expect(resultado(page)).toBeHidden();
  await c.tocar(panelVenta(page).getByRole('button', { name: /^Cobrar/ }));
  await c.tocar(cobro(page).getByRole('tab', { name: 'Tarjeta' }));
  await c.tocar(cobro(page).getByRole('button', { name: 'Pagado con tarjeta' }));
  expect(c.toques).toBeLessThanOrEqual(4);
  await expect(resultado(page)).toContainText('Venta H-000003');

  // Las tres ventas llegan a la base con su folio, en orden
  await expect
    .poll(
      async () =>
        (await leerServidor(request))('ventas')
          .filter((v) => v.dispositivoNombre === 'Caja H')
          .map((v) => [
            v.folio,
            v.total,
            v.cambio,
            (v.pagos as { metodo: string }[]).map((p) => p.metodo).join('+'),
          ])
          .sort(),
      { timeout: 15_000 },
    )
    .toEqual([
      ['H-000001', 4500, 0, 'efectivo'],
      ['H-000002', 8500, 1500, 'efectivo'],
      ['H-000003', 4500, 0, 'tarjeta'],
    ]);
});

test('pagos combinados (casos E y F) y volver a la venta sin perder el carrito', async ({
  page,
  request,
}) => {
  await prepararDispositivo(page, 'J');
  await entrarCon(page, PIN.cajero);
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Cafés' }).click();
  await page.getByRole('tab', { name: 'Alimentos' }).click();
  await page.getByRole('button', { name: /^Molletes/ }).click();
  await page.getByRole('button', { name: /^Molletes/ }).click();
  await expect(panelVenta(page).getByRole('button', { name: /^Cobrar/ })).toHaveText('Cobrar$150.00');

  // Volver a la venta descarta los pagos pero no el carrito
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await cobro(page).getByRole('button', { name: 'Volver a la venta' }).click();
  await expect(panelVenta(page)).toContainText('Molletes');

  // Caso E: $100 en efectivo ("Agregar pago") y $50 con tarjeta
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await cobro(page).getByRole('button', { name: '1', exact: true }).click();
  await cobro(page).getByRole('button', { name: '00', exact: true }).click();
  await expect(cobro(page)).toContainText('Recibido$100.00');
  await cobro(page).getByRole('button', { name: 'Agregar pago' }).click();
  await expect(cobro(page).getByRole('complementary', { name: 'Pagos' })).toContainText('Pendiente$50.00');
  await expect(cobro(page).getByRole('tab', { name: 'Tarjeta' })).toHaveAttribute('aria-selected', 'true');
  await expect(cobro(page).getByLabel('Monto')).toHaveValue('50');
  await cobro(page).getByRole('button', { name: 'Pagado con tarjeta' }).click();
  await expect(resultado(page)).toContainText('Venta J-000001');
  await expect(resultado(page)).toContainText('$0.00');

  // Caso F: $100 con tarjeta y luego efectivo $100 → cambio $50
  await page.getByRole('button', { name: /^Molletes/ }).click();
  await page.getByRole('button', { name: /^Molletes/ }).click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await cobro(page).getByRole('tab', { name: 'Tarjeta' }).click();
  await cobro(page).getByLabel('Monto').fill('100');
  await cobro(page).getByLabel('Referencia (opcional)').fill('4242');
  await cobro(page).getByRole('button', { name: 'Pagado con tarjeta' }).click();
  await expect(cobro(page).getByRole('complementary', { name: 'Pagos' })).toContainText('Ref. 4242');
  await cobro(page).getByRole('button', { name: '$100', exact: true }).click();
  await expect(cobro(page)).toContainText('Cambio$50.00');
  await cobro(page).getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(resultado(page)).toContainText('Venta J-000002');
  await expect(resultado(page)).toContainText('$50.00');

  await expect
    .poll(
      async () =>
        (await leerServidor(request))('ventas')
          .filter((v) => v.dispositivoNombre === 'Caja J')
          .map((v) => [v.folio, v.pagos, v.cambio])
          .sort(),
      { timeout: 15_000 },
    )
    .toEqual([
      [
        'J-000001',
        [
          { metodo: 'efectivo', monto: 10000, recibido: 10000 },
          { metodo: 'tarjeta', monto: 5000 },
        ],
        0,
      ],
      [
        'J-000002',
        [
          { metodo: 'tarjeta', monto: 10000, referencia: '4242' },
          { metodo: 'efectivo', monto: 5000, recibido: 10000 },
        ],
        5000,
      ],
    ]);
});
