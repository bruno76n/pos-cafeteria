import { expect, test } from '@playwright/test';
import { entrarCon, irAVentaConCajaAbierta, leerServidor, PIN, prepararDispositivo } from './ayudas';

test('sin caja abierta no se vende; al abrirla el turno llega a la base', async ({ page, request }) => {
  await prepararDispositivo(page, 'C');
  await entrarCon(page, PIN.cajero);
  await page.getByRole('link', { name: 'Venta', exact: true }).click();
  await expect(page.getByText('Abre la caja para empezar a vender.')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir caja' }).click();
  await page.getByLabel('Fondo inicial').fill('500');
  await page.getByRole('dialog').getByRole('button', { name: 'Abrir caja' }).click();
  await expect(page.getByText('Abre la caja para empezar a vender.')).toBeHidden();

  await expect
    .poll(
      async () => (await leerServidor(request))('turnos').filter((t) => t.dispositivoNombre === 'Caja C'),
      {
        timeout: 15_000,
      },
    )
    .toEqual([
      expect.objectContaining({
        estado: 'abierto',
        fondoInicial: 50000,
        abiertoPor: { id: 'cajero', nombre: 'Cajero' },
      }),
    ]);
});

test('movimientos: entradas, retiros y gastos suman o restan; anular deja de contar', async ({ page }) => {
  await prepararDispositivo(page, 'M');
  await entrarCon(page, PIN.encargada);
  await irAVentaConCajaAbierta(page, '500');
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Caja' }).click();

  const registrar = async (tipo: string, monto: string, concepto = '', categoria = '') => {
    await page.getByRole('button', { name: `Registrar ${tipo}` }).click();
    const dialogo = page.getByRole('dialog', { name: `Registrar ${tipo}` });
    if (categoria) await dialogo.getByRole('button', { name: categoria }).click();
    if (concepto) await dialogo.getByLabel(/Concepto/).fill(concepto);
    await dialogo.getByLabel('Monto').fill(monto);
    await dialogo.getByRole('button', { name: `Registrar ${tipo}` }).click();
    await expect(dialogo).toBeHidden();
  };
  await registrar('entrada', '200', 'Cambio para caja');
  await registrar('retiro', '300');
  await registrar('gasto', '80', 'Bolsa de hielo', 'Hielo');
  const esperado = page.getByText('Efectivo esperado').locator('..');
  await expect(esperado).toContainText('$320.00'); // 500 + 200 − 300 − 80

  await page.getByRole('link', { name: 'Movimientos' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Gasto' })).toContainText(
    'Hielo · Bolsa de hielo',
  );
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Retiro' })
    .getByRole('button', { name: 'Anular' })
    .click();
  await page
    .getByRole('dialog', { name: '¿Anular el movimiento?' })
    .getByRole('button', { name: 'Anular' })
    .click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Retiro' })).toContainText(
    'Anulado por Encargada',
  );
  await page.getByRole('link', { name: 'Caja actual' }).click();
  await expect(esperado).toContainText('$620.00'); // el retiro anulado ya no resta
});

test('abrir, vender, registrar gasto y cerrar con faltante; el corte muestra la diferencia', async ({
  page,
  request,
}) => {
  await prepararDispositivo(page, 'N');
  await entrarCon(page, PIN.cajero);
  await irAVentaConCajaAbierta(page, '500');
  // venta de $45 en efectivo
  await page.getByRole('tab', { name: 'Postres' }).click();
  await page.getByRole('button', { name: /^Brownie/ }).click();
  await page
    .getByRole('complementary', { name: 'Venta actual' })
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Exacto' }).click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Confirmar cobro' }).click();

  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Caja' }).click();
  // el cajero no ve el efectivo esperado (corte ciego)
  await expect(page.getByText('Efectivo esperado')).toHaveCount(0);
  await page.getByRole('button', { name: 'Registrar gasto' }).click();
  await page.getByRole('dialog').getByLabel('Concepto').fill('Hielo');
  await page.getByRole('dialog').getByLabel('Monto').fill('80');
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar gasto' }).click();

  // esperado: 500 + 45 − 80 = 465; se cuentan 450 → faltan 15
  await page.getByRole('button', { name: 'Cerrar caja' }).click();
  await page.getByLabel('Piezas de Billete de $200', { exact: true }).fill('2');
  await page.getByLabel('Piezas de Billete de $50', { exact: true }).fill('1');
  await expect(page.getByText('Contado: $450.00')).toBeVisible();
  await expect(page.getByText('Efectivo esperado')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('region', { name: 'Diferencia' })).toContainText('Efectivo esperado$465.00');
  await expect(page.getByRole('region', { name: 'Diferencia' })).toContainText('Faltan $15.00');
  await page.getByLabel('Nota (opcional)').fill('Faltó cambio');
  await page.getByRole('button', { name: 'Cerrar caja' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Caja cerrada.' })).toHaveText(
    'Caja cerrada. Diferencia: faltan $15.00.',
  );
  await expect(page.getByRole('document', { name: 'Vista previa del ticket' })).toContainText(
    'Diferencia: Faltan',
  );

  await page.getByRole('button', { name: 'Ir a Caja' }).click();
  await page.getByRole('link', { name: 'Cortes de caja' }).click();
  const fila = page.getByRole('row').filter({ hasText: 'Caja N' });
  await expect(fila).toContainText('Faltan $15.00');
  await fila.getByRole('link').click();
  await expect(page.getByRole('document', { name: 'Vista previa del ticket' })).toContainText(
    '*** REIMPRESIÓN ***',
  );

  await expect
    .poll(async () => (await leerServidor(request))('turnos').find((t) => t.dispositivoNombre === 'Caja N'), {
      timeout: 15_000,
    })
    .toMatchObject({
      estado: 'cerrado',
      efectivoContado: 45000,
      nota: 'Faltó cambio',
      resumen: { diferencia: -1500 },
    });
});
